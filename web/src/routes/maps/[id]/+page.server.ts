import { safeApiGet } from '$lib/server/api';
import { isFollowing, toggleFollow } from '$lib/server/follows';
import type { CategoryForMap, MapDetail } from '$lib/types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, cookies }) => {
	const id = encodeURIComponent(params.id);
	const [map, categories] = await Promise.all([
		safeApiGet<MapDetail>(fetch, `/maps/${id}`),
		safeApiGet<CategoryForMap[]>(fetch, `/maps/${id}/categories`)
	]);
	const uniqueCategories = [
		...new Map((categories.data ?? []).map((category) => [category.id, category])).values()
	];
	if (map.status === 404) error(404, 'Map not found');
	return {
		map: map.data,
		categories: uniqueCategories,
		isFollowing: map.data
			? await isFollowing(fetch, cookies.get('zr_session'), 'map', String(map.data.id))
			: false,
		authenticated: Boolean(cookies.get('zr_session')),
		apiUnavailable: map.unavailable || categories.unavailable
	};
};

export const actions: Actions = {
	follow: async ({ request, cookies, fetch, params }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=/maps/${encodeURIComponent(params.id)}`);
		const form = await request.formData();
		const targetId = String(form.get('targetId') ?? '');
		if (!targetId) return fail(400, { message: 'Invalid map.' });
		return toggleFollow(fetch, token, 'map', targetId, form.get('following') === 'true');
	}
};
