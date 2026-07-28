import { ApiError, apiRequest } from '$lib/server/api';
import type { UserCollection } from '$lib/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, fetch, url }) => {
	const token = cookies.get('zr_session');
	if (!token) return json({ entries: [], unavailable: false }, { status: 401 });

	const query = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	if (query.length < 2) return json({ entries: [], unavailable: false });

	try {
		const users = await apiRequest<UserCollection>(
			fetch,
			`/users?search=${encodeURIComponent(query)}&page=0`,
			{},
			token
		);
		return json({
			entries: users.entries
				.filter((player) => player.isClaimable)
				.slice(0, 8)
				.map(({ id, name, image, performancePoints }) => ({ id, name, image, performancePoints })),
			unavailable: false
		});
	} catch (error) {
		return json(
			{ entries: [], unavailable: true },
			{ status: error instanceof ApiError ? error.status : 502 }
		);
	}
};
