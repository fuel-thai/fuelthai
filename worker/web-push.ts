// Web Push for Cloudflare Workers -- VAPID JWT signing with raw EC keys

function base64UrlToBytes(b64url: string): Uint8Array {
	const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
	const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
	const raw = atob(padded);
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function importVapidKeys(publicKeyB64: string, privateKeyB64: string): Promise<CryptoKey> {
	// Public key is 65-byte uncompressed point (04 || x || y)
	const pubBytes = base64UrlToBytes(publicKeyB64);
	// Private key is 32-byte raw scalar
	const privBytes = base64UrlToBytes(privateKeyB64);

	// Extract x and y from uncompressed public key (skip 04 prefix)
	const x = bytesToBase64Url(pubBytes.slice(1, 33));
	const y = bytesToBase64Url(pubBytes.slice(33, 65));
	const d = bytesToBase64Url(privBytes);

	return crypto.subtle.importKey(
		"jwk",
		{ kty: "EC", crv: "P-256", x, y, d },
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
}

async function createVapidJwt(
	audience: string,
	subject: string,
	publicKeyB64: string,
	privateKeyB64: string,
): Promise<string> {
	const header = { typ: "JWT", alg: "ES256" };
	const now = Math.floor(Date.now() / 1000);
	const payload = { aud: audience, exp: now + 3600, sub: subject };

	const headerB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
	const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
	const unsignedToken = `${headerB64}.${payloadB64}`;

	const key = await importVapidKeys(publicKeyB64, privateKeyB64);

	const sigBuffer = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		key,
		new TextEncoder().encode(unsignedToken),
	);

	const sigB64 = bytesToBase64Url(new Uint8Array(sigBuffer));
	return `${unsignedToken}.${sigB64}`;
}

export async function sendWebPush(
	subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
	payload: string,
	vapidPublicKey: string,
	vapidPrivateKey: string,
	vapidSubject: string,
): Promise<void> {
	const endpoint = new URL(subscription.endpoint);
	const audience = `${endpoint.protocol}//${endpoint.host}`;

	const jwt = await createVapidJwt(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);

	// Send notification without payload encryption (tickle notification)
	// The service worker will show a notification based on the push event
	const res = await fetch(subscription.endpoint, {
		method: "POST",
		headers: {
			"Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
			"TTL": "3600",
			"Urgency": "high",
			"Topic": "diesel-alert",
			"Content-Length": "0",
		},
	});

	if (res.status === 410 || res.status === 404) {
		throw new Error("Subscription expired");
	}
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Push failed: ${res.status} ${body.slice(0, 100)}`);
	}
}
