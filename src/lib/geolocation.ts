import { useLocation } from "./location-store";

function storeAndResolve(pos: GeolocationPosition, resolve: (p: GeolocationPosition) => void) {
	useLocation.getState().setLocation(pos.coords.latitude, pos.coords.longitude);
	resolve(pos);
}

export function getPosition(): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error("Geolocation not supported"));
			return;
		}

		let resolved = false;

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				if (!resolved) { resolved = true; storeAndResolve(pos, resolve); }
			},
			() => {
				if (!resolved) {
					navigator.geolocation.getCurrentPosition(
						(pos) => {
							if (!resolved) { resolved = true; storeAndResolve(pos, resolve); }
						},
						(err) => {
							if (!resolved) { resolved = true; reject(err); }
						},
						{ enableHighAccuracy: false, timeout: 30000, maximumAge: 300000 },
					);
				}
			},
			{ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
		);
	});
}
