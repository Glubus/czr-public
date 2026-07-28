<script lang="ts">
	import { resolve } from '$app/paths';
	import SearchBox from '$lib/components/molecules/SearchBox.svelte';
	import CollectionPanel from '$lib/components/organisms/CollectionPanel.svelte';
	import PageHero from '$lib/components/organisms/PageHero.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let total = $derived(
		(data.players?.entries.length ?? 0) +
			(data.maps?.entries.length ?? 0) +
			(data.games?.entries.length ?? 0)
	);
	const points = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
</script>

<svelte:head
	><title>{data.query ? `${data.query} - Search` : 'Search'} - Zombies Records</title></svelte:head
>
<div class="page">
	<PageHero compact eyebrow="Players / Maps / Games" title="SEARCH RECORDS." /><SearchBox
		value={data.query}
	/>{#if data.query.length < 2}<section class="idle">
			<div><span>+</span></div>
			<p>ENTER AT LEAST TWO CHARACTERS</p>
			<small>Search players, maps and games.</small>
		</section>{:else}<div class="summary">
			<p><span>{String(total).padStart(2, '0')}</span> results for</p>
			<strong>“{data.query}”</strong>
		</div>
		<div class="grid">
			<CollectionPanel
				index="01"
				title="PLAYERS"
				count={data.players?.entries.length ?? 0}
				empty="No players found."
				><ul>
					{#each data.players?.entries.slice(0, 8) ?? [] as player (player.id)}<li>
							<a href={resolve('/players/[id]', { id: player.id })}
								><PlayerAvatar name={player.name} image={player.image} /><span
									><strong>{player.name}</strong><small
										>{points.format(player.performancePoints)} PP</small
									></span
								><b>→</b></a
							>
						</li>{/each}
				</ul></CollectionPanel
			><CollectionPanel
				index="02"
				title="MAPS"
				count={data.maps?.entries.length ?? 0}
				empty="No maps found."
				><ul>
					{#each data.maps?.entries.slice(0, 8) ?? [] as map (map.id)}<li>
							<a href={resolve('/maps/[id]', { id: String(map.id) })}
								><span class="code"
									>{map.type === 'uem' ? 'UE' : map.type === 'custom' ? 'CM' : 'OF'}</span
								><span
									><strong>{map.name}</strong><small
										>{map.game.name} · {map.type === 'uem'
											? 'UEM'
											: map.type === 'custom'
												? 'Community'
												: 'Official'}</small
									></span
								><b>→</b></a
							>
						</li>{/each}
				</ul></CollectionPanel
			><CollectionPanel
				index="03"
				title="GAMES"
				count={data.games?.entries.length ?? 0}
				empty="No games found."
				><ul>
					{#each data.games?.entries.slice(0, 8) ?? [] as game (game.id)}<li>
							<a href={resolve('/games/[slug]', { slug: game.slug })}
								><span class="code">{game.releaseYear ?? '-'}</span><span
									><strong>{game.name}</strong><small>{game.shortName}</small></span
								><b>→</b></a
							>
						</li>{/each}
				</ul></CollectionPanel
			>
		</div>{/if}
</div>

<style>
	.page {
		padding: clamp(1rem, 3vw, 3rem);
	}
	.idle {
		display: grid;
		min-height: 22rem;
		place-content: center;
		justify-items: center;
	}
	.idle > div {
		display: grid;
		width: 6rem;
		height: 6rem;
		place-items: center;
		margin-bottom: 1.5rem;
		border: 1px solid var(--line);
		border-radius: 50%;
		background: repeating-radial-gradient(circle, transparent 0 1.2rem, var(--line) 1.25rem 1.3rem);
	}
	.idle div span {
		color: var(--signal);
		font-size: 1.5rem;
	}
	.idle p {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.65rem;
	}
	.idle small {
		color: #626962;
		font-size: 0.65rem;
	}
	.summary {
		padding: 2rem 0;
	}
	.summary p {
		margin: 0;
		color: var(--muted);
		font-size: 0.7rem;
	}
	.summary p span {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.2rem;
	}
	.summary strong {
		display: block;
		margin-top: 0.4rem;
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-style: italic;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}
	.code {
		display: grid;
		min-width: 2.7rem;
		color: var(--signal);
		font-family: monospace;
		font-size: 0.62rem;
	}
	@media (max-width: 1050px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
		.grid > :global(section:last-child) {
			grid-column: 1/-1;
		}
	}
	@media (max-width: 650px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.grid > :global(section:last-child) {
			grid-column: auto;
		}
	}
</style>
