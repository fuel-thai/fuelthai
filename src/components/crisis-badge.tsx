import { Link } from "@tanstack/react-router";
import { t } from "../lib/translations";
import type { Lang } from "../lib/language-store";

export function CrisisBadge({ lang }: { lang: Lang }) {
	return (
		<Link to="/crisis" className="crisis-badge inline-block rounded-full bg-destructive/20 px-3 py-1 text-xs font-bold text-destructive hover:bg-destructive/30 transition-colors">
			{t("crisisActive", lang)}
		</Link>
	);
}
