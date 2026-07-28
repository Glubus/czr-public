import { env } from '$env/dynamic/private';

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

function apiBaseUrl() {
	return (env.API_BASE_URL ?? 'http://localhost:8888/v1').replace(/\/$/, '');
}

export async function apiFetch(
	fetcher: typeof fetch,
	path: string,
	init: RequestInit = {},
	token?: string
): Promise<Response> {
	const headers = new Headers(init.headers);
	headers.set('accept', 'application/json');
	if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
	if (token) headers.set('authorization', `Bearer ${token}`);

	const response = await fetcher(`${apiBaseUrl()}${path}`, { ...init, headers });
	if (!response.ok) {
		let message = 'Something went wrong. Please try again.';
		try {
			const problem = (await response.json()) as { detail?: string; message?: string };
			message = problem.detail ?? problem.message ?? message;
		} catch {
			// Keep the safe public message when the API did not return JSON.
		}
		throw new ApiError(message, response.status);
	}
	return response;
}

export async function apiRequest<T>(
	fetcher: typeof fetch,
	path: string,
	init: RequestInit = {},
	token?: string
): Promise<T> {
	const response = await apiFetch(fetcher, path, init, token);
	return (await response.json()) as T;
}

export function apiGet<T>(fetcher: typeof fetch, path: string): Promise<T> {
	return apiRequest<T>(fetcher, path);
}

export async function safeApiGet<T>(
	fetcher: typeof fetch,
	path: string
): Promise<{ data: T | null; unavailable: boolean; status: number | null }> {
	try {
		return { data: await apiGet<T>(fetcher, path), unavailable: false, status: null };
	} catch (error) {
		return {
			data: null,
			unavailable: true,
			status: error instanceof ApiError ? error.status : null
		};
	}
}
