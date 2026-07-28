import { safeApiGet } from '$lib/server/api';
import type {
	GameCollection,
	HighestPointRecords,
	PlatformStats,
	WeeklyPointRecords
} from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const [latest, weekly, games, stats] = await Promise.all([
		safeApiGet<HighestPointRecords>(fetch, '/records/latest-world-records'),
		safeApiGet<WeeklyPointRecords>(fetch, '/records/highest-pp-week'),
		safeApiGet<GameCollection>(fetch, '/games?page=0'),
		safeApiGet<PlatformStats>(fetch, '/stats')
	]);

	return {
		latest: latest.data,
		weekly: weekly.data,
		games: games.data,
		stats: stats.data,
		apiUnavailable:
			latest.unavailable || weekly.unavailable || games.unavailable || stats.unavailable
	};
};
