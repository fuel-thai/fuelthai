import { Link } from "@tanstack/react-router";
import { useLanguage } from "../lib/language-store";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";

export default function CrisisPage() {
	const { lang } = useLanguage();

	const content = lang === "th" ? {
		title: "วิกฤตเชื้อเพลิงไทย 2569",
		subtitle: "สิ่งที่เกิดขึ้นและเหตุผล",
		sections: [
			{
				heading: "เกิดอะไรขึ้น?",
				text: "เมื่อวันที่ 28 กุมภาพันธ์ 2569 สหรัฐฯ และอิสราเอลโจมตีอิหร่าน รวมถึงสังหารผู้นำสูงสุดคาเมเนอี กองกำลังพิทักษ์การปฏิวัติอิหร่าน (IRGC) ตอบโต้โดยระงับการเดินเรือผ่านช่องแคบฮอร์มุซ ซึ่งเป็นเส้นทางขนส่งน้ำมัน 20% ของโลก",
			},
			{
				heading: "ทำไมไทยได้รับผลกระทบหนัก?",
				text: "ไทยเป็นผู้นำเข้าน้ำมันสุทธิรายใหญ่ที่สุดในเอเชีย (4.7% ของ GDP) ราคาน้ำมันดิบเบรนท์พุ่งจาก ~$70 เป็น $126/บาร์เรล กองทุนน้ำมันขาดทุนวันละ 1,000 ล้านบาท ($32 ล้าน) เพื่ออุดหนุนราคาดีเซล จนต้องยกเลิกเพดานราคาเมื่อ 25 มีนาคม",
			},
			{
				heading: "สถานการณ์ปัจจุบัน",
				items: [
					"ยกเลิกเพดานราคาดีเซล (25 มี.ค.) -- ราคาลอยตัว",
					"สถานีบริการ 23,000 แห่งแห้ง ทั่วประเทศ",
					"ห้ามส่งออกน้ำมันเชื้อเพลิงและ LPG",
					"คำสั่ง พ.ร.บ. การค้าน้ำมัน -- สถานีต้องรายงานสถานะทุกวันก่อน 18:00 น.",
					"โทษ: จำคุกไม่เกิน 6 เดือน หรือปรับไม่เกิน 50,000 บาท หรือทั้งจำทั้งปรับ",
					"รัฐบาลคาดว่าคิวจะลดลงใน 1-2 สัปดาห์ ฟื้นตัวเต็มที่ปลายเมษายน",
				],
			},
			{
				heading: "แหล่งข้อมูลของเรา",
				text: "FUEL::TH รวบรวมข้อมูลจาก DOEB Fuel Now (กรมธุรกิจพลังงาน -- 24,548 สถานี) และ PumpRadar (รายงานจากผู้ใช้) เพื่อแสดงสถานะดีเซลแบบเรียลไทม์ ข้อมูลอัปเดตทุก 15 นาที",
			},
		],
	} : {
		title: "Thailand Fuel Crisis 2026",
		subtitle: "What's happening and why",
		sections: [
			{
				heading: "What happened?",
				text: "On February 28, 2026, joint US-Israel strikes on Iran killed Supreme Leader Khamenei. Iran's IRGC retaliated by halting shipping through the Strait of Hormuz -- the chokepoint for 20% of the world's oil supply.",
			},
			{
				heading: "Why is Thailand hit so hard?",
				text: "Thailand is Asia's largest net oil importer (4.7% of GDP). Brent crude surged from ~$70 to $126/barrel. The Oil Fund was burning $32 million/day to subsidize diesel prices, forcing Thailand to abandon its price cap on March 25.",
			},
			{
				heading: "Current situation",
				items: [
					"Diesel price cap abandoned (March 25) -- prices now floating",
					"23,000 stations nationwide reported dry",
					"Fuel and LPG export ban in effect",
					"Fuel Trade Act mandate -- stations must report status daily by 6pm",
					"Penalties: up to 6 months imprisonment or 50,000 THB fine",
					"Government expects queues to ease in 1-2 weeks, full recovery by late April",
				],
			},
			{
				heading: "Our data sources",
				text: "FUEL::TH aggregates data from DOEB Fuel Now (Department of Energy Business -- 24,548 stations) and PumpRadar (crowdsourced reports) to show real-time diesel availability. Data updates every 15 minutes.",
			},
		],
	};

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page="CRISIS" pageTh="วิกฤต" subtitle="Understanding the fuel crisis" subtitleTh="ทำความเข้าใจวิกฤตเชื้อเพลิง" />

			<main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
				<div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-6">
					<h2 className="font-mono text-2xl font-black text-destructive">{content.title}</h2>
					<p className="mt-1 text-sm text-muted-foreground">{content.subtitle}</p>
				</div>

				{content.sections.map((section, i) => (
					<div key={i} className="rounded-xl border border-border bg-card p-5">
						<h3 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">{section.heading}</h3>
						{section.text && <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{section.text}</p>}
						{section.items && (
							<ul className="mt-3 space-y-2">
								{section.items.map((item, j) => (
									<li key={j} className="flex gap-2 text-sm text-muted-foreground">
										<span className="shrink-0 text-destructive">--</span>
										<span>{item}</span>
									</li>
								))}
							</ul>
						)}
					</div>
				))}

				<div className="flex gap-3">
					<Link to="/availability" className="flex-1 rounded-lg bg-accent px-4 py-3 text-center font-mono text-sm font-black text-accent-foreground hover:bg-accent/90">
						{lang === "th" ? "เช็คดีเซลใกล้คุณ" : "Check diesel near you"}
					</Link>
					<Link to="/regions" className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-center font-mono text-sm font-bold text-foreground hover:bg-muted">
						{lang === "th" ? "ดูสถานะรายจังหวัด" : "View by province"}
					</Link>
				</div>
			</main>

			<SiteFooter />
		</div>
	);
}
