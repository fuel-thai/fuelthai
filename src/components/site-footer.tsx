import { Link } from "@tanstack/react-router";
import { useLanguage } from "../lib/language-store";

export function SiteFooter() {
	const { lang } = useLanguage();

	const navLinks = [
		{ to: "/", label: lang === "th" ? "หน้าแรก" : "Home" },
		{ to: "/availability", label: lang === "th" ? "เช็คดีเซล" : "Diesel Check" },
		{ to: "/stations", label: lang === "th" ? "สถานี" : "Stations" },
		{ to: "/regions", label: lang === "th" ? "ภูมิภาค" : "Regions" },
		{ to: "/stats", label: lang === "th" ? "สถิติ" : "Stats" },
		{ to: "/trends", label: lang === "th" ? "แนวโน้ม" : "Trends" },
		{ to: "/news", label: lang === "th" ? "ข่าว" : "News" },
		{ to: "/feed", label: lang === "th" ? "ฟีด" : "Feed" },
	];

	return (
		<footer className="border-t border-border px-4 py-6 text-xs text-muted-foreground">
			<div className="mx-auto max-w-4xl">
				<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono">
					{navLinks.map((link) => (
						<Link key={link.to} to={link.to as any} className="hover:text-foreground">{link.label}</Link>
					))}
				</div>

				<div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/60">
					<a href="mailto:fuel@lanta.dev" className="hover:text-muted-foreground">fuel@lanta.dev</a>
					<span>|</span>
					<a href="https://github.com/fuel-thai/fuelthai" target="_blank" rel="noreferrer" className="hover:text-muted-foreground">GitHub</a>
					<span>|</span>
					<span>{lang === "th" ? "MIT ลิขสิทธิ์เปิด" : "MIT License"}</span>
				</div>
			</div>
		</footer>
	);
}
