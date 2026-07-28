<script lang="ts">
	import { resolve } from '$app/paths';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import type { CategoryForMap } from '$lib/types';
	let { mapId, categories }: { mapId: number; categories: CategoryForMap[] } = $props();
	let groups = $derived(
		[...new Set(categories.map((category) => category.scoreType))].map((type) => ({
			type,
			categories: categories.filter((category) => category.scoreType === type)
		}))
	);
</script>

<section>
	<header>
		<div>
			<Eyebrow>Map leaderboards</Eyebrow>
			<h2>CATEGORIES</h2>
		</div>
		<strong>{categories.length}</strong>
	</header>
	{#if categories.length}
		{#each groups as group (group.type)}<div class="group">
				<h3>{group.type}</h3>
				<div class="grid">
					{#each group.categories as category, index (category.id)}<a
							href={resolve(`/maps/${mapId}/categories/${category.id}`)}
							><span>{String(index + 1).padStart(2, '0')}</span>
							<div><strong>{category.name}</strong><small>{category.scoreType}</small></div>
							<em
								>{category.rankingDirection === 'higher_is_better'
									? 'Highest wins'
									: 'Fastest wins'}</em
							><b>→</b></a
						>{/each}
				</div>
			</div>{/each}
	{:else}<p class="empty">No categories available for this map.</p>{/if}
</section>

<style>
	section {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 7rem;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.5rem 0 0;
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-style: italic;
	}
	header > strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.group h3 {
		margin: 0;
		padding: 0.75rem 1.2rem;
		border-bottom: 1px solid var(--line);
		background: var(--canvas-soft);
		color: var(--signal);
		font-family: monospace;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.grid > a {
		display: grid;
		min-height: 6rem;
		grid-template-columns: 2.8rem minmax(0, 1fr) auto 1.5rem;
		align-items: center;
		gap: 0.8rem;
		padding: 0.9rem 1.2rem;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.grid > a:nth-child(2n) {
		border-right: 0;
	}
	.grid > a:hover {
		background: var(--panel-hover);
	}
	.grid > a > span {
		color: #626a63;
		font-family: var(--font-display);
	}
	.grid div {
		display: grid;
		min-width: 0;
		gap: 0.3rem;
	}
	.grid div strong {
		overflow: hidden;
		font-size: 0.86rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	small,
	em {
		color: var(--muted);
		font-size: 0.58rem;
		font-style: normal;
		text-transform: uppercase;
	}
	b {
		color: var(--signal);
	}
	.empty {
		margin: 0;
		padding: 3rem 2rem;
		color: var(--muted);
		font-size: 0.75rem;
		text-align: center;
	}
	@media (max-width: 750px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.grid > a {
			border-right: 0;
		}
	}
	@media (max-width: 480px) {
		.grid > a {
			grid-template-columns: 2rem minmax(0, 1fr) 1rem;
		}
		.grid em {
			display: none;
		}
	}
</style>
