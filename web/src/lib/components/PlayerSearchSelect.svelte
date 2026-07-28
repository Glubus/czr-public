<script lang="ts">
	import { resolve } from '$app/paths';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';

	type Candidate = {
		id: string;
		name: string;
		image: string | null;
		performancePoints: number;
	};
	type SearchResponse = { entries: Candidate[]; unavailable: boolean };

	let {
		label = 'Player',
		name,
		endpoint = '/player-search',
		placeholder = 'Type a player name…',
		hint = 'Search by player name and select a profile.',
		resultSuffix = 'Player profile',
		selectedSuffix = 'Selected profile',
		required = true,
		onselect = undefined
	}: {
		label?: string;
		name: string;
		endpoint?: '/player-search' | '/claimable-profiles';
		placeholder?: string;
		hint?: string;
		resultSuffix?: string;
		selectedSuffix?: string;
		required?: boolean;
		onselect?: (candidate: Candidate | null) => void;
	} = $props();

	const listId = $props.id();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	let query = $state('');
	let entries = $state<Candidate[]>([]);
	let selected = $state<Candidate | null>(null);
	let loading = $state(false);
	let unavailable = $state(false);
	let open = $state(false);
	let active = $state(-1);

	$effect(() => {
		const search = query.trim();
		if (selected?.name === query || search.length < 2) {
			entries = [];
			loading = false;
			unavailable = false;
			return;
		}

		loading = true;
		unavailable = false;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(`${resolve(endpoint)}?q=${encodeURIComponent(search)}`, {
					signal: controller.signal
				});
				if (!response.ok) throw new Error('search failed');
				const result = (await response.json()) as SearchResponse;
				entries = result.entries;
				unavailable = result.unavailable;
				open = true;
			} catch (error) {
				if ((error as Error).name !== 'AbortError') {
					entries = [];
					unavailable = true;
				}
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}, 220);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function choose(candidate: Candidate) {
		selected = candidate;
		query = candidate.name;
		entries = [];
		open = false;
		onselect?.(candidate);
	}

	function handleInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value;
		selected = null;
		onselect?.(null);
		active = -1;
		open = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' && entries.length) {
			event.preventDefault();
			active = (active + 1) % entries.length;
		} else if (event.key === 'ArrowUp' && entries.length) {
			event.preventDefault();
			active = active <= 0 ? entries.length - 1 : active - 1;
		} else if (event.key === 'Enter' && open && active >= 0 && entries[active]) {
			event.preventDefault();
			choose(entries[active]);
		} else if (event.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="profile-search">
	<label for={`${listId}-input`}>{label}</label>
	<div class="control">
		<input
			id={`${listId}-input`}
			type="search"
			value={query}
			{placeholder}
			autocomplete="off"
			{required}
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={open && query.trim().length >= 2}
			aria-controls={listId}
			aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={() => (open = query.trim().length >= 2 && !selected)}
			onblur={() => setTimeout(() => (open = false), 140)}
		/>
		<input type="hidden" {name} value={selected?.id ?? ''} />

		{#if loading}<span class="search-state">Searching…</span>{/if}
		{#if open && query.trim().length >= 2 && !selected}
			<div class="results" id={listId} role="listbox" aria-label={`${label} results`}>
				{#each entries as candidate, index (candidate.id)}
					<button
						id={`${listId}-${index}`}
						type="button"
						class:active={active === index}
						role="option"
						aria-selected={active === index}
						onmousedown={(event) => event.preventDefault()}
						onmouseenter={() => (active = index)}
						onclick={() => choose(candidate)}
					>
						<PlayerAvatar name={candidate.name} image={candidate.image} size="small" />
						<span>
							<strong>{candidate.name}</strong>
							<small>{number.format(candidate.performancePoints)} PP · {resultSuffix}</small>
						</span>
						<b aria-hidden="true">Select →</b>
					</button>
				{/each}
				{#if !loading && entries.length === 0}
					<p>{unavailable ? 'Search is temporarily unavailable.' : 'No player profile found.'}</p>
				{/if}
			</div>
		{/if}
	</div>
	{#if selected}
		<div class="selected" role="status">
			<PlayerAvatar name={selected.name} image={selected.image} size="small" />
			<span><small>{selectedSuffix}</small><strong>{selected.name}</strong></span>
			<b>✓</b>
		</div>
	{:else if hint}
		<small class="hint">{hint}</small>
	{/if}
</div>

<style>
	.profile-search {
		display: grid;
		min-width: 0;
		gap: 0.5rem;
	}
	.profile-search > label {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.control {
		position: relative;
	}
	.control > input[type='search'] {
		width: 100%;
		height: 3.35rem;
		padding: 0 6rem 0 1rem;
		border: 1px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--ink);
	}
	.control > input:focus {
		border-color: var(--signal);
		outline: 0;
	}
	.search-state {
		position: absolute;
		top: 1.15rem;
		right: 1rem;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.results {
		position: absolute;
		top: calc(100% + 0.35rem);
		right: 0;
		left: 0;
		z-index: 55;
		max-height: 20rem;
		padding: 0.35rem;
		overflow: auto;
		border: 1px solid var(--line-strong);
		background: #101311;
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.55);
	}
	.results button {
		display: grid;
		width: 100%;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.results button:hover,
	.results button.active {
		background: var(--panel-hover);
	}
	.results button > span,
	.selected > span {
		display: grid;
		min-width: 0;
		gap: 0.16rem;
	}
	.results strong,
	.selected strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.results small,
	.selected small,
	.hint {
		color: var(--muted);
		font-size: 0.58rem;
	}
	.results b,
	.selected > b {
		color: var(--signal);
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	.results p {
		margin: 0;
		padding: 1rem;
		color: var(--muted);
		font-size: 0.68rem;
		text-align: center;
	}
	.selected {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--signal) 35%, var(--line));
		background: color-mix(in srgb, var(--signal) 5%, var(--canvas-soft));
	}
	.hint {
		line-height: 1.4;
	}
</style>
