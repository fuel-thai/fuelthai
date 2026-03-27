export type DieselStatus = "available" | "limited" | "out" | "pending_delivery" | "unknown";

export interface StatusConfig {
	bg: string;
	text: string;
	border: string;
	dot: string;
	pill: string;
	label_en: string;
	label_th: string;
}

export const DIESEL_STATUS: Record<string, StatusConfig> = {
	available: {
		bg: "bg-emerald-500/10",
		text: "text-emerald-400",
		border: "border-emerald-500/30",
		dot: "bg-emerald-400",
		pill: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
		label_en: "Available",
		label_th: "มีดีเซล",
	},
	limited: {
		bg: "bg-amber-500/10",
		text: "text-amber-400",
		border: "border-amber-500/30",
		dot: "bg-amber-400",
		pill: "bg-amber-500/20 text-amber-400 border-amber-500/40",
		label_en: "Limited",
		label_th: "จำกัด",
	},
	out: {
		bg: "bg-red-500/10",
		text: "text-red-400",
		border: "border-red-500/30",
		dot: "bg-red-400",
		pill: "bg-red-500/20 text-red-400 border-red-500/40",
		label_en: "Out",
		label_th: "หมด",
	},
	pending_delivery: {
		bg: "bg-blue-500/10",
		text: "text-blue-400",
		border: "border-blue-500/30",
		dot: "bg-blue-400",
		pill: "bg-blue-500/20 text-blue-400 border-blue-500/40",
		label_en: "Pending Delivery",
		label_th: "รอเติม",
	},
	unknown: {
		bg: "bg-card",
		text: "text-muted-foreground",
		border: "border-border",
		dot: "bg-gray-500",
		pill: "bg-muted text-muted-foreground border-border",
		label_en: "Unknown",
		label_th: "ไม่ทราบ",
	},
};

export function getStatusConfig(status: string): StatusConfig {
	return DIESEL_STATUS[status] || DIESEL_STATUS.unknown;
}

export function statusLabel(status: string, lang: "en" | "th"): string {
	const cfg = getStatusConfig(status);
	return lang === "th" ? cfg.label_th : cfg.label_en;
}

export const FUEL_LABELS: Record<string, string> = {
	D: "D", B20: "B20", G95: "G95", G91: "G91", E20: "E20", E85: "E85", LPG: "LPG", NGV: "NGV", EV: "EV",
};

export const FUEL_DOT_COLORS: Record<string, string> = {
	available: "bg-emerald-400",
	limited: "bg-amber-400",
	out: "bg-red-400",
	pending_delivery: "bg-blue-400",
	unknown: "bg-gray-500",
};
