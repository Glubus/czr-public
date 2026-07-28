<script lang="ts">
	import { resolve } from '$app/paths';
	import CountrySelectContent from '$lib/components/CountrySelectContent.svelte';
	import SearchSelect from '$lib/components/SearchSelect.svelte';
	import type { SelectItem } from '$lib/components/search-select';
	import { countries } from '$lib/countries';
	import type { CategorySummary, Game } from '$lib/types';

	let {
		games,
		categories,
		filters,
		view = 'players',
		defaultCountry = ''
	}: {
		games: Game[];
		categories: CategorySummary[];
		filters: {
			game: string;
			category: string;
			mapsStatus: string;
			scope: string;
			country: string;
		};
		view?: 'players' | 'records' | 'average';
		defaultCountry?: string;
	} = $props();

	function initialFilters() {
		return {
			scope: filters.scope,
			game: filters.game,
			mapsStatus: filters.mapsStatus,
			category: filters.category,
			country: filters.country
		};
	}

	const rankingItems = [
		{ value: 'world', label: 'Worldwide', meta: 'All players' },
		{ value: 'country', label: 'Country', meta: 'National ranking' },
		{ value: 'following', label: 'Following', meta: 'Players you follow' },
		{ value: 'friends', label: 'Friends', meta: 'Mutual follows' }
	];
	const gameItems = $derived([
		{ value: '', label: 'All games' },
		...games.map((game) => ({
			value: game.slug,
			label: game.name,
			meta: game.studio ?? undefined,
			keywords: game.shortName
		}))
	]);
	const mapStatusItems = [
		{ value: 'all', label: 'All maps' },
		{ value: 'official', label: 'Official', meta: 'Official releases' },
		{ value: 'community', label: 'Community', meta: 'Custom and UEM maps' }
	];
	const categoryItems = $derived([
		{ value: '', label: 'All categories' },
		...categories.map((category) => ({
			value: category.slug,
			label: category.name
		}))
	]);
	const countryItems = countries.map((country) => ({
		value: country.code,
		label: country.name,
		meta: country.code,
		keywords: country.name
	}));

	const defaults = initialFilters();
	let scope = $state(defaults.scope);
	let game = $state(defaults.game);
	let mapsStatus = $state(defaults.mapsStatus);
	let category = $state(defaults.category);
	let country = $state(defaults.country);
</script>

{#snippet countrySelection(item: SelectItem)}
	<CountrySelectContent code={item.value} name={item.label} />
{/snippet}

{#snippet countryOption(item: SelectItem, selected: boolean)}
	<CountrySelectContent code={item.value} name={item.label} {selected} showMarker />
{/snippet}

<form method="GET">
	{#if view !== 'players'}<input type="hidden" name="view" value={view} />{/if}
	{#if view === 'players'}
		<SearchSelect
			label="Ranking"
			name="scope"
			items={rankingItems}
			value={scope}
			placeholder="Worldwide"
			searchPlaceholder="Search ranking…"
			onselect={(value) => {
				scope = value;
				if (value === 'country' && !country) country = defaultCountry;
			}}
		/>
		{#if scope === 'country'}
			<SearchSelect
				label="Country"
				name="country"
				items={countryItems}
				value={country}
				placeholder="Choose a country"
				searchPlaceholder="Search a country…"
				onselect={(value) => (country = value)}
				selection={countrySelection}
				option={countryOption}
			/>
		{/if}
	{/if}
	<SearchSelect
		label="Game"
		name="game"
		items={gameItems}
		value={game}
		placeholder="All games"
		searchPlaceholder="Search a game…"
		onselect={(value) => (game = value)}
	/>
	<SearchSelect
		label="Map type"
		name="maps_status"
		items={mapStatusItems}
		value={mapsStatus}
		placeholder="All maps"
		searchPlaceholder="Search a map type…"
		onselect={(value) => (mapsStatus = value)}
	/>
	<SearchSelect
		label="Category"
		name="category"
		items={categoryItems}
		value={category}
		placeholder="All categories"
		searchPlaceholder="Search a category…"
		onselect={(value) => (category = value)}
	/>
	<button type="submit">Apply filters <span>↗</span></button>
	{#if filters.game || filters.category || filters.mapsStatus !== 'all' || filters.scope !== 'world' || filters.country}
		<a href={resolve((view === 'players' ? '/leaderboard' : `/leaderboard?view=${view}`) as '/')}
			>Reset</a
		>
	{/if}
</form>

<style>
	form {
		display: grid;
		grid-template-columns: repeat(5, minmax(9rem, 1fr)) auto auto;
		align-items: end;
		gap: 0.7rem;
		padding: 1.25rem;
		border: 1px solid var(--line);
		border-top: 0;
		background: var(--canvas-soft);
	}
	button {
		min-height: 3.35rem;
		padding: 0 1.1rem;
		border: 1px solid var(--signal);
		background: var(--signal);
		color: #10120e;
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	form > a {
		align-self: center;
		color: var(--muted);
		font-size: 0.66rem;
		font-weight: 800;
		text-decoration: none;
		text-transform: uppercase;
	}
	@media (max-width: 1100px) {
		form {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 700px) {
		form {
			grid-template-columns: 1fr 1fr;
		}
		button {
			width: 100%;
		}
	}
	@media (max-width: 500px) {
		form {
			grid-template-columns: 1fr;
		}
		form > a {
			text-align: center;
		}
	}
</style>
