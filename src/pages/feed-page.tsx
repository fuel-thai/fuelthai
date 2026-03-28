import { useLanguage } from "../lib/language-store";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
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

			<SiteFooter />
		</div>
	);
}
