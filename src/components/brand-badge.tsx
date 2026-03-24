import { useBrands } from "../lib/brands-store";

const FALLBACK_COLORS: Record<string, { bg: string; text: string }> = {
	PTT: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
	SHELL: { bg: "bg-red-500/20", text: "text-red-400" },
	BANGCHAK: { bg: "bg-green-500/20", text: "text-green-400" },
	BCP: { bg: "bg-green-500/20", text: "text-green-400" },
	PT: { bg: "bg-blue-500/20", text: "text-blue-400" },
	ESSO: { bg: "bg-blue-600/20", text: "text-blue-300" },
	CALTEX: { bg: "bg-red-600/20", text: "text-red-300" },
	SUSCO: { bg: "bg-orange-500/20", text: "text-orange-400" },
	IRPC: { bg: "bg-purple-500/20", text: "text-purple-400" },
};

export function BrandBadge({ brandId }: { brandId: string }) {
	const brand = useBrands((s) => s.brands.get(brandId) || s.brands.get(brandId?.toUpperCase()));
	const fallback = FALLBACK_COLORS[brandId?.toUpperCase()] || { bg: "bg-muted", text: "text-muted-foreground" };
	const logo = brand?.logo || null;
	const label = brand?.name_en || brandId || "Other";

	return (
		<span className={`shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${fallback.bg} ${fallback.text}`}>
			{logo && <img src={logo} alt="" className="h-4 w-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
			{label}
		</span>
	);
}
