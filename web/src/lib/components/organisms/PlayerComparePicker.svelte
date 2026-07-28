<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- URLs are built from the resolved /compare base. */
	import { resolve } from '$app/paths';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	type Suggestion = { id: string; kind: string; label: string; meta: string };
	type SelectedPlayer = { id: string; name: string; image: string | null } | null;
	let {
		label,
		param,
		selected,
		otherId = ''
	}: {
		label: string;
		param: 'player1' | 'player2';
		selected: SelectedPlayer;
		otherId?: string;
	} = $props();
	let query = $state('');
	let suggestions = $state<Suggestion[]>([]);
	let loading = $state(false);

	function compareUrl(id: string) {
		const params = new SvelteURLSearchParams();
		params.set(param, id);
		if (otherId) params.set(param === 'player1' ? 'player2' : 'player1', otherId);
		return `${resolve('/compare')}?${params}`;
	}

	$effect(() => {
		const value = query.trim();
		if (value.length < 2) {
			suggestions = [];
			return;
		}
		loading = true;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(
					`${resolve('/search/suggestions')}?q=${encodeURIComponent(value)}`,
					{ signal: controller.signal }
				);
				const result = (await response.json()) as { entries: Suggestion[] };
				suggestions = result.entries.filter(
					(entry) => entry.kind === 'player' && entry.id !== otherId
				);
			} catch (error) {
				if ((error as Error).name !== 'AbortError') suggestions = [];
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}, 220);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});
</script>

<div class="player-picker">
	<label for={param}>{label}</label>
	{#if selected}<div class="selected">
			<PlayerAvatar name={selected.name} image={selected.image} size="small" />
			<strong>{selected.name}</strong>
			<a
				href={resolve('/compare') +
					(otherId
						? `?${param === 'player1' ? 'player2' : 'player1'}=${encodeURIComponent(otherId)}`
						: '')}>Change</a
			>
		</div>{:else}<input
			id={param}
			type="search"
			bind:value={query}
			placeholder="Type a player name…"
			autocomplete="off"
		/>{#if loading}<small>Searching…</small>{/if}{#if query.trim().length >= 2}<div
				class="suggestions"
			>
				{#each suggestions as player (player.id)}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
						href={compareUrl(player.id)}
						><PlayerAvatar name={player.label} image={null} size="small" /><strong
							>{player.label}</strong
						><span>{player.meta}</span></a
					>{/each}{#if !loading && !suggestions.length}<p>No players found.</p>{/if}
			</div>{/if}{/if}
</div>

<style>
	.player-picker {
		position: relative;
		min-width: 0;
	}
	label {
		display: block;
		margin-bottom: 0.7rem;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	input,
	.selected {
		width: 100%;
		min-height: 3.8rem;
		border: 1px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--ink);
	}
	input {
		padding: 0 1rem;
	}
	.selected {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0.75rem;
	}
	.selected strong {
		font-size: 0.72rem;
	}
	.selected a {
		color: var(--signal);
		font-size: 0.55rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.player-picker > small {
		display: block;
		margin-top: 0.5rem;
		color: var(--muted);
	}
	.suggestions {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 20;
		width: 100%;
		border: 1px solid var(--line-strong);
		background: var(--panel);
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.4);
	}
	.suggestions a {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem;
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.suggestions span,
	.suggestions p {
		color: var(--muted);
		font-size: 0.58rem;
	}
	.suggestions p {
		padding: 0.8rem;
	}
</style>
