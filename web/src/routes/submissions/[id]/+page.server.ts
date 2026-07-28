import { ApiError, apiRequest, safeApiGet } from '$lib/server/api';
import type { SubmissionDetail } from '$lib/types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type RecordComment = {
	id: number;
	parentId: number | null;
	body: string;
	createdAt: string;
	updatedAt: string;
	upvotes: number;
	downvotes: number;
	score: number;
	viewerVote: number;
	author: { id: string; name: string; image: string | null };
};

export const load: PageServerLoad = async ({ fetch, params, parent }) => {
	const id = encodeURIComponent(params.id);
	const [result, comments, parentData] = await Promise.all([
		safeApiGet<SubmissionDetail>(fetch, `/submissions/${id}`),
		safeApiGet<RecordComment[]>(fetch, `/submissions/${id}/comments`),
		parent()
	]);
	if (result.status === 404) error(404, 'Submission not found');
	return {
		detail: result.data,
		comments: comments.data ?? [],
		viewer: parentData.user,
		apiUnavailable: result.unavailable || comments.unavailable
	};
};

export const actions: Actions = {
	comment: async ({ request, cookies, fetch, params }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=/submissions/${encodeURIComponent(params.id)}`);
		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();
		const rawParentId = String(form.get('parentId') ?? '').trim();
		const parentId = rawParentId ? Number(rawParentId) : null;
		if (!body || body.length > 2_000) {
			return fail(400, { message: 'Comment must contain between 1 and 2,000 characters.' });
		}
		if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
			return fail(400, { message: 'Invalid parent comment.' });
		}
		try {
			await apiRequest(
				fetch,
				`/submissions/${encodeURIComponent(params.id)}/comments`,
				{ method: 'POST', body: JSON.stringify({ body, parentId }) },
				token
			);
			return { success: true, message: 'Comment posted.' };
		} catch (cause) {
			return fail(cause instanceof ApiError ? cause.status : 502, {
				message: cause instanceof ApiError ? cause.message : 'Comment could not be posted.'
			});
		}
	},
	voteComment: async ({ request, cookies, fetch, params }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=/submissions/${encodeURIComponent(params.id)}`);
		const form = await request.formData();
		const commentId = Number(form.get('commentId'));
		const value = Number(form.get('value'));
		if (!Number.isInteger(commentId) || commentId <= 0 || ![-1, 0, 1].includes(value)) {
			return fail(400, { message: 'Invalid vote.' });
		}
		try {
			await apiRequest(
				fetch,
				`/submissions/${encodeURIComponent(params.id)}/comments/${commentId}/vote`,
				{ method: 'PUT', body: JSON.stringify({ value }) },
				token
			);
			return { success: true };
		} catch (cause) {
			return fail(cause instanceof ApiError ? cause.status : 502, {
				message: cause instanceof ApiError ? cause.message : 'Vote could not be saved.'
			});
		}
	},
	deleteComment: async ({ request, cookies, fetch, params }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, `/login?next=/submissions/${encodeURIComponent(params.id)}`);
		const form = await request.formData();
		const commentId = Number(form.get('commentId'));
		if (!Number.isInteger(commentId) || commentId <= 0) {
			return fail(400, { message: 'Invalid comment.' });
		}
		try {
			await apiRequest(
				fetch,
				`/submissions/${encodeURIComponent(params.id)}/comments/${commentId}`,
				{ method: 'DELETE' },
				token
			);
			return { success: true, message: 'Comment deleted.' };
		} catch (cause) {
			return fail(cause instanceof ApiError ? cause.status : 502, {
				message: cause instanceof ApiError ? cause.message : 'Comment could not be deleted.'
			});
		}
	}
};
