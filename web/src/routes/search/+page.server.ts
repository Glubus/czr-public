import { safeApiGet } from '$lib/server/api';
import type { GameCollection, MapCollection, UserCollection } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
	const query = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	if (query.length < 2)
		return { query, players: null, maps: null, games: null, apiUnavailable: false };

	const encoded = encodeURIComponent(query);
	const [players, maps, games] = await Promise.all([
		safeApiGet<UserCollection>(fetch, `/users?search=${encoded}&page=0`),
		safeApiGet<MapCollection>(fetch, `/maps?search=${encoded}&page=0`),
		safeApiGet<GameCollection>(fetch, `/games?search=${encoded}&page=0`)
	]);

	return {
		query,
		players: players.data,
		maps: maps.data,
		games: games.data,
		apiUnavailable: players.unavailable || maps.unavailable || games.unavailable
	};
};
