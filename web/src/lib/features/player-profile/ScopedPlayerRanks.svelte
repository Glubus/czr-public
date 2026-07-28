<script lang="ts">
	import { resolve } from '$app/paths';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import type { ScopedPlayerRanks } from './contracts';

	let { ranks }: { ranks: ScopedPlayerRanks } = $props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
</script>

<section>
	<header>
		<div>
			<Eyebrow>Scoped performance</Eyebrow>
			<h2>GAME & CATEGORY RANKS</h2>
		</div>
		<span>Active best records</span>
	</header>
	<div class="columns">
		<div>
			<h3>Games</h3>
			{#each ranks.games as rank (rank.id)}
				<a href={resolve('/games/[slug]', { slug: rank.slug })}>
					<b>#{number.format(rank.rank)}</b>
					<div>
						<strong>{rank.name}</strong>
						<small>{number.format(rank.performancePoints)} PP · {rank.recordCount} records</small>
					</div>
					<span>of {number.format(rank.totalPlayers)}</span>
				</a>
			{/each}
			{#if !ranks.games.length}<p>No game ranks yet.</p>{/if}
		</div>
		<div>
			<h3>Categories</h3>
			{#each ranks.categories as rank (rank.id)}
				<article>
					<b>#{number.format(rank.rank)}</b>
					<div>
						<strong>{rank.name}</strong>
						<small>{number.format(rank.performancePoints)} PP · {rank.recordCount} records</small>
					</div>
					<span>of {number.format(rank.totalPlayers)}</span>
				</article>
			{/each}
			{#if !ranks.categories.length}<p>No category ranks yet.</p>{/if}
		</div>
	</div>
</section>

<style>
	section {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 5rem;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 1.55rem;
		font-style: italic;
	}
	header > span {
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.columns > div:first-child {
		border-right: 1px solid var(--line);
	}
	h3 {
		margin: 0;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	a,
	article {
		display: grid;
		grid-template-columns: minmax(4.75rem, max-content) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	b {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-style: italic;
		white-space: nowrap;
	}
	a > div,
	article > div {
		display: grid;
		gap: 0.2rem;
	}
	strong {
		font-size: 0.68rem;
	}
	small,
	a > span,
	article > span,
	p {
		color: var(--muted);
		font-size: 0.53rem;
	}
	p {
		padding: 1rem;
	}
	@media (max-width: 600px) {
		.columns {
			grid-template-columns: 1fr;
		}
		.columns > div:first-child {
			border-right: 0;
		}
	}
</style>
