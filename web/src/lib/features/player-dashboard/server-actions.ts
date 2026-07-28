import { redirect, fail } from '@sveltejs/kit';
import { ApiError, apiRequest } from '$lib/server/api';

export function requireDashboardToken(token: string | undefined): string {
	if (!token) redirect(303, '/login?next=/me');
	return token;
}

export async function mutateDashboardResource(
	fetcher: typeof fetch,
	path: string,
	method: 'POST' | 'PATCH' | 'DELETE',
	body: unknown,
	token: string
) {
	try {
		await apiRequest(
			fetcher,
			path,
			{ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
			token
		);
		return { success: true };
	} catch (error) {
		return fail(error instanceof ApiError ? error.status : 502, {
			message: error instanceof ApiError ? error.message : 'The action is temporarily unavailable.'
		});
	}
}

export function positiveFormInteger(value: FormDataEntryValue | null): number | null {
	const number = Number(value);
	return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function parseFormDuration(value: string): number | null {
	const parts = value.trim().split(':').map(Number);
	if (
		!parts.length ||
		parts.length > 3 ||
		parts.some((part) => !Number.isFinite(part) || part < 0)
	) {
		return null;
	}
	if (parts.some((part, index) => index > 0 && part >= 60)) return null;
	const seconds = parts.reduce((total, part) => total * 60 + part, 0);
	return seconds > 0 ? Math.round(seconds * 1000) : null;
}

export function isHttpUrl(value: string): boolean {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}
