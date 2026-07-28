import { ApiError, apiRequest } from '$lib/server/api';
import type { PlayerBadge, SubmissionCollection } from '$lib/types';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type Overview = {
	submissions: Record<string, number>;
	profileClaims: Record<string, number>;
	oldestPendingSubmission: { id: number; submittedAt: string } | null;
};

export const actions: Actions = {
	createBadge: async ({ cookies, fetch, request }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, '/login?next=/admin');
		const form = await request.formData();
		try {
			await apiRequest(
				fetch,
				'/admin/badges',
				{
					method: 'POST',
					body: JSON.stringify({
						slug: String(form.get('slug') ?? '').trim(),
						name: String(form.get('name') ?? '').trim(),
						description: String(form.get('description') ?? '').trim(),
						color: String(form.get('color') ?? '#e45735')
					})
				},
				token
			);
			return { success: true };
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message: error instanceof ApiError ? error.message : 'The badge could not be created.'
			});
		}
	},
	setBadge: async ({ cookies, fetch, request }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, '/login?next=/admin');
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const badgeId = Number(form.get('badgeId'));
		const operation = String(form.get('operation'));
		if (!userId || !Number.isInteger(badgeId) || !['assign', 'remove'].includes(operation)) {
			return fail(400, { message: 'Select a player, a badge, and an operation.' });
		}
		try {
			await apiRequest(
				fetch,
				`/admin/users/${encodeURIComponent(userId)}/badges/${badgeId}`,
				{ method: operation === 'assign' ? 'PUT' : 'DELETE' },
				token
			);
			return { success: true };
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message: error instanceof ApiError ? error.message : 'The badge could not be updated.'
			});
		}
	},
	claim: async ({ cookies, fetch, request }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, '/login?next=/admin');
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = String(form.get('status'));
		const reviewNote = String(form.get('reviewNote') ?? '').trim();
		if (!Number.isInteger(id) || !['approved', 'rejected'].includes(status)) {
			return fail(400, { message: 'Invalid profile claim decision.' });
		}
		if (status === 'rejected' && !reviewNote) {
			return fail(400, { message: 'A rejection reason is required.' });
		}
		try {
			const payload = reviewNote ? { status, reviewNote } : { status };
			await apiRequest(
				fetch,
				`/admin/profile-claims/${id}/status`,
				{ method: 'PATCH', body: JSON.stringify(payload) },
				token
			);
			return { success: true, claimId: id, status };
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message: error instanceof ApiError ? error.message : 'The claim review could not be saved.'
			});
		}
	}
};
type Claim = {
	id: number;
	claimantUserId: string;
	profileUserId: string | null;
	profileExternalId: string;
	proofUrl: string;
	message: string | null;
	status: string;
	createdAt: string;
};

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
	const token = cookies.get('zr_session');
	const { user } = await parent();
	if (!token || !user) redirect(303, '/login?next=/admin');
	if (!user.roles.some((role) => ['ROLE_ADMIN', 'ROLE_MODERATOR', 'ROLE_CHECKER'].includes(role))) {
		redirect(303, '/');
	}
	const requestedStatus = url.searchParams.get('status') ?? 'pending';
	const status = ['pending', 'awaiting_participants', 'verified', 'rejected'].includes(
		requestedStatus
	)
		? requestedStatus
		: 'pending';
	try {
		const isAdmin = user.roles.includes('ROLE_ADMIN');
		const [overview, queue, claims, badges] = await Promise.all([
			apiRequest<Overview>(fetch, '/admin/moderation/overview', {}, token),
			apiRequest<SubmissionCollection>(
				fetch,
				`/admin/submissions?status=${status}&page=0`,
				{},
				token
			),
			user.roles.some((role) => ['ROLE_ADMIN', 'ROLE_MODERATOR'].includes(role))
				? apiRequest<Claim[]>(fetch, '/admin/profile-claims?status=pending', {}, token)
				: Promise.resolve([]),
			isAdmin ? apiRequest<PlayerBadge[]>(fetch, '/admin/badges', {}, token) : Promise.resolve([])
		]);
		return {
			overview,
			queue,
			claims,
			badges,
			canManageBadges: isAdmin,
			status,
			apiUnavailable: false
		};
	} catch (error) {
		if (error instanceof ApiError && error.status === 403) redirect(303, '/');
		return {
			overview: null,
			queue: null,
			claims: [],
			badges: [],
			canManageBadges: false,
			status,
			apiUnavailable: true
		};
	}
};
