import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import type { Lang } from "../lib/language-store";

interface PushSubscribeProps {
	lat: number;
	lng: number;
	radius: number;
	lang: Lang;
}

export function PushSubscribe({ lat, lng, radius, lang }: PushSubscribeProps) {
	const [supported, setSupported] = useState(false);
	const [subscribed, setSubscribed] = useState(false);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		setSupported("serviceWorker" in navigator && "PushManager" in window);
		// Check if already subscribed
		navigator.serviceWorker?.ready.then((reg) => {
			reg.pushManager.getSubscription().then((sub) => {
				if (sub) setSubscribed(true);
			});
		});
	}, []);

	async function subscribe() {
		setLoading(true);
		try {
			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				setLoading(false);
				return;
			}

			const vapidRes = await fetch("/api/push/vapid");
			const { publicKey } = await vapidRes.json();
			if (!publicKey) throw new Error("No VAPID key");

			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
			});

			await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					subscription: sub.toJSON(),
					lat,
					lon: lng,
					radius,
					lang,
				}),
			});

			setSubscribed(true);
		} catch {
			// Silently fail
		} finally {
			setLoading(false);
		}
	}

	async function unsubscribe() {
		setLoading(true);
		try {
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			if (sub) {
				await fetch("/api/push/unsubscribe", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ endpoint: sub.endpoint }),
				});
				await sub.unsubscribe();
			}
			setSubscribed(false);
		} catch {
			// Silently fail
		} finally {
			setLoading(false);
		}
	}

	if (!supported) {
		return (
			<div className="rounded-lg border border-border bg-card px-4 py-3">
				<p className="font-mono text-xs text-muted-foreground">
					{lang === "th"
						? "เพื่อรับการแจ้งเตือน: เพิ่ม FUEL::TH ลงหน้าจอหลักก่อน (แตะ Share > Add to Home Screen)"
						: "To enable notifications: add FUEL::TH to your home screen first (tap Share > Add to Home Screen)"}
				</p>
			</div>
		);
	}

	if (subscribed) {
		return (
			<button
				type="button"
				onClick={unsubscribe}
				disabled={loading}
				className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-mono text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
			>
				<BellRing className="h-3.5 w-3.5" />
				{loading ? "..." : (lang === "th" ? "กำลังแจ้งเตือน (กดเพื่อยกเลิก)" : "Notifications ON (tap to disable)")}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={subscribe}
			disabled={loading}
			className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-mono text-xs font-black text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
		>
			<Bell className="h-3.5 w-3.5" />
			{loading ? "..." : (lang === "th" ? "แจ้งเตือนเมื่อมีดีเซล" : "Notify me when diesel appears")}
		</button>
	);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}
