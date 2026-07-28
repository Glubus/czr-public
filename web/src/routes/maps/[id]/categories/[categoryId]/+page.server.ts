import { safeApiGet } from '$lib/server/api';
import { isFollowing, toggleFollow } from '$lib/server/follows';
import type { CategoryForMap, MapDetail, MapLeaderboard } from '$lib/types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, url, cookies }) => {
	const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
	const requestedPlayerCount = Number.parseInt(url.searchParams.get('player_count') ?? '1', 10);
	const playerCount = [1, 2, 3, 4].includes(requestedPlayerCount) ? requestedPlayerCount : 1;
	const requestedAssignment = Number.parseInt(url.searchParams.get('assignment_id') ?? '', 10);
	const assignmentQuery = requestedAssignment > 0 ? `&assignment_id=${requestedAssignment}` : '';
	const [map, categories, leaderboard] = await Promise.all([
		safeApiGet<MapDetail>(fetch, `/maps/${encodeURIComponent(params.id)}`),
		safeApiGet<CategoryForMap[]>(fetch, `/maps/${encodeURIComponent(params.id)}/categories`),
		safeApiGet<MapLeaderboard>(
			fetch,
			`/maps/${encodeURIComponent(params.id)}/categories/${encodeURIComponent(params.categoryId)}/leaderboard?page=${page}&player_count=${playerCount}${assignmentQuery}`
		)
	]);
	if (map.status === 404 || leaderboard.status === 404) error(404, 'Leaderboard not found');
	const selectedAssignment = leaderboard.data?.category.assignmentId;
	return {
		map: map.data,
		leaderboard: leaderboard.data,
		variants: (categories.data ?? []).filter(
			(category) => category.id === Number(params.categoryId)
		),
		isFollowing: selectedAssignment
			? await isFollowing(
					fetch,
					cookies.get('zr_session'),
					'map_category',
					`${map.data?.id}:${selectedAssignment}`
				)
			: false,
		authenticated: Boolean(cookies.get('zr_session')),
		page,
		playerCount
	};
};

export const actions: Actions = {
	follow: async ({ request, cookies, fetch, url }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
		const form = await request.formData();
		const targetId = String(form.get('targetId') ?? '');
		if (!/^\d+:\d+$/.test(targetId)) return fail(400, { message: 'Invalid map category.' });
		return toggleFollow(fetch, token, 'map_category', targetId, form.get('following') === 'true');
	}
};
