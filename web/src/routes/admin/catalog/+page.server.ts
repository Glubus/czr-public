import { ApiError, apiRequest, safeApiGet } from '$lib/server/api';
import type {
	CategoryAssignmentCollection,
	CategoryDefinition,
	Game,
	GameCollection,
	MapCollection,
	MapResult
} from '$lib/types';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async ({ fetch, cookies, parent, url }) => {
	const token = cookies.get('zr_session');
	const { user } = await parent();
	if (!token || !user) redirect(303, '/login?next=/admin/catalog');
	if (!user.roles.includes('ROLE_ADMIN')) redirect(303, '/admin');

	const assignmentPage = normalPage(url.searchParams.get('assignmentPage'));
	const [gamesResult, mapsResult, categoriesResult, assignmentsResult] = await Promise.all([
		loadAllGames(fetch),
		loadAllMaps(fetch),
		safeAdminGet<CategoryDefinition[]>(fetch, '/admin/categories', token),
		safeAdminGet<CategoryAssignmentCollection>(
			fetch,
			`/admin/category-assignments?page=${assignmentPage}`,
			token
		)
	]);

	return {
		games: gamesResult.entries,
		maps: mapsResult.entries,
		categories: categoriesResult.data ?? [],
		assignments: assignmentsResult.data ?? {
			page: assignmentPage,
			pageSize: 50 as const,
			hasMore: false,
			entries: []
		},
		apiUnavailable:
			gamesResult.unavailable ||
			mapsResult.unavailable ||
			categoriesResult.unavailable ||
			assignmentsResult.unavailable
	};
};

export const actions: Actions = {
	game: async (event) => {
		const form = await event.request.formData();
		return mutate(event, '/admin/games', {
			slug: text(form, 'slug'),
			name: text(form, 'name'),
			shortName: text(form, 'shortName'),
			studio: text(form, 'studio'),
			gameType: text(form, 'gameType'),
			releaseYear: optionalNumber(form, 'releaseYear')
		});
	},
	updateGame: async (event) => {
		const form = await event.request.formData();
		const id = positiveId(form, 'id');
		if (id instanceof Error) return fail(400, { message: id.message });
		return mutate(
			event,
			`/admin/games/${id}`,
			{
				name: text(form, 'name'),
				shortName: text(form, 'shortName'),
				studio: text(form, 'studio'),
				gameType: text(form, 'gameType'),
				releaseYear: nullableNumber(form, 'releaseYear'),
				isActive: form.has('isActive')
			},
			'PATCH'
		);
	},
	map: async (event) => {
		const form = await event.request.formData();
		return mutate(event, '/admin/maps', {
			gameId: number(form, 'gameId'),
			slug: text(form, 'slug'),
			name: text(form, 'name'),
			type: text(form, 'type'),
			status: text(form, 'status'),
			authors: commaList(form, 'authors'),
			sources: []
		});
	},
	updateMap: async (event) => {
		const form = await event.request.formData();
		const id = positiveId(form, 'id');
		if (id instanceof Error) return fail(400, { message: id.message });
		return mutate(
			event,
			`/admin/maps/${id}`,
			{
				name: text(form, 'name'),
				status: text(form, 'status')
			},
			'PATCH'
		);
	},
	mapStatus: async (event) => {
		const form = await event.request.formData();
		const id = positiveId(form, 'id');
		if (id instanceof Error) return fail(400, { message: id.message });
		return mutate(event, `/admin/maps/${id}/status`, { status: text(form, 'status') }, 'PATCH');
	},
	category: async (event) => {
		const form = await event.request.formData();
		const rules = jsonObject(form, 'rules');
		if (rules instanceof Error) return fail(400, { message: rules.message });
		return mutate(event, '/admin/categories', {
			slug: text(form, 'slug'),
			name: text(form, 'name'),
			scoreType: text(form, 'scoreType'),
			rankingDirection: text(form, 'rankingDirection'),
			rules
		});
	},
	updateCategory: async (event) => {
		const form = await event.request.formData();
		const id = positiveId(form, 'id');
		const rules = jsonObject(form, 'rules');
		if (id instanceof Error) return fail(400, { message: id.message });
		if (rules instanceof Error) return fail(400, { message: rules.message });
		return mutate(event, `/admin/categories/${id}`, { name: text(form, 'name'), rules }, 'PATCH');
	},
	deleteCategory: async (event) => {
		const form = await event.request.formData();
		const id = positiveId(form, 'id');
		if (id instanceof Error) return fail(400, { message: id.message });
		if (text(form, 'confirmation') !== 'DELETE') {
			return fail(400, { message: 'Type DELETE to remove an unused category.' });
		}
		return mutate(event, `/admin/categories/${id}`, undefined, 'DELETE');
	},
	assignment: async (event) => {
		const form = await event.request.formData();
		const specificRules = jsonObject(form, 'specificRules');
		if (specificRules instanceof Error) return fail(400, { message: specificRules.message });
		return mutate(event, '/admin/category-assignments', {
			categoryId: number(form, 'categoryId'),
			gameId: number(form, 'gameId'),
			mapId: optionalNumber(form, 'mapId'),
			specificRules
		});
	},
	updateAssignment: async (event) => {
		const form = await event.request.formData();
		const id = positiveId(form, 'id');
		const specificRules = jsonObject(form, 'specificRules');
		if (id instanceof Error) return fail(400, { message: id.message });
		if (specificRules instanceof Error) return fail(400, { message: specificRules.message });
		return mutate(event, `/admin/category-assignments/${id}`, { specificRules }, 'PATCH');
	},
	deleteAssignment: async (event) => {
		const form = await event.request.formData();
		const id = positiveId(form, 'id');
		if (id instanceof Error) return fail(400, { message: id.message });
		if (text(form, 'confirmation') !== 'DELETE') {
			return fail(400, { message: 'Type DELETE to remove an unused assignment.' });
		}
		return mutate(event, `/admin/category-assignments/${id}`, undefined, 'DELETE');
	}
};

async function mutate(
	event: RequestEvent,
	path: string,
	body?: Record<string, unknown>,
	method: 'POST' | 'PATCH' | 'DELETE' = 'POST'
) {
	const token = event.cookies.get('zr_session');
	if (!token) redirect(303, '/login?next=/admin/catalog');
	try {
		await apiRequest(
			event.fetch,
			path,
			{ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
			token
		);
		return { success: true, message: 'Catalogue changes saved.' };
	} catch (error) {
		return fail(error instanceof ApiError ? error.status : 502, {
			message:
				error instanceof ApiError ? error.message : 'The catalogue change could not be saved.'
		});
	}
}

async function loadAllGames(fetcher: typeof fetch) {
	const entries: Game[] = [];
	for (let page = 0; page < 100; page += 1) {
		const result = await safeApiGet<GameCollection>(fetcher, `/games?page=${page}`);
		if (!result.data) return { entries, unavailable: true };
		entries.push(...result.data.entries);
		if (!result.data.hasMore) return { entries, unavailable: false };
	}
	return { entries, unavailable: false };
}

async function loadAllMaps(fetcher: typeof fetch) {
	const entries: MapResult[] = [];
	for (let page = 0; page < 100; page += 1) {
		const result = await safeApiGet<MapCollection>(fetcher, `/maps?page=${page}`);
		if (!result.data) return { entries, unavailable: true };
		entries.push(...result.data.entries);
		if (!result.data.hasMore) return { entries, unavailable: false };
	}
	return { entries, unavailable: false };
}

async function safeAdminGet<T>(fetcher: typeof fetch, path: string, token: string) {
	try {
		return { data: await apiRequest<T>(fetcher, path, {}, token), unavailable: false };
	} catch {
		return { data: null, unavailable: true };
	}
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const number = (form: FormData, name: string) => Number(form.get(name));
const optionalNumber = (form: FormData, name: string) => {
	const value = text(form, name);
	return value ? Number(value) : undefined;
};
const nullableNumber = (form: FormData, name: string) => {
	const value = text(form, name);
	return value ? Number(value) : null;
};
const commaList = (form: FormData, name: string) =>
	text(form, name)
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);

function positiveId(form: FormData, name: string): number | Error {
	const value = text(form, name);
	if (!/^[1-9][0-9]*$/.test(value)) return new Error(`${name} must be a positive integer.`);
	const id = Number(value);
	return Number.isSafeInteger(id) ? id : new Error(`${name} must be a positive integer.`);
}

function normalPage(value: string | null) {
	return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : 0;
}

function jsonObject(form: FormData, name: string): Record<string, unknown> | Error {
	try {
		const value = JSON.parse(text(form, name) || '{}');
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: new Error(`${name} must be a JSON object.`);
	} catch {
		return new Error(`${name} must contain valid JSON.`);
	}
}
