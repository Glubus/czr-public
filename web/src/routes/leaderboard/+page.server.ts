import { apiRequest, safeApiGet } from '$lib/server/api';
import type {
	AchievementLeaderboard,
	CategorySummary,
	ClanLeaderboard,
	GameCollection,
	HighestAverageLeaderboard,
	HighestPointRecords,
	Leaderboard,
	TeamLeaderboard
} from '$lib/types';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const allowedMapStatus = new Set(['all', 'official', 'community']);
const allowedScopes = new Set(['world', 'country', 'following', 'friends']);

export const load: PageServerLoad = async ({ fetch, url, cookies, parent }) => {
	const layout = await parent();
	const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
	const game = url.searchParams.get('game')?.trim() ?? '';
	const category = url.searchParams.get('category')?.trim() ?? '';
	const rawMapStatus = url.searchParams.get('maps_status') ?? 'all';
	const mapsStatus = allowedMapStatus.has(rawMapStatus) ? rawMapStatus : 'all';
	const rawView = url.searchParams.get('view');
	const view =
		rawView === 'records' ||
		rawView === 'average' ||
		rawView === 'achievements' ||
		rawView === 'teams' ||
		rawView === 'clans'
			? rawView
			: 'players';
	const requestedPlayerCount = Number(url.searchParams.get('player_count') ?? 2);
	const playerCount = [2, 3, 4].includes(requestedPlayerCount) ? requestedPlayerCount : 2;
	const rawScope = url.searchParams.get('scope') ?? 'world';
	const scope = allowedScopes.has(rawScope) ? rawScope : 'world';
	const rawCountry =
		url.searchParams.get('country')?.trim().toUpperCase() ??
		(scope === 'country' ? (layout.user?.countryCode ?? '') : '');
	const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : '';
	const token = cookies.get('zr_session');
	if (view === 'players' && (scope === 'following' || scope === 'friends') && !token) {
		redirect(303, `/login?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	}
	const query = new URLSearchParams({ page: String(page) });
	if (game) query.set('game', game);
	if (category) query.set('categories', category);
	if (mapsStatus !== 'all') query.set('maps_status', mapsStatus);
	if (scope === 'following' || scope === 'friends') query.set('scope', scope);
	if (country) query.set('country', country);
	const highestQuery = new URLSearchParams();
	if (game) highestQuery.set('game', game);
	if (category) highestQuery.set('categories', category);
	if (mapsStatus !== 'all') highestQuery.set('maps_status', mapsStatus);

	const [
		leaderboard,
		achievementLeaderboard,
		games,
		categories,
		highestRecords,
		highestAverage,
		teams,
		clans
	] = await Promise.all([
		view === 'players'
			? safeLeaderboard(fetch, `/leaderboard?${query}`, token)
			: Promise.resolve({ data: null, unavailable: false }),
		view === 'achievements'
			? safeApiGet<AchievementLeaderboard>(fetch, `/leaderboard/achievements?page=${page}`)
			: Promise.resolve({ data: null, unavailable: false }),
		safeApiGet<GameCollection>(fetch, '/games?page=0'),
		safeApiGet<CategorySummary[]>(fetch, '/categories'),
		view === 'records'
			? safeApiGet<HighestPointRecords>(
					fetch,
					`/records/highest-pp${highestQuery.size ? `?${highestQuery}` : ''}`
				)
			: Promise.resolve({ data: null, unavailable: false }),
		view === 'average'
			? safeApiGet<HighestAverageLeaderboard>(
					fetch,
					`/leaderboard/highest-average${highestQuery.size ? `?${highestQuery}` : ''}`
				)
			: Promise.resolve({ data: null, unavailable: false }),
		view === 'teams'
			? safeApiGet<TeamLeaderboard>(fetch, `/teams/leaderboard?player_count=${playerCount}&page=0`)
			: Promise.resolve({ data: null, unavailable: false }),
		view === 'clans'
			? safeApiGet<ClanLeaderboard>(fetch, '/clans/leaderboard?page=0')
			: Promise.resolve({ data: null, unavailable: false })
	]);

	return {
		leaderboard: leaderboard.data,
		achievementLeaderboard: achievementLeaderboard.data,
		games: games.data?.entries ?? [],
		categories: categories.data ?? [],
		highestRecords: highestRecords.data,
		highestAverage: highestAverage.data,
		teams: teams.data,
		clans: clans.data,
		filters: { page, game, category, mapsStatus, scope, country, view, playerCount },
		apiUnavailable:
			leaderboard.unavailable ||
			achievementLeaderboard.unavailable ||
			categories.unavailable ||
			highestRecords.unavailable ||
			highestAverage.unavailable ||
			teams.unavailable ||
			clans.unavailable
	};
};

async function safeLeaderboard(fetcher: typeof fetch, path: string, token?: string) {
	try {
		return { data: await apiRequest<Leaderboard>(fetcher, path, {}, token), unavailable: false };
	} catch {
		return { data: null, unavailable: true };
	}
}
