import { ApiError, apiRequest, safeApiGet } from '$lib/server/api';
import type {
	PersonalRunEntry,
	PlayerAchievement,
	PlayerFollow,
	PlayerSocialContext,
	ScopedPlayerRanks,
	VerifiedRecordHistoryEntry
} from '$lib/features/player-profile/contracts';
import type { PerformanceHistory, PlayerBadge, UserRecords } from '$lib/types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, cookies, parent }) => {
	const id = encodeURIComponent(params.id);
	const token = cookies.get('zr_session');
	const { user: viewer } = await parent();
	const [records, performanceHistory, history, achievements, ranks, socialContext, badges] =
		await Promise.all([
			safeApiGet<UserRecords>(fetch, `/users/${id}/records?page=0`),
			safeApiGet<PerformanceHistory>(fetch, `/users/${id}/performance-history`),
			safeApiGet<{ entries: VerifiedRecordHistoryEntry[] }>(fetch, `/users/${id}/history?page=0`),
			safeApiGet<PlayerAchievement[]>(fetch, `/users/${id}/achievements`),
			safeApiGet<ScopedPlayerRanks>(fetch, `/users/${id}/ranks`),
			safeApiGet<PlayerSocialContext>(fetch, `/users/${id}/social-context`),
			safeApiGet<PlayerBadge[]>(fetch, `/users/${id}/badges`)
		]);
	if (records.status === 404) error(404, 'Player not found');
	let personalRuns: { entries: PersonalRunEntry[] } | null = null;
	let isFollowing = false;
	if (records.data) {
		try {
			personalRuns = await apiRequest<{ entries: PersonalRunEntry[] }>(
				fetch,
				`/users/${id}/personal-runs`,
				{},
				token
			);
		} catch {
			// Private and follower-only runs are intentionally hidden when unavailable.
		}
		if (token && viewer?.id !== params.id) {
			try {
				const follows = await apiRequest<PlayerFollow[]>(fetch, '/me/follows?type=user', {}, token);
				isFollowing = follows.some(
					(follow) => follow.targetType === 'user' && follow.targetId === params.id
				);
			} catch {
				// Profile remains public if social state is unavailable.
			}
		}
	}
	return {
		records: records.data,
		performanceHistory: performanceHistory.data,
		history: history.data?.entries ?? [],
		personalRuns: personalRuns?.entries ?? [],
		achievements: achievements.data ?? [],
		ranks: ranks.data ?? { games: [], categories: [] },
		socialContext: socialContext.data ?? { clan: null, frequentTeams: [] },
		badges: badges.data ?? [],
		viewer,
		isFollowing,
		apiUnavailable:
			records.unavailable ||
			performanceHistory.unavailable ||
			history.unavailable ||
			achievements.unavailable ||
			ranks.unavailable ||
			socialContext.unavailable ||
			badges.unavailable
	};
};

export const actions: Actions = {
	pinRecord: async ({ fetch, params, cookies, request }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=/players/${encodeURIComponent(params.id)}`);
		const form = await request.formData();
		const submissionId = Number(form.get('submissionId'));
		const pinned = form.get('pinned') === 'true';
		if (!Number.isSafeInteger(submissionId) || submissionId < 1) {
			return fail(400, { message: 'Invalid record.' });
		}
		try {
			await apiRequest(
				fetch,
				`/me/pinned-records/${submissionId}`,
				{ method: pinned ? 'DELETE' : 'PUT' },
				token
			);
			return { success: true };
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message: error instanceof ApiError ? error.message : 'Pinned records could not be updated.'
			});
		}
	},
	follow: async ({ fetch, params, cookies, request }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=/players/${params.id}`);
		const form = await request.formData();
		const following = form.get('following') === 'true';
		try {
			if (following) {
				await apiRequest(
					fetch,
					`/me/follows/user/${encodeURIComponent(params.id)}`,
					{ method: 'DELETE' },
					token
				);
			} else {
				await apiRequest(
					fetch,
					'/me/follows',
					{ method: 'POST', body: JSON.stringify({ targetType: 'user', targetId: params.id }) },
					token
				);
			}
			return { success: true };
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message: error instanceof ApiError ? error.message : 'Follow state could not be updated.'
			});
		}
	}
};
