export function Skeleton({ className = "" }: { className?: string }) {
	return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export function SkeletonCard() {
	return (
		<div className="rounded-xl border border-border bg-card p-5 space-y-3">
			<div className="flex items-start justify-between">
				<div className="space-y-2 flex-1">
					<Skeleton className="h-4 w-3/4" />
					<Skeleton className="h-3 w-1/2" />
				</div>
				<Skeleton className="h-10 w-14 shrink-0" />
			</div>
			<Skeleton className="h-8 w-40 rounded-full" />
			<div className="flex gap-2">
				<Skeleton className="h-4 w-10" />
				<Skeleton className="h-4 w-10" />
				<Skeleton className="h-4 w-10" />
			</div>
		</div>
	);
}

export function SkeletonPriceCard() {
	return (
		<div className="rounded-lg border border-border bg-card p-4 space-y-2">
			<Skeleton className="h-3 w-24" />
			<Skeleton className="h-8 w-20" />
			<Skeleton className="h-5 w-32 rounded" />
		</div>
	);
}

export function SkeletonFeedItem() {
	return (
		<div className="flex items-center gap-2 px-2 py-1.5">
			<Skeleton className="h-3 w-8" />
			<Skeleton className="h-3 w-12" />
			<Skeleton className="h-3 w-40 flex-1" />
			<Skeleton className="h-3 w-24" />
		</div>
	);
}

export function SkeletonChart() {
	return (
		<div className="rounded-xl border border-border bg-card p-5 space-y-4">
			<div className="flex justify-between">
				<div className="space-y-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-3 w-48" />
				</div>
				<Skeleton className="h-10 w-20" />
			</div>
			<Skeleton className="h-44 w-full rounded" />
			<div className="flex gap-4">
				<Skeleton className="h-3 w-16" />
				<Skeleton className="h-3 w-16" />
				<Skeleton className="h-3 w-24" />
			</div>
		</div>
	);
}

export function SkeletonProvinceRow() {
	return (
		<div className="rounded-lg border border-border p-3 space-y-2">
			<div className="flex justify-between">
				<div className="space-y-1 flex-1">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-2 w-20" />
				</div>
				<Skeleton className="h-7 w-10" />
			</div>
			<Skeleton className="h-2 w-full rounded-full" />
			<div className="flex gap-3">
				<Skeleton className="h-3 w-10" />
				<Skeleton className="h-3 w-10" />
				<Skeleton className="h-3 w-10" />
			</div>
		</div>
	);
}

export function SkeletonHero() {
	return (
		<div className="rounded-xl border-2 border-muted bg-card p-6 space-y-4">
			<div className="flex items-center gap-3">
				<Skeleton className="h-7 w-24 rounded-lg" />
				<Skeleton className="h-3 w-40" />
			</div>
			<Skeleton className="h-14 w-40" />
			<div className="flex gap-6">
				<Skeleton className="h-4 w-28" />
				<Skeleton className="h-4 w-28" />
				<Skeleton className="h-4 w-28" />
			</div>
		</div>
	);
}

export function SkeletonBrandGrid() {
	return (
		<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="rounded-lg border border-border px-3 py-2 space-y-1">
					<Skeleton className="h-2 w-12" />
					<Skeleton className="h-6 w-16" />
				</div>
			))}
		</div>
	);
}
