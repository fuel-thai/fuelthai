import { Link } from "@tanstack/react-router";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { LanguageToggle } from "./language-toggle";
import { CrisisBadge } from "./crisis-badge";

interface SiteHeaderProps {
	page?: string;
	pageTh?: string;
	subtitle?: string;
	subtitleTh?: string;
}

export function SiteHeader({ page, pageTh, subtitle, subtitleTh }: SiteHeaderProps) {
	const { lang } = useLanguage();
	const pageLabel = page ? (lang === "th" && pageTh ? pageTh : page) : null;
	const sub = lang === "th" && subtitleTh ? subtitleTh : subtitle;

	return (
		<header className="border-b border-border px-4 py-4">
			<div className="mx-auto max-w-4xl">
				<div className="flex items-start justify-between">
					<div>
						<h1 className="font-mono text-xl font-bold tracking-tight">
							<Link to="/" className="hover:opacity-80">
								<span className="text-primary">FUEL</span>
								<span className="text-muted-foreground">::</span>
								<span className="text-accent">TH</span>
							</Link>
							{pageLabel && (
								<>
									<span className="text-muted-foreground"> / </span>
									<span className="text-foreground">{pageLabel}</span>
								</>
							)}
						</h1>
						{sub && (
							<p className="text-xs text-muted-foreground">{sub}</p>
						)}
					</div>
					<div className="shrink-0">
						<CrisisBadge lang={lang} />
					</div>
				</div>
				<nav className="mt-2 flex items-center gap-3">
					<Link to="/availability" className="font-mono text-xs text-muted-foreground hover:text-foreground">{t("dieselCheck", lang)}</Link>
					<Link to="/stations" className="font-mono text-xs text-muted-foreground hover:text-foreground">{t("findStations", lang)}</Link>
					<Link to="/regions" className="font-mono text-xs text-muted-foreground hover:text-foreground">{lang === "th" ? "ภูมิภาค" : "Regions"}</Link>
					<Link to="/stats" className="font-mono text-xs text-muted-foreground hover:text-foreground">{t("stats", lang)}</Link>
					<Link to="/news" className="font-mono text-xs text-muted-foreground hover:text-foreground">{lang === "th" ? "ข่าว" : "News"}</Link>
					<Link to="/feed" className="font-mono text-xs text-muted-foreground hover:text-foreground">{lang === "th" ? "ฟีด" : "Feed"}</Link>
					<div className="ml-auto"><LanguageToggle /></div>
				</nav>
			</div>
		</header>
	);
}
