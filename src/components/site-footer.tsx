import { useLanguage } from "../lib/language-store";

interface SiteFooterProps {
	text?: string;
	textTh?: string;
}

export function SiteFooter({ text, textTh }: SiteFooterProps) {
	const { lang } = useLanguage();
	const footerText = lang === "th" && textTh ? textTh : text;

	return (
		<footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
			{footerText && <p>FUEL::TH -- {footerText}</p>}
			<div className="mt-1 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/60">
				<a href="mailto:fuel@lanta.dev" className="hover:text-muted-foreground">fuel@lanta.dev</a>
				<span>|</span>
				<a href="https://github.com/fuel-thai/fuelthai" target="_blank" rel="noreferrer" className="hover:text-muted-foreground">GitHub</a>
			</div>
		</footer>
	);
}
