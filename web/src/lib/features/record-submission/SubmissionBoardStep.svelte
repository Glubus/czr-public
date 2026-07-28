<script lang="ts">
	import SearchSelect from '$lib/components/SearchSelect.svelte';
	import { categoryVariantLabel } from '$lib/display';
	import type { CategoryForMap } from '$lib/types';
	import type { EntryDraft } from './contracts';
	import type { SelectItem } from '$lib/components/search-select';

	let {
		gameOptions,
		mapOptions,
		gameId,
		mapId,
		categories,
		entries,
		loadingMaps,
		loadingCategories,
		boardReady,
		chooseGame,
		chooseMap,
		toggleCategory,
		advance
	}: {
		gameOptions: SelectItem[];
		mapOptions: SelectItem[];
		gameId: string;
		mapId: string;
		categories: CategoryForMap[];
		entries: EntryDraft[];
		loadingMaps: boolean;
		loadingCategories: boolean;
		boardReady: boolean;
		chooseGame: (value: string) => void;
		chooseMap: (value: string) => void;
		toggleCategory: (category: CategoryForMap) => void;
		advance: () => void;
	} = $props();
</script>

<section class="panel">
	<header>
		<span>01</span>
		<div>
			<h2>Choose the board</h2>
			<p>Start broad, then narrow the exact ruleset.</p>
		</div>
	</header>
	<div class="fields">
		<SearchSelect
			testId="submit-game-select"
			label="Game"
			items={gameOptions}
			value={gameId}
			placeholder="Select a game"
			searchPlaceholder="Search games, studios…"
			emptyText="No games found"
			required
			onselect={chooseGame}
		/>
		<SearchSelect
			testId="submit-map-select"
			label="Map"
			items={mapOptions}
			value={mapId}
			placeholder={loadingMaps ? 'Loading maps…' : 'Select a map'}
			searchPlaceholder="Search maps or use is:official is:zombie"
			emptyText="No maps found"
			disabled={!gameId || loadingMaps}
			required
			onselect={chooseMap}
		/>
	</div>
	<fieldset disabled={!mapId || loadingCategories}>
		<legend>Categories <small>Select up to five from the same run</small></legend>
		{#if loadingCategories}<p>Loading categories…</p>
		{:else if mapId && !categories.length}<p>No categories are available for this map.</p>
		{:else}<div class="categories">
				{#each categories as category (category.assignmentId)}<label
						class:selected={entries.some((entry) => entry.assignmentId === category.assignmentId)}
						><input
							type="checkbox"
							checked={entries.some((entry) => entry.assignmentId === category.assignmentId)}
							disabled={!entries.some((entry) => entry.assignmentId === category.assignmentId) &&
								entries.length >= 5}
							onchange={() => toggleCategory(category)}
						/><span
							><strong>{category.name}</strong><small
								>{categoryVariantLabel(category.specificRules) ?? 'Default ruleset'} · {category.scoreType}</small
							></span
						></label
					>{/each}
			</div>{/if}
	</fieldset>
	<footer>
		<span>{entries.length}/5 categories selected</span><button
			type="button"
			class="primary"
			disabled={!boardReady}
			onclick={advance}>Continue →</button
		>
	</footer>
</section>

<style>
	.panel {
		padding: clamp(1.25rem, 3vw, 2.5rem);
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		gap: 1rem;
		padding-bottom: 1.6rem;
		border-bottom: 1px solid var(--line);
	}
	header > span {
		color: var(--signal);
		font: 0.65rem monospace;
	}
	h2 {
		margin: 0;
		font: italic 2rem var(--font-display);
		text-transform: uppercase;
	}
	header p,
	fieldset p {
		color: var(--muted);
		font-size: 0.7rem;
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1.5rem;
	}
	fieldset {
		margin: 1.7rem 0 0;
		padding: 0;
		border: 0;
	}
	legend {
		width: 100%;
		margin-bottom: 0.8rem;
		font-size: 0.72rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	legend small {
		color: var(--muted);
		text-transform: none;
	}
	.categories {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.6rem;
	}
	.categories label {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		min-height: 4.2rem;
		padding: 0.8rem;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
		cursor: pointer;
	}
	.categories label.selected {
		border-color: var(--signal);
	}
	.categories input {
		width: 1rem;
		height: 1rem;
		accent-color: var(--signal);
	}
	.categories span {
		display: grid;
		min-width: 0;
		gap: 0.25rem;
	}
	.categories strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.7rem;
	}
	.categories small {
		color: var(--muted);
		font-size: 0.55rem;
		text-transform: uppercase;
	}
	footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.8rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--line);
	}
	footer > span {
		margin-right: auto;
		color: var(--muted);
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	button {
		border: 1px solid var(--line);
		padding: 0.75rem 1rem;
		cursor: pointer;
	}
	.primary {
		background: var(--signal);
		color: #101311;
		font-weight: 900;
	}
	button:disabled {
		opacity: 0.35;
	}
	@media (max-width: 760px) {
		.fields,
		.categories {
			grid-template-columns: 1fr;
		}
	}
</style>
