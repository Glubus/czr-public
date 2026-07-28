import { safeApiGet } from '$lib/server/api';
import type { Player } from '$lib/types';
import type { PageServerLoad } from './$types';

export type TeamLeaderboard = {
	page: number;
	hasMore: boolean;
	entries: Array<{
		rank: number;
		competitorKey: string;
		playerCount: number;
		members: Array<Pick<Player, 'id' | 'name' | 'image'>>;
		performancePoints: number;
		recordCount: number;
		firstPlaces: number;
		podiums: number;
		lastVerifiedAt: string | null;
	}>;
};

export const load: PageServerLoad = async ({ fetch, url }) => {
	const requested = Number(url.searchParams.get('player_count') ?? 2);
	const playerCount = [2, 3, 4].includes(requested) ? requested : 2;
	const result = await safeApiGet<TeamLeaderboard>(
		fetch,
		`/teams/leaderboard?player_count=${playerCount}&page=0`
	);
	return { leaderboard: result.data, playerCount, apiUnavailable: result.unavailable };
};
