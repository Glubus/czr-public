import { ApiError, apiFetch } from '$lib/server/api';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, fetch, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		if (!email) return fail(400, { email, message: 'Enter your email.' });

		try {
			await apiFetch(fetch, '/auth/request-password-reset', {
				method: 'POST',
				body: JSON.stringify({ email, redirectTo: `${url.origin}/reset-password` })
			});
			return { success: true, email };
		} catch (error) {
			const message =
				error instanceof ApiError ? error.message : 'Password reset is temporarily unavailable.';
			return fail(error instanceof ApiError ? error.status : 502, { email, message });
		}
	}
};
