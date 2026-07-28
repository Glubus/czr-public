import { safeApiGet } from '$lib/server/api';
import type { UserCollection } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, url }) => {
	const query = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	if (query.length < 2) return json({ entries: [], unavailable: false });

	const players = await safeApiGet<UserCollection>(
		fetch,
		`/users?search=${encodeURIComponent(query)}&page=0`
	);
	return json({
		entries: players.data?.entries.slice(0, 12) ?? [],
		unavailable: players.unavailable
	});
};
