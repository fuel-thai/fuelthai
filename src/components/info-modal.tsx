import { useEffect, useRef } from "react";
import type { Lang } from "../lib/language-store";

interface InfoModalProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}

export function InfoModal({ open, onClose, title, children }: InfoModalProps) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
			<div className="fixed inset-0 bg-black/60" />
			<div
				ref={ref}
				onClick={(e) => e.stopPropagation()}
				className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
			>
				<div className="flex items-center justify-between mb-3">
					<h3 className="font-mono text-sm font-bold text-foreground">{title}</h3>
					<button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
				</div>
				<div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
					{children}
				</div>
			</div>
		</div>
	);
}

export function BrentInfoContent({ lang }: { lang: Lang }) {
	if (lang === "th") {
		return (
			<>
				<p><strong className="text-foreground">น้ำมันดิบเบรนท์คืออะไร?</strong></p>
				<p>น้ำมันดิบเบรนท์เป็นราคาอ้างอิงน้ำมันดิบที่สำคัญที่สุดของโลก ใช้กำหนดราคาน้ำมันประมาณ 80% ของการซื้อขายทั่วโลก</p>
				<p><strong className="text-foreground">ทำไมถึงสำคัญกับคนไทย?</strong></p>
				<p>ไทยนำเข้าน้ำมันดิบเกือบทั้งหมด เมื่อราคาเบรนท์สูงขึ้น ราคาน้ำมันที่ปั๊มก็สูงขึ้นตาม โดยปกติจะมีดีเลย์ 1-3 วัน</p>
				<p><strong className="text-foreground">วิกฤตปัจจุบัน</strong></p>
				<p>การปิดช่องแคบฮอร์มุซทำให้เบรนท์พุ่งจาก ~$70 เป็น $126/บาร์เรล ส่งผลให้ราคาดีเซลในไทยเพิ่มขึ้นกว่า 60% และกองทุนน้ำมันขาดทุนหนัก</p>
			</>
		);
	}
	return (
		<>
			<p><strong className="text-foreground">What is Brent Crude?</strong></p>
			<p>Brent Crude is the world's most important oil price benchmark. It sets the price for roughly 80% of global oil trades.</p>
			<p><strong className="text-foreground">Why does it matter for Thailand?</strong></p>
			<p>Thailand imports nearly all its crude oil. When Brent goes up, pump prices follow within 1-3 days. Thailand is Asia's largest net oil importer at 4.7% of GDP -- every 10% oil price rise worsens the current account by ~0.5% of GDP.</p>
			<p><strong className="text-foreground">The current crisis</strong></p>
			<p>The Strait of Hormuz blockade sent Brent from ~$70 to $126/barrel. This forced Thailand to abandon its diesel price cap, depleted the Oil Fund ($32M/day losses), and caused nationwide diesel shortages.</p>
		</>
	);
}
