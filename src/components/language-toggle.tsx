import { useLanguage } from "../lib/language-store";

export function LanguageToggle() {
	const { lang, toggle } = useLanguage();

	return (
		<button
			type="button"
			onClick={toggle}
			className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs font-bold transition-colors hover:bg-muted"
			title={lang === "en" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English"}
		>
			<span className={lang === "en" ? "text-foreground" : "text-muted-foreground"}>EN</span>
			<span className="text-muted-foreground">/</span>
			<span className={lang === "th" ? "text-foreground" : "text-muted-foreground"}>TH</span>
		</button>
	);
}
