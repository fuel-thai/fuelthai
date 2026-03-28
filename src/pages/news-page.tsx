import { useLanguage } from "../lib/language-store";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { useEffect, useState } from "react";
import { ExternalLink, Newspaper, Ship, Flame, Globe, RefreshCw } from "lucide-react";

interface NewsArticle {
	title: string;
	link: string;
	date: string;
	description: string;
	source: string;
	category: string;
}

interface NewsResponse {
	count: number;
	articles: NewsArticle[];
	sources: Record<string, number>;
}

const SOURCE_ICONS: Record<string, typeof Flame> = {
	"OilPrice.com": Flame,
	"gCaptain": Ship,
	"Natural Gas Intel": Flame,
	"Bangkok Post": Globe,
};

const CATEGORY_COLORS: Record<string, string> = {
	energy: "text-orange-400 bg-orange-400/10 border-orange-400/20",
	shipping: "text-blue-400 bg-blue-400/10 border-blue-400/20",
	thailand: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

function timeAgo(dateStr: string, lang: string): string {
	if (!dateStr) return "";
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return lang === "th" ? "เมื่อสักครู่" : "just now";
	if (mins < 60) return lang === "th" ? `${mins} นาทีที่แล้ว` : `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return lang === "th" ? `${hrs} ชั่วโมงที่แล้ว` : `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return lang === "th" ? `${days} วันที่แล้ว` : `${days}d ago`;
}

export default function NewsPage() {
	const { lang } = useLanguage();
	const [data, setData] = useState<NewsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeSource, setActiveSource] = useState<string | null>(null);

	function fetchNews() {
		setLoading(true);
		setError(null);
		fetch("/api/news/energy?limit=50")
			.then((r) => r.json())
			.then((d: NewsResponse) => {
				setData(d);
				setLoading(false);
			})
			.catch(() => {
				setError("Failed to load news");
				setLoading(false);
			});
	}

	useEffect(() => {
		fetchNews();
		const interval = setInterval(fetchNews, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, []);

	const filtered = activeSource
		? data?.articles.filter((a) => a.source === activeSource) || []
		: data?.articles || [];

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader
				page="NEWS"
				pageTh="ข่าว"
				subtitle="Energy & shipping news from multiple sources"
				subtitleTh="ข่าวพลังงานและการขนส่งจากหลายแหล่ง"
			/>

			<main className="mx-auto max-w-4xl px-4 py-6">
				{/* Source filter chips */}
				{data?.sources && (
					<div className="mb-4 flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setActiveSource(null)}
							className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
								activeSource === null
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-muted-foreground hover:text-foreground"
							}`}
						>
							{lang === "th" ? "ทั้งหมด" : "All"} ({data.count})
						</button>
						{Object.entries(data.sources).map(([source, count]) => (
							<button
								key={source}
								type="button"
								onClick={() => setActiveSource(activeSource === source ? null : source)}
								className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
									activeSource === source
										? "border-primary bg-primary/10 text-primary"
										: "border-border text-muted-foreground hover:text-foreground"
								}`}
							>
								{source} ({count})
							</button>
						))}
						<button
							type="button"
							onClick={fetchNews}
							className="ml-auto rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
							title="Refresh"
						>
							<RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
						</button>
					</div>
				)}

				{/* Loading state */}
				{loading && !data && (
					<div className="space-y-3">
						{[...Array(8)].map((_, i) => (
							<div key={i} className="animate-pulse rounded-lg border border-border bg-card p-4">
								<div className="h-4 w-3/4 rounded bg-muted" />
								<div className="mt-2 h-3 w-full rounded bg-muted" />
								<div className="mt-1 h-3 w-1/2 rounded bg-muted" />
							</div>
						))}
					</div>
				)}

				{/* Error state */}
				{error && (
					<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
						{error}
					</div>
				)}

				{/* Articles */}
				{filtered.length > 0 && (
					<div className="space-y-2">
						{filtered.map((article) => {
							const IconComponent = SOURCE_ICONS[article.source] || Newspaper;
							const colorClass = CATEGORY_COLORS[article.category] || "text-muted-foreground bg-muted/10 border-muted/20";

							return (
								<a
									key={article.link}
									href={article.link}
									target="_blank"
									rel="noopener noreferrer"
									className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-card/80"
								>
									<div className="flex items-start gap-3">
										<IconComponent className={`mt-0.5 h-4 w-4 shrink-0 ${colorClass.split(" ")[0]}`} />
										<div className="min-w-0 flex-1">
											<h3 className="font-mono text-sm font-medium leading-tight text-foreground group-hover:text-primary">
												{article.title}
												<ExternalLink className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-50" />
											</h3>
											{article.description && (
												<p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
													{article.description}
												</p>
											)}
											<div className="mt-2 flex items-center gap-2">
												<span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${colorClass}`}>
													{article.source}
												</span>
												<span className="font-mono text-[10px] text-muted-foreground/60">
													{timeAgo(article.date, lang)}
												</span>
											</div>
										</div>
									</div>
								</a>
							);
						})}
					</div>
				)}

				{/* Empty state */}
				{!loading && filtered.length === 0 && (
					<div className="py-12 text-center text-sm text-muted-foreground">
						{lang === "th" ? "ไม่พบข่าว" : "No news articles found"}
					</div>
				)}
			</main>

			<SiteFooter />
		</div>
	);
}
