import { lazy, Suspense } from 'react'
import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

const HomePage = lazy(() => import('./pages/home-page'))
const StationsPage = lazy(() => import('./pages/stations-page'))
const AvailabilityPage = lazy(() => import('./pages/availability-page'))
const StatsPage = lazy(() => import('./pages/stats-page'))
const RegionPage = lazy(() => import('./pages/region-page'))
const ProvincePage = lazy(() => import('./pages/province-page'))
const CrisisPage = lazy(() => import('./pages/crisis-page'))
const FeedPage = lazy(() => import('./pages/feed-page'))
const StationPage = lazy(() => import('./pages/station-page'))
const NewsPage = lazy(() => import('./pages/news-page'))
const TrendsPage = lazy(() => import('./pages/trends-page'))

function LazyPage({ children }: { children: React.ReactNode }) {
	return (
		<Suspense fallback={
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
				</div>
			</div>
		}>
			{children}
		</Suspense>
	)
}

const rootRoute = createRootRoute({
	component: () => <Outlet />,
})

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: () => (
		<LazyPage>
			<HomePage />
		</LazyPage>
	),
})

const stationsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/stations',
	component: () => (
		<LazyPage>
			<StationsPage />
		</LazyPage>
	),
})

const availabilityRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/availability',
	component: () => (
		<LazyPage>
			<AvailabilityPage />
		</LazyPage>
	),
})

const statsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/stats',
	component: () => (
		<LazyPage>
			<StatsPage />
		</LazyPage>
	),
})

const regionRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/regions',
	component: () => (
		<LazyPage>
			<RegionPage />
		</LazyPage>
	),
})

const provinceRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/regions/$id',
	component: () => (
		<LazyPage>
			<ProvincePage />
		</LazyPage>
	),
})

const stationRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/station/$id',
	component: () => (
		<LazyPage>
			<StationPage />
		</LazyPage>
	),
})

const crisisRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/crisis',
	component: () => (
		<LazyPage>
			<CrisisPage />
		</LazyPage>
	),
})

const feedRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/feed',
	component: () => (
		<LazyPage>
			<FeedPage />
		</LazyPage>
	),
})

const newsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/news',
	component: () => (
		<LazyPage>
			<NewsPage />
		</LazyPage>
	),
})

const trendsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/trends',
	component: () => (
		<LazyPage>
			<TrendsPage />
		</LazyPage>
	),
})

const routeTree = rootRoute.addChildren([indexRoute, stationsRoute, availabilityRoute, statsRoute, regionRoute, provinceRoute, stationRoute, crisisRoute, feedRoute, newsRoute, trendsRoute])

export const router = createRouter({
	routeTree,
	defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router
	}
}
