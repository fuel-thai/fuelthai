import { useLanguage } from "../lib/language-store";
import { SiteHeader } from "../components/site-header";
import { StatusFeed } from "../components/status-feed";

export default function FeedPage() {
	const { lang } = useLanguage();

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader
				page="FEED"
				pageTh="ฟีด"
				subtitle="Real-time diesel status changes"
				subtitleTh="การเปลี่ยนแปลงสถานะดีเซลแบบเรียลไทม์"
			/>

			<main className="mx-auto max-w-4xl px-4 py-6">
				<StatusFeed lang={lang} limit={100} />
			</main>

			<footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
				<p>FUEL::TH -- {lang === "th" ? "สถานะดีเซลแบบเรียลไทม์จาก DOEB Fuel Now" : "Real-time diesel status from DOEB Fuel Now"}</p>
				<a href="mailto:fuel@lanta.dev" className="mt-1 inline-block text-[10px] text-muted-foreground/60 hover:text-muted-foreground">fuel@lanta.dev</a>
			</footer>
		</div>
	);
}
