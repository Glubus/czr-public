import { ApiError, apiFetch } from '$lib/server/api';
import { safeRedirectPath } from '$lib/server/redirect';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, fetch, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!email || !password) return fail(400, { email, message: 'Enter your email and password.' });

		try {
			const response = await apiFetch(fetch, '/auth/sign-in', {
				method: 'POST',
				body: JSON.stringify({ email, password })
			});
			const token = response.headers.get('set-auth-token');
			if (!token) return fail(502, { email, message: 'Sign in is temporarily unavailable.' });

			cookies.set('zr_session', token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				maxAge: 60 * 60 * 24 * 30
			});
		} catch (error) {
			const message =
				error instanceof ApiError ? error.message : 'Sign in is temporarily unavailable.';
			return fail(error instanceof ApiError ? error.status : 502, { email, message });
		}

		const next = url.searchParams.get('next');
		redirect(303, safeRedirectPath(next));
	}
};
