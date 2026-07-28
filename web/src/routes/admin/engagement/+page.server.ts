import { ApiError, apiRequest, safeApiGet } from '$lib/server/api';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

type Achievement = {
	id: number;
	slug: string;
	name: string;
	description: string;
	metric: string;
	threshold: number;
	category: string;
	series: string;
	tier: number;
	points: number;
};
type Challenge = {
	id: number;
	slug: string;
	name: string;
	description: string;
	metric: string;
	targetValue: number;
	startsAt: string;
	endsAt: string;
};

export const load: PageServerLoad = async ({ fetch, cookies, parent }) => {
	const token = cookies.get('zr_session');
	const { user } = await parent();
	if (!token || !user) redirect(303, '/login?next=/admin/engagement');
	if (!user.roles.includes('ROLE_ADMIN')) redirect(303, '/admin');
	const [achievements, challenges] = await Promise.all([
		safeApiGet<Achievement[]>(fetch, '/achievements'),
		safeApiGet<Challenge[]>(fetch, '/challenges')
	]);
	return {
		achievements: achievements.data ?? [],
		challenges: challenges.data ?? [],
		apiUnavailable: achievements.unavailable || challenges.unavailable
	};
};

export const actions: Actions = {
	achievement: async (event) => {
		const form = await event.request.formData();
		return create(event, '/admin/achievements', {
			slug: text(form, 'slug'),
			name: text(form, 'name'),
			description: text(form, 'description'),
			metric: text(form, 'metric'),
			threshold: Number(form.get('threshold')),
			direction: text(form, 'direction'),
			category: text(form, 'category'),
			series: text(form, 'series'),
			tier: Number(form.get('tier')),
			points: Number(form.get('points'))
		});
	},
	challenge: async (event) => {
		const form = await event.request.formData();
		const startsAt = dateTime(form, 'startsAt');
		const endsAt = dateTime(form, 'endsAt');
		if (!startsAt || !endsAt) return fail(400, { message: 'Choose a valid challenge window.' });
		return create(event, '/admin/challenges', {
			slug: text(form, 'slug'),
			name: text(form, 'name'),
			description: text(form, 'description'),
			metric: text(form, 'metric'),
			targetValue: Number(form.get('targetValue')),
			startsAt,
			endsAt
		});
	}
};

async function create(event: RequestEvent, path: string, body: Record<string, unknown>) {
	const token = event.cookies.get('zr_session');
	if (!token) redirect(303, '/login?next=/admin/engagement');
	try {
		await apiRequest(event.fetch, path, { method: 'POST', body: JSON.stringify(body) }, token);
		return { success: true };
	} catch (error) {
		return fail(error instanceof ApiError ? error.status : 502, {
			message:
				error instanceof ApiError ? error.message : 'The engagement definition could not be saved.'
		});
	}
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
function dateTime(form: FormData, name: string): string | null {
	const value = text(form, name);
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
