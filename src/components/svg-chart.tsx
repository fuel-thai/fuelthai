interface DataPoint {
	label: string;
	value: number;
}

interface SparklineProps {
	data: DataPoint[];
	width?: number;
	height?: number;
	color?: string;
	fillColor?: string;
	showAxis?: boolean;
}

export function Sparkline({ data, width = 300, height = 60, color = "#34d399", fillColor = "rgba(52,211,153,0.1)" }: SparklineProps) {
	if (data.length < 2) return null;

	const values = data.map((d) => d.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;

	const padY = 4;
	const padX = 2;
	const chartW = width - padX * 2;
	const chartH = height - padY * 2;

	const points = data.map((d, i) => {
		const x = padX + (i / (data.length - 1)) * chartW;
		const y = padY + chartH - ((d.value - min) / range) * chartH;
		return `${x},${y}`;
	});

	const linePath = `M${points.join(" L")}`;
	const areaPath = `${linePath} L${padX + chartW},${padY + chartH} L${padX},${padY + chartH} Z`;

	return (
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
			<path d={areaPath} fill={fillColor} />
			<path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
			<circle cx={points[points.length - 1].split(",")[0]} cy={points[points.length - 1].split(",")[1]} r="2.5" fill={color} />
		</svg>
	);
}

interface BarChartProps {
	data: { label: string; value: number; highlight?: boolean }[];
	height?: number;
	color?: string;
	highlightColor?: string;
	formatValue?: (v: number) => string;
}

export function BarChart({ data, height = 200, color = "rgba(255,255,255,0.15)", highlightColor = "rgba(52,211,153,0.4)", formatValue = (v) => v.toFixed(2) }: BarChartProps) {
	if (data.length === 0) return null;

	const maxVal = Math.max(...data.map((d) => d.value));
	const barWidth = Math.min(40, Math.floor(300 / data.length) - 4);

	return (
		<div className="w-full overflow-x-auto">
			<div className="flex items-end gap-1 justify-center" style={{ minHeight: height }}>
				{data.map((d, i) => {
					const barH = (d.value / maxVal) * (height - 40);
					return (
						<div key={i} className="flex flex-col items-center gap-1">
							<span className="font-mono text-[10px] text-muted-foreground">
								{formatValue(d.value)}
							</span>
							<div
								className="rounded-t transition-all"
								style={{
									width: barWidth,
									height: barH,
									backgroundColor: d.highlight ? highlightColor : color,
									borderTop: d.highlight ? "2px solid #34d399" : "2px solid rgba(255,255,255,0.2)",
								}}
							/>
							<span className="font-mono text-[9px] text-muted-foreground truncate" style={{ maxWidth: barWidth + 8 }}>
								{d.label}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

interface BigChartProps {
	data: DataPoint[];
	width?: number;
	height?: number;
	color?: string;
	fillColor?: string;
	yLabel?: string;
}

export function AreaChart({ data, width = 600, height = 200, color = "#34d399", fillColor = "rgba(52,211,153,0.08)", yLabel }: BigChartProps) {
	if (data.length < 2) return null;

	const values = data.map((d) => d.value);
	const min = Math.min(...values) * 0.95;
	const max = Math.max(...values) * 1.02;
	const range = max - min || 1;

	const padL = 50;
	const padR = 10;
	const padT = 10;
	const padB = 30;
	const chartW = width - padL - padR;
	const chartH = height - padT - padB;

	const points = data.map((d, i) => {
		const x = padL + (i / (data.length - 1)) * chartW;
		const y = padT + chartH - ((d.value - min) / range) * chartH;
		return { x, y, ...d };
	});

	const linePath = `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`;
	const areaPath = `${linePath} L${padL + chartW},${padT + chartH} L${padL},${padT + chartH} Z`;

	const yTicks = 4;
	const yLines = Array.from({ length: yTicks + 1 }, (_, i) => {
		const val = min + (range * i) / yTicks;
		const y = padT + chartH - (i / yTicks) * chartH;
		return { val, y };
	});

	const xTickInterval = Math.max(1, Math.floor(data.length / 6));

	return (
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
			{yLines.map((tick, i) => (
				<g key={i}>
					<line x1={padL} y1={tick.y} x2={padL + chartW} y2={tick.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
					<text x={padL - 6} y={tick.y + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "monospace" }}>
						{tick.val.toFixed(tick.val >= 100 ? 0 : 1)}
					</text>
				</g>
			))}
			{points.filter((_, i) => i % xTickInterval === 0).map((p, i) => (
				<text key={i} x={p.x} y={padT + chartH + 16} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "monospace" }}>
					{p.label.slice(5)}
				</text>
			))}
			<path d={areaPath} fill={fillColor} />
			<path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
			<circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} />
			{yLabel && (
				<text x={padL - 4} y={padT - 2} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "monospace" }}>
					{yLabel}
				</text>
			)}
		</svg>
	);
}
