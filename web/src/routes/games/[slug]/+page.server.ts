import { safeApiGet } from '$lib/server/api';
import { classifyGameMode } from '$lib/server/game-modes';
import { isFollowing, toggleFollow } from '$lib/server/follows';
import type { CategoryForMap, Game, MapCollection } from '$lib/types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, cookies }) => {
	const game = await safeApiGet<Game>(fetch, `/games/${encodeURIComponent(params.slug)}`);
	if (game.status === 404) error(404, 'Game not found');
	const maps: MapCollection['entries'] = [];
	let page = 0;
	let mapsUnavailable = false;
	while (game.data && page < 100) {
		const result = await safeApiGet<MapCollection>(
			fetch,
			`/maps?game=${encodeURIComponent(params.slug)}&page=${page}`
		);
		mapsUnavailable ||= result.unavailable;
		if (!result.data) break;
		maps.push(...result.data.entries);
		if (!result.data.hasMore) break;
		page += 1;
	}
	const officialMaps = maps.filter((map) => map.type === 'official');
	const categoryResults = await Promise.all(
		officialMaps.map(async (map) => ({
			map,
			result: await safeApiGet<CategoryForMap[]>(fetch, `/maps/${map.id}/categories`)
		}))
	);
	const modes = categoryResults.flatMap(({ map, result }) => {
		mapsUnavailable ||= result.unavailable;
		const categoryNames = [...new Set((result.data ?? []).map((category) => category.name))];
		const label = classifyGameMode(categoryNames);
		return label ? [{ map, label }] : [];
	});
	const modeIds = new Set(modes.map((entry) => entry.map.id));
	return {
		game: game.data,
		maps: maps.filter((map) => !modeIds.has(map.id)),
		modes,
		isFollowing: game.data
			? await isFollowing(fetch, cookies.get('zr_session'), 'game', String(game.data.id))
			: false,
		authenticated: Boolean(cookies.get('zr_session')),
		apiUnavailable: game.unavailable || mapsUnavailable
	};
};

export const actions: Actions = {
	follow: async ({ request, cookies, fetch, params }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=/games/${encodeURIComponent(params.slug)}`);
		const form = await request.formData();
		const targetId = String(form.get('targetId') ?? '');
		if (!targetId) return fail(400, { message: 'Invalid game.' });
		return toggleFollow(fetch, token, 'game', targetId, form.get('following') === 'true');
	}
};
