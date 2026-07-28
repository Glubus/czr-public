import { resolve } from '$app/paths';
import type { CategoryForMap, GameMod, MapResult, Player } from '$lib/types';

export type SubmissionMap = MapResult & {
	mode: string | null;
	contentType: 'zombies' | 'non_zombies';
};

type CatalogResponse<T> = { entries: T[]; unavailable?: boolean };

async function requestCatalog<T>(
	fetcher: typeof fetch,
	parameters: URLSearchParams,
	signal?: AbortSignal
): Promise<CatalogResponse<T>> {
	const response = await fetcher(`${resolve('/submit/catalog')}?${parameters}`, { signal });
	if (!response.ok) throw new Error(`Catalog request failed with status ${response.status}`);
	return (await response.json()) as CatalogResponse<T>;
}

export function loadGameMaps(fetcher: typeof fetch, gameSlug: string) {
	return requestCatalog<SubmissionMap>(
		fetcher,
		new URLSearchParams({ kind: 'maps', game: gameSlug })
	);
}

export function loadGameMods(fetcher: typeof fetch, gameSlug: string) {
	return requestCatalog<GameMod>(fetcher, new URLSearchParams({ kind: 'mods', game: gameSlug }));
}

export function loadMapCategories(fetcher: typeof fetch, mapId: string) {
	return requestCatalog<CategoryForMap>(
		fetcher,
		new URLSearchParams({ kind: 'categories', mapId })
	);
}

export function searchCatalogPlayers(fetcher: typeof fetch, query: string, signal?: AbortSignal) {
	return requestCatalog<Player>(
		fetcher,
		new URLSearchParams({ kind: 'players', q: query }),
		signal
	);
}
