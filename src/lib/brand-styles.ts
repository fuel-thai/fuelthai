export interface BrandStyle {
	bg: string;
	text: string;
	label: string;
}

export const BRAND_STYLES: Record<string, BrandStyle> = {
	PTT: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "PTT" },
	SHELL: { bg: "bg-red-500/20", text: "text-red-400", label: "Shell" },
	BANGCHAK: { bg: "bg-green-500/20", text: "text-green-400", label: "Bangchak" },
	BCP: { bg: "bg-green-500/20", text: "text-green-400", label: "Bangchak" },
	PT: { bg: "bg-blue-500/20", text: "text-blue-400", label: "PT" },
	ESSO: { bg: "bg-blue-600/20", text: "text-blue-300", label: "Esso" },
	CALTEX: { bg: "bg-red-600/20", text: "text-red-300", label: "Caltex" },
	SUSCO: { bg: "bg-orange-500/20", text: "text-orange-400", label: "SUSCO" },
	IRPC: { bg: "bg-purple-500/20", text: "text-purple-400", label: "IRPC" },
	OTHER: { bg: "bg-muted", text: "text-muted-foreground", label: "Other" },
};

export function getBrandStyle(brand: string): BrandStyle {
	return BRAND_STYLES[brand.toUpperCase()] || BRAND_STYLES.OTHER;
}

export function mapsDirectionsUrl(lat: number, lon: number): string {
	return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

export function timeAgo(iso: string, lang: "en" | "th" = "en"): string {
	if (!iso) return "";
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return lang === "th" ? "เมื่อสักครู่" : "just now";
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h`;
	const days = Math.floor(hrs / 24);
	return `${days}d`;
}
