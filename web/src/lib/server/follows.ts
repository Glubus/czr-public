import { fail } from '@sveltejs/kit';
import { ApiError, apiRequest } from './api';

type Follow = { targetType: string; targetId: string };

export async function isFollowing(
	fetcher: typeof fetch,
	token: string | undefined,
	targetType: string,
	targetId: string
) {
	if (!token) return false;
	try {
		const follows = await apiRequest<Follow[]>(
			fetcher,
			`/me/follows?type=${encodeURIComponent(targetType)}`,
			{},
			token
		);
		return follows.some(
			(follow) => follow.targetType === targetType && follow.targetId === targetId
		);
	} catch {
		return false;
	}
}

export async function toggleFollow(
	fetcher: typeof fetch,
	token: string,
	targetType: string,
	targetId: string,
	following: boolean
) {
	try {
		await apiRequest(
			fetcher,
			following
				? `/me/follows/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`
				: '/me/follows',
			following
				? { method: 'DELETE' }
				: { method: 'POST', body: JSON.stringify({ targetType, targetId }) },
			token
		);
		return { success: true };
	} catch (error) {
		return fail(error instanceof ApiError ? error.status : 502, {
			message: error instanceof ApiError ? error.message : 'Follow state could not be updated.'
		});
	}
}
