import { json } from '@sveltejs/kit';
import { safeApiGet } from '$lib/server/api';
import type { GameCollection, MapCollection, UserCollection } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, url }) => {
	const query = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	if (query.length < 2) return json({ entries: [], unavailable: false });

	const encoded = encodeURIComponent(query);
	const [players, maps, games] = await Promise.all([
		safeApiGet<UserCollection>(fetch, `/users?search=${encoded}&page=0`),
		safeApiGet<MapCollection>(fetch, `/maps?search=${encoded}&page=0`),
		safeApiGet<GameCollection>(fetch, `/games?search=${encoded}&page=0`)
	]);

	return json({
		entries: [
			...(players.data?.entries.slice(0, 4).map((player) => ({
				id: player.id,
				kind: 'player' as const,
				label: player.name,
				meta: `${Math.round(player.performancePoints).toLocaleString('en-US')} PP`,
				href: `/players/${player.id}`
			})) ?? []),
			...(maps.data?.entries.slice(0, 4).map((map) => ({
				id: String(map.id),
				kind: 'map' as const,
				label: map.name,
				meta: `${map.game.name} · ${map.type === 'uem' ? 'UEM' : map.type === 'custom' ? 'Community' : 'Official'}`,
				href: `/maps/${map.id}`
			})) ?? []),
			...(games.data?.entries.slice(0, 3).map((game) => ({
				id: String(game.id),
				kind: 'game' as const,
				label: game.name,
				meta: game.releaseYear ? String(game.releaseYear) : game.shortName,
				href: `/games/${game.slug}`
			})) ?? [])
		],
		unavailable: players.unavailable || maps.unavailable || games.unavailable
	});
};
