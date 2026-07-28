import { safeApiGet } from '$lib/server/api';
import type { PageServerLoad } from './$types';

type ClanLeaderboard = {
	entries: Array<{
		rank: number;
		clan: { id: number; slug: string; name: string; memberCount: number };
		score: number;
		eligibleRunCount: number;
		countedRunCount: number;
	}>;
};

export const load: PageServerLoad = async ({ fetch }) => {
	const result = await safeApiGet<ClanLeaderboard>(fetch, '/clans/leaderboard?page=0');
	return { leaderboard: result.data, apiUnavailable: result.unavailable };
};
