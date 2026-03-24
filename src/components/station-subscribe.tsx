import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import type { Lang } from "../lib/language-store";

interface StationSubscribeProps {
	stationId: string;
	stationName: string;
	lang: Lang;
}

export function StationSubscribe({ stationId, stationName, lang }: StationSubscribeProps) {
	const [supported, setSupported] = useState(false);
	const [subscribed, setSubscribed] = useState(false);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const ok = "serviceWorker" in navigator && "PushManager" in window;
		setSupported(ok);
		if (!ok) return;

		// Check if already subscribed to this station
		navigator.serviceWorker?.ready.then((reg) => {
			reg.pushManager.getSubscription().then((sub) => {
				if (!sub) return;
				fetch(`/api/push/station-status?endpoint=${encodeURIComponent(sub.endpoint)}&station=${encodeURIComponent(stationId)}`)
					.then((r) => r.json())
					.then((d) => setSubscribed(d.subscribed))
					.catch(() => {});
			});
		});
	}, [stationId]);

	async function subscribe() {
		setLoading(true);
		try {
			const permission = await Notification.requestPermission();
			if (permission !== "granted") { setLoading(false); return; }

			const vapidRes = await fetch("/api/push/vapid");
			const { publicKey } = await vapidRes.json();
			if (!publicKey) throw new Error("No VAPID key");

			const reg = await navigator.serviceWorker.ready;
			let sub = await reg.pushManager.getSubscription();
			if (!sub) {
				const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
				const b64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
				const raw = atob(b64);
				const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
				sub = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: key.buffer as ArrayBuffer,
				});
			}

			await fetch("/api/push/subscribe-station", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ subscription: sub.toJSON(), stationId, lang }),
			});

			setSubscribed(true);
		} catch {
			// Silent fail
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
				await fetch("/api/push/unsubscribe-station", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ endpoint: sub.endpoint, stationId }),
				});
			}
			setSubscribed(false);
		} catch {
			// Silent fail
		} finally {
			setLoading(false);
		}
	}

	if (!supported) {
		return (
			<div className="rounded-lg border border-border bg-card px-4 py-3">
				<p className="font-mono text-xs text-muted-foreground">
					{lang === "th"
						? "เพิ่ม FUEL::TH ลงหน้าจอหลักเพื่อรับการแจ้งเตือน"
						: "Add FUEL::TH to home screen to enable notifications"}
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
				className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
			>
				<BellRing className="h-3.5 w-3.5" />
			{loading ? "..." : (lang === "th" ? "กำลังติดตามสถานีนี้ (กดเพื่อยกเลิก)" : "Watching this station (tap to stop)")}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={subscribe}
			disabled={loading}
			className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 font-mono text-xs font-black text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
		>
			<Bell className="h-3.5 w-3.5" />
		{loading ? "..." : (lang === "th" ? "แจ้งเตือนเมื่อสถานีนี้มีดีเซล" : "Notify me when this station gets diesel")}
		</button>
	);
}
