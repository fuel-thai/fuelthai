import { create } from "zustand";

export type Lang = "en" | "th";

interface LanguageState {
	lang: Lang;
	setLang: (lang: Lang) => void;
	toggle: () => void;
}

function detectLanguage(): Lang {
	try {
		const saved = localStorage.getItem("fuel-th:lang");
		if (saved === "en" || saved === "th") return saved;

		const browserLang = navigator.language || (navigator as any).userLanguage || "en";
		return browserLang.startsWith("th") ? "th" : "en";
	} catch {
		return "en";
	}
}

export const useLanguage = create<LanguageState>((set) => ({
	lang: detectLanguage(),
	setLang: (lang) => {
		localStorage.setItem("fuel-th:lang", lang);
		set({ lang });
	},
	toggle: () =>
		set((state) => {
			const next = state.lang === "en" ? "th" : "en";
			localStorage.setItem("fuel-th:lang", next);
			return { lang: next };
		}),
}));
