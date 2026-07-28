import { ApiError, apiFetch } from '$lib/server/api';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, fetch, cookies, url }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');
		const confirmation = String(form.get('confirmation') ?? '');
		const values = { name, email };

		if (!name || !email || !password)
			return fail(400, { ...values, message: 'Complete every field.' });
		if (password.length < 8) return fail(400, { ...values, message: 'Use at least 8 characters.' });
		if (password !== confirmation)
			return fail(400, { ...values, message: 'Passwords do not match.' });

		try {
			const response = await apiFetch(fetch, '/auth/sign-up', {
				method: 'POST',
				body: JSON.stringify({ name, email, password })
			});
			const token = response.headers.get('set-auth-token');
			if (token) {
				cookies.set('zr_session', token, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					secure: url.protocol === 'https:',
					maxAge: 60 * 60 * 24 * 30
				});
			} else {
				return { success: true, email };
			}
		} catch (error) {
			const message =
				error instanceof ApiError ? error.message : 'Registration is temporarily unavailable.';
			return fail(error instanceof ApiError ? error.status : 502, { ...values, message });
		}

		redirect(303, '/');
	}
};
