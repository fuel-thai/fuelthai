import type { Lang } from "./language-store";

const translations = {
	// ─── Global ──────────────────────────────────────────────────
	crisisActive: { en: "CRISIS ACTIVE", th: "วิกฤตเชื้อเพลิง" },
	fuelTh: { en: "FUEL::TH", th: "FUEL::TH" },
	prices: { en: "Prices", th: "ราคา" },
	stations: { en: "Stations", th: "สถานี" },
	dieselCheck: { en: "DIESEL CHECK", th: "เช็คดีเซล" },
	findStations: { en: "Find Stations", th: "ค้นหาสถานี" },
	postalCode: { en: "Postal Code", th: "รหัสไปรษณีย์" },
	useMyLocation: { en: "Use My Location", th: "ใช้ตำแหน่งของฉัน" },
	locating: { en: "Locating...", th: "กำลังค้นหาตำแหน่ง..." },
	radius: { en: "Radius", th: "รัศมี" },
	directions: { en: "DIRECTIONS", th: "นำทาง" },
	photo: { en: "Photo", th: "รูปภาพ" },
	openInMaps: { en: "Open in Maps", th: "เปิดในแผนที่" },
	source: { en: "Source", th: "แหล่งข้อมูล" },
	api: { en: "API", th: "API" },

	// ─── Home page ───────────────────────────────────────────────
	heroTitle: { en: "IS THERE DIESEL NEAR YOU?", th: "มีดีเซลใกล้คุณหรือไม่?" },
	heroSubtitle: { en: "Real-time availability -- check before you drive", th: "ตรวจสอบสถานะแบบเรียลไทม์ -- เช็คก่อนขับ" },
	checkNow: { en: "CHECK NOW", th: "เช็คเลย" },
	livePrices: { en: "Thailand fuel prices -- live from Bangchak API", th: "ราคาน้ำมันไทย -- สดจาก Bangchak API" },
	dieselB7: { en: "DIESEL B7", th: "ดีเซล B7" },
	primaryFuel: { en: "Primary fuel -- crisis monitoring", th: "น้ำมันหลัก -- เฝ้าระวังวิกฤต" },
	thbPerLiter: { en: "THB/L", th: "บาท/ลิตร" },
	yesterday: { en: "Yesterday", th: "เมื่อวาน" },
	tomorrow: { en: "Tomorrow", th: "พรุ่งนี้" },
	preWarCap: { en: "Pre-war cap", th: "เพดานก่อนสงคราม" },
	allFuelTypes: { en: "All Fuel Types", th: "น้ำมันทุกชนิด" },
	butAvailable: { en: "But is it actually available at the pump?", th: "แต่จริงๆ แล้วมีที่ปั๊มไหม?" },
	checkAvailability: { en: "Check real-time diesel availability near you", th: "เช็คสถานะดีเซลแบบเรียลไทม์ใกล้คุณ" },
	fetchingPrices: { en: "Fetching prices...", th: "กำลังโหลดราคา..." },
	context: { en: "Context", th: "บริบท" },
	contextP1: {
		en: "March 25: Thailand abandoned diesel price cap (was 29.94 THB/L). Oil Fund deficit burning $32M/day. Fuel Trade Act reporting mandate active -- stations must report daily by 6pm or face criminal penalties.",
		th: "25 มี.ค.: ยกเลิกเพดานราคาดีเซล (เดิม 29.94 บาท/ลิตร) กองทุนน้ำมันขาดทุนวันละ 1,000 ล้านบาท คำสั่ง พ.ร.บ. การค้าน้ำมันเชื้อเพลิง -- สถานีต้องรายงานทุกวันก่อน 18:00 น. หรือมีโทษอาญา",
	},
	contextP2: {
		en: "Brent crude peaked $126/bbl, now ~$103. Strait of Hormuz blockade -- no resolution timeline. Fuel export ban active. Gov says queues ease in 1-2 weeks, full recovery late April.",
		th: "น้ำมันดิบเบรนท์พีค $126/บาร์เรล ปัจจุบัน ~$103 ช่องแคบฮอร์มุซถูกปิด -- ไม่มีกำหนดแก้ไข ห้ามส่งออกน้ำมัน รัฐบาลคาดคิวลดใน 1-2 สัปดาห์ ฟื้นตัวเต็มที่ปลายเมษายน",
	},
	updated: { en: "Updated", th: "อัปเดต" },
	effective: { en: "Effective", th: "มีผล" },

	// ─── Availability page ───────────────────────────────────────
	availSubtitle: { en: "Real-time diesel availability -- crowdsourced from PumpRadar", th: "สถานะดีเซลแบบเรียลไทม์ -- จาก PumpRadar" },
	checkDiesel: { en: "CHECK DIESEL", th: "เช็คดีเซล" },
	checking: { en: "Checking...", th: "กำลังตรวจสอบ..." },
	refreshIn: { en: "Refresh in", th: "รีเฟรชใน" },
	noDieselAvailable: { en: "NO DIESEL AVAILABLE", th: "ไม่มีดีเซล" },
	noDieselWithin: { en: "No diesel found within {radius}km of your location.", th: "ไม่พบดีเซลในรัศมี {radius} กม. จากตำแหน่งของคุณ" },
	closestDelivery: { en: "Closest delivery expected at", th: "คาดว่าจะส่งที่ใกล้ที่สุดที่" },
	available: { en: "Available", th: "มี" },
	limited: { en: "Limited", th: "จำกัด" },
	out: { en: "Out", th: "หมด" },
	expected: { en: "Expected", th: "รอเติม" },
	unknown: { en: "Unknown", th: "ไม่ทราบ" },
	stationsWithin: { en: "stations within", th: "สถานีในรัศมี" },
	isDieselNearYou: { en: "Is there diesel near you?", th: "มีดีเซลใกล้คุณไหม?" },
	enterPostal: { en: "Enter a postal code or use your location to check real-time diesel availability.", th: "กรอกรหัสไปรษณีย์หรือใช้ตำแหน่งเพื่อเช็คสถานะดีเซลแบบเรียลไทม์" },
	crowdsourcedReports: { en: "Crowdsourced reports from station staff and users. Updated every 5 minutes.", th: "รายงานจากเจ้าหน้าที่สถานีและผู้ใช้ อัปเดตทุก 5 นาที" },
	noReport: { en: "no report", th: "ไม่มีรายงาน" },
	confidence: { en: "confidence", th: "ความเชื่อมั่น" },
	expiresIn: { en: "expires in", th: "หมดอายุใน" },
	expired: { en: "expired", th: "หมดอายุแล้ว" },

	// ─── Diesel statuses ─────────────────────────────────────────
	dieselAvailable: { en: "DIESEL AVAILABLE", th: "มีดีเซล" },
	dieselLimited: { en: "DIESEL LIMITED", th: "ดีเซลจำกัด" },
	dieselOut: { en: "DIESEL OUT", th: "ดีเซลหมด" },
	deliveryExpected: { en: "DELIVERY EXPECTED", th: "รอเติม" },
	noData: { en: "NO DATA", th: "ไม่มีข้อมูล" },

	// ─── Stations page ───────────────────────────────────────────
	stationsSubtitle: { en: "Find nearby fuel stations -- PTT network", th: "ค้นหาสถานีน้ำมันใกล้เคียง -- เครือ PTT" },
	searching: { en: "Searching...", th: "กำลังค้นหา..." },
	gettingLocation: { en: "Getting your location...", th: "กำลังหาตำแหน่ง..." },
	findingStations: { en: "Finding stations...", th: "กำลังค้นหาสถานี..." },
	stationsFound: { en: "stations found", th: "สถานีที่พบ" },
	near: { en: "near", th: "ใกล้" },
	radiusLabel: { en: "radius", th: "รัศมี" },
	dieselAvailableLabel: { en: "Diesel Available", th: "มีดีเซล" },
	otherStations: { en: "Other Stations", th: "สถานีอื่นๆ" },
	noStationsFound: { en: "No stations found within {radius}km.", th: "ไม่พบสถานีในรัศมี {radius} กม." },
	tryDifferent: { en: "Try a different postal code or increase the search radius.", th: "ลองรหัสไปรษณีย์อื่นหรือเพิ่มรัศมีการค้นหา" },
	enterPostalStations: { en: "Enter a postal code or use your location to find nearby fuel stations.", th: "กรอกรหัสไปรษณีย์หรือใช้ตำแหน่งเพื่อค้นหาสถานีน้ำมันใกล้เคียง" },
	pttNetwork: { en: "PTT station network -- diesel availability highlighted during crisis.", th: "เครือสถานี PTT -- เน้นสถานะดีเซลในช่วงวิกฤต" },
	selfServe: { en: "SELF-SERVE", th: "เติมเอง" },
	checkDieselCta: { en: "Check Diesel", th: "เช็คดีเซล" },
	byPostalCode: { en: "by postal code", th: "ตามรหัสไปรษณีย์" },
	byCoordinates: { en: "by coordinates", th: "ตามพิกัด" },
	customRadius: { en: "custom radius (km)", th: "กำหนดรัศมี (กม.)" },

	// ─── Validation ──────────────────────────────────────────────
	invalidPostal: { en: "Enter a valid 5-digit Thai postal code (e.g. 81150)", th: "กรอกรหัสไปรษณีย์ 5 หลักที่ถูกต้อง (เช่น 81150)" },
	geoNotSupported: { en: "Geolocation not supported by your browser", th: "เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง" },
	geoDenied: { en: "Location permission denied. Enable location access and try again.", th: "ไม่อนุญาตเข้าถึงตำแหน่ง กรุณาเปิดการเข้าถึงตำแหน่งแล้วลองใหม่" },
	geoUnavailable: { en: "Location unavailable. Check your device GPS.", th: "ไม่สามารถหาตำแหน่งได้ ตรวจสอบ GPS" },
	geoTimeout: { en: "Location request timed out. Try again.", th: "หมดเวลาการขอตำแหน่ง ลองใหม่" },

	// ─── Queue ───────────────────────────────────────────────────
	queueCount: { en: "{count} in queue", th: "{count} คนในคิว" },

	// ─── Brand comparison ────────────────────────────────────────
	brandComparison: { en: "Brand Comparison", th: "เปรียบเทียบแบรนด์" },
	brandComparisonSub: { en: "Diesel B7 prices across all brands", th: "ราคาดีเซล B7 เปรียบเทียบทุกแบรนด์" },
	cheapest: { en: "CHEAPEST", th: "ถูกสุด" },
	perLiter: { en: "/L", th: "/ลิตร" },
	noBrandData: { en: "Brand prices unavailable", th: "ข้อมูลราคาแบรนด์ไม่พร้อมใช้" },

	// ─── Global context (crude, exchange) ────────────────────────
	globalContext: { en: "Global Context", th: "บริบทโลก" },
	brentCrude: { en: "Brent Crude", th: "น้ำมันดิบเบรนท์" },
	perBarrel: { en: "/bbl", th: "/บาร์เรล" },
	exchangeRate: { en: "Exchange Rate", th: "อัตราแลกเปลี่ยน" },
	day30Change: { en: "30d change", th: "เปลี่ยนแปลง 30 วัน" },
	high: { en: "High", th: "สูงสุด" },
	low: { en: "Low", th: "ต่ำสุด" },

	// ─── News ────────────────────────────────────────────────────
	crisisNews: { en: "Crisis News", th: "ข่าววิกฤต" },
	crisisNewsSub: { en: "Latest fuel and energy headlines", th: "ข่าวน้ำมันและพลังงานล่าสุด" },
	noNews: { en: "No fuel-related news found", th: "ไม่พบข่าวเกี่ยวกับน้ำมัน" },
	readMore: { en: "Read more", th: "อ่านเพิ่มเติม" },

	// ─── Stats page ──────────────────────────────────────────────
	stats: { en: "Stats", th: "สถิติ" },
	regions: { en: "Regions", th: "ภูมิภาค" },
	statsTitle: { en: "STATS", th: "สถิติ" },
	statsSubtitle: { en: "Market data and crisis indicators", th: "ข้อมูลตลาดและตัวชี้วัดวิกฤต" },
	brentCrudeChart: { en: "Brent Crude Oil Price", th: "ราคาน้ำมันดิบเบรนท์" },
	brentCrudeSub: { en: "Daily spot price ($/barrel) -- the global benchmark driving Thai fuel costs", th: "ราคาสปอตรายวัน ($/บาร์เรล) -- มาตรฐานโลกที่กำหนดต้นทุนน้ำมันไทย" },
	exchangeChart: { en: "THB/USD Exchange Rate", th: "อัตราแลกเปลี่ยน บาท/ดอลลาร์" },
	exchangeChartSub: { en: "Weaker baht = more expensive oil imports", th: "บาทอ่อน = นำเข้าน้ำมันแพงขึ้น" },
	dieselByBrand: { en: "Diesel B7 by Brand", th: "ดีเซล B7 แยกตามแบรนด์" },
	dieselByBrandSub: { en: "Current pump prices across all Thai fuel brands", th: "ราคาหน้าปั๊มปัจจุบันทุกแบรนด์ในไทย" },
	loadingData: { en: "Loading market data...", th: "กำลังโหลดข้อมูลตลาด..." },
	dataUnavailable: { en: "Data temporarily unavailable", th: "ข้อมูลไม่พร้อมใช้ชั่วคราว" },
	footerStats: { en: "FUEL::TH / STATS -- Market data from FRED, Frankfurter, and thai-oil-api. Built during the 2026 Iran war energy crisis.", th: "FUEL::TH / สถิติ -- ข้อมูลตลาดจาก FRED, Frankfurter, และ thai-oil-api สร้างในช่วงวิกฤตพลังงาน 2569" },

	// ─── Footer ──────────────────────────────────────────────────
	contact: { en: "fuel@lanta.dev", th: "fuel@lanta.dev" },
	footerHome: { en: "FUEL::TH -- Real-time Thailand fuel prices via Bangchak API. Built during the 2026 Iran war energy crisis.", th: "FUEL::TH -- ราคาน้ำมันไทยแบบเรียลไทม์จาก Bangchak API สร้างในช่วงวิกฤตพลังงานจากสงครามอิหร่าน 2569" },
	footerAvail: { en: "FUEL::TH / DIESEL CHECK -- Real-time crowdsourced availability via PumpRadar. Built during the 2026 Iran war energy crisis.", th: "FUEL::TH / เช็คดีเซล -- สถานะแบบเรียลไทม์จาก PumpRadar สร้างในช่วงวิกฤตพลังงาน 2569" },
	footerStations: { en: "FUEL::TH -- Station finder powered by PTT Station API. Built during the 2026 Iran war energy crisis.", th: "FUEL::TH -- ค้นหาสถานีจาก PTT Station API สร้างในช่วงวิกฤตพลังงาน 2569" },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang, vars?: Record<string, string | number>): string {
	const entry = translations[key];
	let text: string = entry?.[lang] || entry?.en || key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			text = text.replace(`{${k}}`, String(v));
		}
	}
	return text;
}
