import { ApiError, apiRequest, safeApiGet } from '$lib/server/api';
import type { GameCollection, SubmissionGroupResult } from '$lib/types';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type SubmissionEntryInput = {
	categoryAssignmentId: number;
	scoreValue: number;
	runDurationMs: number | null;
};

export const load: PageServerLoad = async ({ cookies, fetch }) => {
	if (!cookies.get('zr_session')) redirect(303, '/login?next=/submit');
	const games = await safeApiGet<GameCollection>(fetch, '/games?page=0');
	return { games: games.data?.entries ?? [], apiUnavailable: games.unavailable };
};

export const actions: Actions = {
	default: async ({ request, fetch, cookies }) => {
		const token = cookies.get('zr_session');
		if (!token) redirect(303, '/login?next=/submit');
		const form = await request.formData();
		const gameId = positiveInteger(form.get('gameId'));
		const mapId = positiveInteger(form.get('mapId'));
		const proofUrl = String(form.get('proofUrl') ?? '').trim();
		let entries: SubmissionEntryInput[];
		let teammateIds: string[];

		try {
			entries = JSON.parse(String(form.get('entries') ?? '[]')) as SubmissionEntryInput[];
			teammateIds = JSON.parse(String(form.get('teammateIds') ?? '[]')) as string[];
		} catch {
			return fail(400, { message: 'The submission data is malformed.' });
		}

		if (!gameId || !mapId) return fail(400, { message: 'Choose a game and map.' });
		if (!Array.isArray(entries) || entries.length < 1 || entries.length > 5) {
			return fail(400, { message: 'Choose between one and five categories.' });
		}
		if (
			entries.some(
				(entry) =>
					!Number.isInteger(entry.categoryAssignmentId) ||
					!Number.isInteger(entry.scoreValue) ||
					entry.scoreValue < 1 ||
					(entry.runDurationMs !== null &&
						(!Number.isInteger(entry.runDurationMs) || entry.runDurationMs < 1))
			)
		) {
			return fail(400, { message: 'Every selected category needs a valid score.' });
		}
		if (!proofUrl || !isHttpUrl(proofUrl)) {
			return fail(400, { message: 'Add a valid HTTP or HTTPS video proof URL.' });
		}
		if (!Array.isArray(teammateIds) || teammateIds.some((id) => typeof id !== 'string')) {
			return fail(400, { message: 'The teammate list is malformed.' });
		}
		teammateIds = [...new Set(teammateIds)].filter(Boolean);
		if (teammateIds.length > 3)
			return fail(400, { message: 'A run can include at most four players.' });

		try {
			const session = await apiRequest<{ user: { id: string } }>(fetch, '/auth/session', {}, token);
			const provider = videoProvider(proofUrl);
			const result = await apiRequest<SubmissionGroupResult>(
				fetch,
				'/submission-groups',
				{
					method: 'POST',
					body: JSON.stringify({
						gameId,
						mapId,
						participantUserIds: [session.user.id, ...teammateIds],
						proofLevel: 'manual_video',
						proofUrl,
						proofs: [{ type: 'video', sourceUrl: proofUrl, provider }],
						platform: nullableText(form.get('platform')),
						gameVersion: nullableText(form.get('gameVersion')),
						mapVersion: nullableText(form.get('mapVersion')),
						modId: positiveInteger(form.get('modId')),
						modVersion: nullableText(form.get('modVersion')),
						entries
					})
				},
				token
			);
			return { success: true, result };
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message:
					error instanceof ApiError ? error.message : 'Submission is temporarily unavailable.'
			});
		}
	}
};

function positiveInteger(value: FormDataEntryValue | null): number | null {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : null;
}

function nullableText(value: FormDataEntryValue | null): string | null {
	const text = String(value ?? '').trim();
	return text || null;
}

function isHttpUrl(value: string): boolean {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

function videoProvider(value: string): 'youtube' | 'twitch' | 'direct' | 'other' {
	const hostname = new URL(value).hostname.toLowerCase();
	if (hostname.includes('youtube.com') || hostname === 'youtu.be') return 'youtube';
	if (hostname.includes('twitch.tv')) return 'twitch';
	if (/\.(mp4|webm|mov)$/i.test(new URL(value).pathname)) return 'direct';
	return 'other';
}
