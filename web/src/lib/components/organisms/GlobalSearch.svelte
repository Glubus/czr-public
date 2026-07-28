<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	type Suggestion = {
		id: string;
		kind: 'player' | 'map' | 'game';
		label: string;
		meta: string;
		href: string;
	};
	type SuggestionResponse = { entries: Suggestion[]; unavailable: boolean };

	const listId = $props.id();
	let input: HTMLInputElement;
	let query = $state('');
	let entries = $state<Suggestion[]>([]);
	let open = $state(false);
	let loading = $state(false);
	let unavailable = $state(false);
	let active = $state(-1);

	$effect(() => {
		const search = query.trim();
		if (search.length < 2) {
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
				const response = await fetch(
					`${resolve('/search/suggestions')}?q=${encodeURIComponent(search)}`,
					{ signal: controller.signal }
				);
				if (!response.ok) throw new Error();
				const result = (await response.json()) as SuggestionResponse;
				entries = result.entries;
				unavailable = result.unavailable;
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

	function handleInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value;
		active = -1;
		open = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' && entries.length) {
			event.preventDefault();
			open = true;
			active = (active + 1) % entries.length;
		} else if (event.key === 'ArrowUp' && entries.length) {
			event.preventDefault();
			open = true;
			active = active <= 0 ? entries.length - 1 : active - 1;
		} else if (event.key === 'Enter' && open && active >= 0 && entries[active]) {
			event.preventDefault();
			void goto(resolve(entries[active].href as '/'));
			open = false;
		} else if (event.key === 'Escape') {
			open = false;
			input.blur();
		}
	}

	function handleShortcut(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			input.focus();
			open = query.trim().length >= 2;
		}
	}
</script>

<svelte:window onkeydown={handleShortcut} />

<form class="quick-search" action={resolve('/search')} method="GET" role="search">
	<label class="sr-only" for="global-search">Search</label>
	<span aria-hidden="true">⌕</span>
	<input
		bind:this={input}
		id="global-search"
		name="q"
		type="search"
		placeholder="Player, map, game…"
		autocomplete="off"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={open && query.trim().length >= 2}
		aria-controls={listId}
		aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocus={() => (open = query.trim().length >= 2)}
		onblur={() => setTimeout(() => (open = false), 140)}
	/>
	<kbd>⌘ K</kbd>

	{#if open && query.trim().length >= 2}
		<div class="suggestions" id={listId} role="listbox" aria-label="Search suggestions">
			<div class="suggestion-status">
				<span>{loading ? 'SEARCHING' : 'QUICK RESULTS'}</span>
				<small>{entries.length ? `${entries.length} FOUND` : ''}</small>
			</div>
			{#each entries as entry, index (`${entry.kind}-${entry.id}`)}
				<a
					id={`${listId}-${index}`}
					class:active={active === index}
					href={resolve(entry.href as '/')}
					role="option"
					aria-selected={active === index}
					onmousedown={(event) => event.preventDefault()}
					onmouseenter={() => (active = index)}
				>
					<span class="kind">{entry.kind.slice(0, 2).toUpperCase()}</span>
					<span><strong>{entry.label}</strong><small>{entry.meta}</small></span>
					<b>→</b>
				</a>
			{/each}
			{#if !loading && !entries.length}
				<p>{unavailable ? 'Search is temporarily unavailable.' : 'No matches found.'}</p>
			{/if}
			<a
				class="all-results"
				href={resolve(`/search?q=${encodeURIComponent(query.trim())}` as '/')}
				onmousedown={(event) => event.preventDefault()}>View all results <b>→</b></a
			>
		</div>
	{/if}
</form>

<style>
	.quick-search {
		position: relative;
	}
	.suggestions {
		position: absolute;
		top: calc(100% + 0.45rem);
		right: 0;
		left: 0;
		z-index: 50;
		padding: 0.35rem;
		border: 1px solid var(--line-strong);
		background: #101311;
		box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.58);
	}
	.suggestion-status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 0.65rem;
		color: var(--muted);
		font-family: monospace;
		font-size: 0.55rem;
		letter-spacing: 0.08em;
	}
	.suggestions > a:not(.all-results) {
		display: grid;
		min-height: 3.3rem;
		grid-template-columns: 2rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.65rem;
		color: var(--ink);
		text-decoration: none;
	}
	.suggestions > a:hover,
	.suggestions > a.active {
		background: var(--panel-hover);
	}
	.suggestions a > span:not(.kind) {
		display: grid;
		min-width: 0;
		gap: 0.2rem;
	}
	.suggestions strong,
	.suggestions small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.suggestions strong {
		font-size: 0.72rem;
	}
	.suggestions small {
		color: var(--muted);
		font-size: 0.56rem;
		text-transform: uppercase;
	}
	.kind {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.57rem;
	}
	.suggestions b {
		color: var(--signal);
	}
	.suggestions p {
		margin: 0;
		padding: 1.4rem 0.7rem;
		color: var(--muted);
		font-size: 0.65rem;
		text-align: center;
	}
	.all-results {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0.65rem;
		border-top: 1px solid var(--line);
		color: var(--ink);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		text-decoration: none;
		text-transform: uppercase;
	}
</style>
