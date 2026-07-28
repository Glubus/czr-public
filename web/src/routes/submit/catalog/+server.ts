import { safeApiGet } from '$lib/server/api';
import { classifyGameMode } from '$lib/server/game-modes';
import type { CategoryForMap, Game, GameMod, MapCollection, UserCollection } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, url }) => {
	const kind = url.searchParams.get('kind');
	if (kind === 'maps') {
		const game = url.searchParams.get('game')?.trim() ?? '';
		if (!game) return json({ entries: [] });
		const entries: MapCollection['entries'] = [];
		for (let page = 0; page < 100; page += 1) {
			const result = await safeApiGet<MapCollection>(
				fetch,
				`/maps?game=${encodeURIComponent(game)}&page=${page}`
			);
			if (!result.data) return json({ entries, unavailable: true });
			entries.push(...result.data.entries);
			if (!result.data.hasMore) break;
		}
		const gameResult = await safeApiGet<Game>(fetch, `/games/${encodeURIComponent(game)}`);
		const officialModes = await Promise.all(
			entries
				.filter((map) => map.type === 'official')
				.map(async (map) => {
					const result = await safeApiGet<CategoryForMap[]>(fetch, `/maps/${map.id}/categories`);
					const categoryNames = [...new Set((result.data ?? []).map((category) => category.name))];
					return [map.id, classifyGameMode(categoryNames)] as const;
				})
		);
		const modeByMap = new Map(officialModes);
		return json({
			entries: entries.map((map) => {
				const mode = modeByMap.get(map.id) ?? null;
				const contentType =
					mode === 'Campaign Speedrun' || mode === 'Spec Ops'
						? 'non_zombies'
						: (gameResult.data?.gameType ?? 'zombies');
				return { ...map, mode, contentType };
			}),
			unavailable: gameResult.unavailable
		});
	}
	if (kind === 'categories') {
		const mapId = Number(url.searchParams.get('mapId'));
		if (!Number.isInteger(mapId) || mapId < 1) return json({ entries: [] });
		const result = await safeApiGet<CategoryForMap[]>(fetch, `/maps/${mapId}/categories`);
		return json({ entries: result.data ?? [], unavailable: result.unavailable });
	}
	if (kind === 'mods') {
		const game = url.searchParams.get('game')?.trim() ?? '';
		if (!game) return json({ entries: [] });
		const result = await safeApiGet<GameMod[]>(fetch, `/games/${encodeURIComponent(game)}/mods`);
		return json({ entries: result.data ?? [], unavailable: result.unavailable });
	}
	if (kind === 'players') {
		const query = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
		if (query.length < 2) return json({ entries: [] });
		const result = await safeApiGet<UserCollection>(
			fetch,
			`/users?search=${encodeURIComponent(query)}&page=0`
		);
		return json({
			entries: result.data?.entries.slice(0, 8) ?? [],
			unavailable: result.unavailable
		});
	}
	return json({ entries: [] }, { status: 400 });
};
