<script lang="ts">
	import { resolve } from '$app/paths';
	import { categoryVariantLabel } from '$lib/display';
	import type { CategoryForMap } from '$lib/types';

	let {
		basePath,
		variants,
		selected,
		playerCount
	}: {
		basePath: string;
		variants: CategoryForMap[];
		selected: number;
		playerCount: number;
	} = $props();
	const label = (variant: CategoryForMap) =>
		categoryVariantLabel(variant.specificRules) ?? 'Default ruleset';
	const link = (assignmentId: number) =>
		resolve(`${basePath}?assignment_id=${assignmentId}&player_count=${playerCount}` as '/');
</script>

{#if variants.length > 1}
	<nav aria-label="Category ruleset">
		<span>Ruleset</span>
		{#each variants as variant (variant.assignmentId)}
			<a class:active={variant.assignmentId === selected} href={link(variant.assignmentId)}
				>{label(variant)}</a
			>
		{/each}
	</nav>
{:else if variants[0] && categoryVariantLabel(variants[0].specificRules)}
	<div class="single"><span>Ruleset</span><strong>{label(variants[0])}</strong></div>
{/if}

<style>
	nav,
	.single {
		display: flex;
		min-height: 3.2rem;
		align-items: stretch;
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
	}
	nav > span,
	.single > span {
		display: grid;
		place-items: center;
		padding: 0 1rem;
		border-right: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.56rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	a,
	.single strong {
		display: grid;
		place-items: center;
		padding: 0.8rem 1.15rem;
		border-right: 1px solid var(--line);
		color: var(--ink);
		font-size: 0.65rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	a:hover,
	a.active {
		background: var(--signal);
		color: #10120e;
	}
	.single strong {
		color: var(--signal);
	}
	@media (max-width: 650px) {
		nav {
			align-items: stretch;
			flex-direction: column;
		}
		nav > span,
		nav a {
			min-height: 2.8rem;
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
	}
</style>
