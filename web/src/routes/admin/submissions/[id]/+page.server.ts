import { ApiError, apiRequest } from '$lib/server/api';
import type { MapLeaderboard, SubmissionDetail } from '$lib/types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, fetch, params, parent }) => {
	const token = cookies.get('zr_session');
	const { user } = await parent();
	if (!token || !user) redirect(303, `/login?next=/admin/submissions/${params.id}`);
	if (!user.roles.some((role) => ['ROLE_ADMIN', 'ROLE_MODERATOR', 'ROLE_CHECKER'].includes(role))) {
		redirect(303, '/');
	}
	try {
		const detail = await apiRequest<SubmissionDetail>(
			fetch,
			`/admin/submissions/${encodeURIComponent(params.id)}`,
			{},
			token
		);
		let leaderboard: MapLeaderboard | null = null;
		if (detail.submission.categoryAssignmentId) {
			try {
				leaderboard = await apiRequest<MapLeaderboard>(
					fetch,
					`/maps/${detail.map.id}/categories/${detail.category.id}/leaderboard?player_count=${detail.submission.playerCount}&assignment_id=${detail.submission.categoryAssignmentId}&page=0`
				);
			} catch {
				// Moderation can continue when no current leaderboard exists.
			}
		}
		return { detail, leaderboard };
	} catch (cause) {
		if (cause instanceof ApiError && cause.status === 404) error(404, 'Submission not found');
		if (cause instanceof ApiError && cause.status === 403) redirect(303, '/');
		error(502, 'Moderation detail is unavailable');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies, fetch, params }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=/admin/submissions/${params.id}`);
		const form = await request.formData();
		const status = String(form.get('status'));
		const reviewNote = String(form.get('reviewNote') ?? '').trim();
		if (!['verified', 'rejected'].includes(status))
			return fail(400, { message: 'Invalid decision.' });
		if (status === 'rejected' && !reviewNote) {
			return fail(400, { message: 'A rejection reason is required.' });
		}
		try {
			await apiRequest(
				fetch,
				`/admin/submissions/${encodeURIComponent(params.id)}/status`,
				{ method: 'PATCH', body: JSON.stringify({ status, reviewNote: reviewNote || null }) },
				token
			);
		} catch (cause) {
			return fail(cause instanceof ApiError ? cause.status : 502, {
				message: cause instanceof ApiError ? cause.message : 'The review could not be saved.'
			});
		}
		redirect(303, `/admin?status=pending&reviewed=${params.id}`);
	}
};
