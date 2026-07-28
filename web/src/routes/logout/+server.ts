import { apiFetch } from '$lib/server/api';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, fetch }) => {
	const token = cookies.get('zr_session');
	if (token) {
		try {
			await apiFetch(fetch, '/auth/sign-out', { method: 'POST', body: '{}' }, token);
		} catch {
			// The local session must still be cleared if the API session already expired.
		}
	}
	cookies.delete('zr_session', { path: '/' });
	redirect(303, '/');
};
