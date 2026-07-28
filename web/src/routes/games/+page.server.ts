import { safeApiGet } from '$lib/server/api';
import type { Game, GameCollection } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const games: Game[] = [];
	let page = 0;
	let unavailable = false;
	while (page < 100) {
		const result = await safeApiGet<GameCollection>(fetch, `/games?page=${page}`);
		unavailable ||= result.unavailable;
		if (!result.data) break;
		games.push(...result.data.entries);
		if (!result.data.hasMore) break;
		page += 1;
	}
	return { games, apiUnavailable: unavailable };
};
