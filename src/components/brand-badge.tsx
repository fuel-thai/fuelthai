import { useBrands } from "../lib/brands-store";
import { BRAND_STYLES } from "../lib/brand-styles";

export function BrandBadge({ brandId }: { brandId: string }) {
	const brand = useBrands((s) => s.brands.get(brandId) || s.brands.get(brandId?.toUpperCase()));
	const fallback = BRAND_STYLES[brandId?.toUpperCase()] || BRAND_STYLES.OTHER;
	const logo = brand?.logo || null;
	const label = brand?.name_en || brandId || "Other";

	return (
		<span className={`shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${fallback.bg} ${fallback.text}`}>
			{logo && <img src={logo} alt="" className="h-4 w-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
			{label}
		</span>
	);
}
