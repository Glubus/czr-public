import { ApiError, apiFetch } from '$lib/server/api';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	validToken: Boolean(url.searchParams.get('token'))
});

export const actions: Actions = {
	default: async ({ request, fetch, url }) => {
		const token = url.searchParams.get('token');
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirmation = String(form.get('confirmation') ?? '');
		if (!token) return fail(400, { message: 'This reset link is invalid.' });
		if (password.length < 8) return fail(400, { message: 'Use at least 8 characters.' });
		if (password !== confirmation) return fail(400, { message: 'Passwords do not match.' });

		try {
			await apiFetch(fetch, '/auth/reset-password', {
				method: 'POST',
				body: JSON.stringify({ token, newPassword: password })
			});
			return { success: true };
		} catch (error) {
			const message = error instanceof ApiError ? error.message : 'This reset link has expired.';
			return fail(error instanceof ApiError ? error.status : 502, { message });
		}
	}
};
