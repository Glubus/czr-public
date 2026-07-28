import { apiGet } from '$lib/server/api';
import type { MapLeaderboard } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, params, url }) => {
	const requested = Number.parseInt(url.searchParams.get('player_count') ?? '1', 10);
	const playerCount = [1, 2, 3, 4].includes(requested) ? requested : 1;
	const requestedAssignment = Number.parseInt(url.searchParams.get('assignment_id') ?? '', 10);
	const assignmentQuery = requestedAssignment > 0 ? `&assignment_id=${requestedAssignment}` : '';
	const scores: number[] = [];
	let page = 0;
	let leaderboard: MapLeaderboard;
	do {
		leaderboard = await apiGet<MapLeaderboard>(
			fetch,
			`/maps/${encodeURIComponent(params.id)}/categories/${encodeURIComponent(params.categoryId)}/leaderboard?player_count=${playerCount}&page=${page}${assignmentQuery}`
		);
		scores.push(...leaderboard.entries.map((entry) => entry.scoreValue));
		page += 1;
	} while (leaderboard.hasMore && page < 100);

	return json({
		pool: leaderboard.pool,
		playerCount,
		scores,
		scoreType: leaderboard.category.scoreType,
		rankingDirection: leaderboard.category.rankingDirection
	});
};
