import { create } from "zustand";

interface Brand {
	id: string;
	name_th: string;
	name_en: string;
	color: string;
	logo: string | null;
}

interface BrandsState {
	brands: Map<string, Brand>;
	loaded: boolean;
	load: () => void;
}

export const useBrands = create<BrandsState>((set, get) => ({
	brands: new Map(),
	loaded: false,
	load: () => {
		if (get().loaded) return;
		fetch("/api/brands")
			.then((r) => r.ok ? r.json() : null)
			.then((d) => {
				if (!d?.brands) return;
				const map = new Map<string, Brand>();
				for (const b of d.brands) {
					map.set(b.id, b);
					map.set(b.id.toLowerCase(), b);
				}
				set({ brands: map, loaded: true });
			})
			.catch(() => {});
	},
}));

export function getBrandLogo(brandId: string): string | null {
	const brand = useBrands.getState().brands.get(brandId) || useBrands.getState().brands.get(brandId?.toUpperCase());
	return brand?.logo || null;
}
