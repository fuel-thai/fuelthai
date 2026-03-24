import { create } from "zustand";

interface LocationState {
	lat: number | null;
	lon: number | null;
	setLocation: (lat: number, lon: number) => void;
}

export const useLocation = create<LocationState>((set) => ({
	lat: null,
	lon: null,
	setLocation: (lat, lon) => set({ lat, lon }),
}));

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
