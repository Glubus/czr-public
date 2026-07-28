<script lang="ts">
	import { resolve } from '$app/paths';

	let {
		current,
		totalPages,
		pageHref
	}: {
		current: number;
		totalPages: number;
		pageHref: (page: number) => string;
	} = $props();
	let pages = $derived.by(() => {
		const start = Math.max(1, current - 5);
		const end = Math.min(totalPages, current + 5);
		return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
	});
	const link = (page: number) => resolve(pageHref(page) as '/');
</script>

{#if totalPages > 1}
	<nav aria-label="Pagination">
		{#if current > 1}
			<a class="arrow previous" href={link(current - 1)} aria-label="Previous page">←</a>
		{:else}<i></i>{/if}
		<div class="pages">
			{#each pages as page (page)}
				{#if page === current}
					<span aria-current="page">{page}</span>
				{:else}
					<a href={link(page)} aria-label={`Page ${page}`}>{page}</a>
				{/if}
			{/each}
		</div>
		{#if current < totalPages}
			<a class="arrow next" href={link(current + 1)} aria-label="Next page">→</a>
		{:else}<i></i>{/if}
	</nav>
{/if}

<style>
	nav {
		display: grid;
		grid-template-columns: 2.7rem minmax(0, auto) 2.7rem;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		margin-top: 1.5rem;
	}
	.pages {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
	}
	a,
	span {
		display: grid;
		width: 2.7rem;
		height: 2.7rem;
		place-items: center;
		border-right: 1px solid var(--line);
		color: var(--muted);
		font-family: monospace;
		font-size: 0.65rem;
		font-weight: 800;
		text-decoration: none;
	}
	.pages > :last-child {
		border-right: 0;
	}
	a:hover,
	span {
		background: var(--signal);
		color: #10120e;
	}
	.arrow {
		border: 1px solid var(--line);
		background: var(--panel);
		color: var(--ink);
		font-size: 0.9rem;
	}
	@media (max-width: 620px) {
		nav {
			grid-template-columns: 2.4rem minmax(0, auto) 2.4rem;
			gap: 0.35rem;
		}
		a,
		span {
			width: 2.35rem;
			height: 2.4rem;
		}
	}
</style>
