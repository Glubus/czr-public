import {
	isHttpUrl,
	mutateDashboardResource as mutate,
	parseFormDuration as parseDuration,
	positiveFormInteger as positiveInteger,
	requireDashboardToken as requireToken
} from './server-actions';
import { fail } from '@sveltejs/kit';
import type { Actions } from '../../../routes/me/$types';

export const personalActions = {
	invitation: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = String(form.get('status'));
		if (!Number.isInteger(id) || !['accepted', 'rejected'].includes(status)) {
			return fail(400, { message: 'Invalid invitation response.' });
		}
		return mutate(fetch, `/me/participation-invitations/${id}`, 'PATCH', { status }, token);
	},
	readAll: ({ cookies, fetch }) =>
		mutate(
			fetch,
			'/me/notifications/read-all',
			'POST',
			{},
			requireToken(cookies.get('zr_session'))
		),
	readNotification: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id < 1) return fail(400, { message: 'Invalid notification.' });
		return mutate(fetch, `/me/notifications/${id}/read`, 'PATCH', {}, token);
	},
	promoteRun: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id < 1) return fail(400, { message: 'Invalid personal run.' });
		return mutate(fetch, `/me/personal-runs/${id}/promote`, 'POST', {}, token);
	},
	createRun: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const gameId = positiveInteger(form.get('gameId'));
		const mapId = positiveInteger(form.get('mapId'));
		const categoryAssignmentId = positiveInteger(form.get('categoryAssignmentId'));
		const scoreType = String(form.get('scoreType') ?? 'round');
		const score = positiveInteger(form.get('scoreValue'));
		const duration = parseDuration(String(form.get('duration') ?? ''));
		const proofUrl = String(form.get('proofUrl') ?? '').trim();
		const visibility = String(form.get('visibility') ?? 'private');
		const notes = String(form.get('notes') ?? '').trim();
		if (!gameId || !mapId || !categoryAssignmentId) {
			return fail(400, { message: 'Choose a game, map, and category.' });
		}
		if (!['private', 'followers', 'public'].includes(visibility)) {
			return fail(400, { message: 'Choose a valid visibility.' });
		}
		if (proofUrl && !isHttpUrl(proofUrl)) {
			return fail(400, { message: 'Proof must be a valid HTTP or HTTPS URL.' });
		}
		const scoreValue = scoreType === 'time' ? duration : score;
		if (!scoreValue) return fail(400, { message: 'Enter a valid result.' });
		return mutate(
			fetch,
			'/me/personal-runs',
			'POST',
			{
				gameId,
				mapId,
				categoryAssignmentId,
				playerCount: 1,
				scoreValue,
				runDurationMs: scoreType === 'time' ? duration : null,
				proofLevel: proofUrl ? 'manual_video' : null,
				proofUrl: proofUrl || null,
				visibility,
				notes: notes || null
			},
			token
		);
	},
	deleteRun: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const id = positiveInteger((await request.formData()).get('id'));
		if (!id) return fail(400, { message: 'Invalid personal run.' });
		return mutate(fetch, `/me/personal-runs/${id}`, 'DELETE', undefined, token);
	},
	goal: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const metric = String(form.get('metric'));
		const boardMetric = ['round', 'time', 'rank'].includes(metric);
		const targetValue =
			metric === 'time'
				? parseDuration(String(form.get('targetTime') ?? ''))
				: Number(form.get('targetValue'));
		const dueAt = String(form.get('dueAt') ?? '').trim();
		if (
			!title ||
			!['performance_points', 'verified_submissions', 'round', 'time', 'rank'].includes(metric) ||
			!targetValue ||
			targetValue <= 0
		) {
			return fail(400, { message: 'Enter a valid goal.' });
		}
		const gameId = positiveInteger(form.get('gameId'));
		const mapId = positiveInteger(form.get('mapId'));
		const categoryAssignmentId = positiveInteger(form.get('categoryAssignmentId'));
		const playerCount = positiveInteger(form.get('playerCount'));
		if (boardMetric && (!gameId || !mapId || !categoryAssignmentId || !playerCount)) {
			return fail(400, { message: 'Choose the exact board for this goal.' });
		}
		return mutate(
			fetch,
			'/me/goals',
			'POST',
			{
				title,
				metric,
				targetValue,
				dueAt: dueAt ? new Date(`${dueAt}T23:59:59Z`).toISOString() : null,
				...(boardMetric ? { gameId, mapId, categoryAssignmentId, playerCount } : {})
			},
			token
		);
	},
	goalStatus: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const id = positiveInteger(form.get('id'));
		const status = String(form.get('status') ?? '');
		if (!id || !['active', 'abandoned'].includes(status)) {
			return fail(400, { message: 'Invalid goal update.' });
		}
		return mutate(fetch, `/me/goals/${id}`, 'PATCH', { status }, token);
	}
} satisfies Partial<Actions>;
