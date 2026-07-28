<script lang="ts">
	type MetricItem = {
		label: string;
		value: string;
		suffix: string;
		href?: string;
	};

	let { items }: { items: MetricItem[] } = $props();
</script>

<section style={`--count: ${items.length}`}>
	{#each items as item (item.label)}
		{#if item.href}
			<!-- The caller provides a route already processed by SvelteKit's resolve(). -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={item.href}>
				<span>{item.label}</span><strong>{item.value}</strong><small>{item.suffix}</small>
			</a>
		{:else}
			<div>
				<span>{item.label}</span><strong>{item.value}</strong><small>{item.suffix}</small>
			</div>
		{/if}
	{/each}
</section>

<style>
	section {
		display: grid;
		grid-template-columns: repeat(var(--count, 3), 1fr);
		border: 1px solid var(--line);
		border-top: 0;
		background: var(--canvas-soft);
	}
	div,
	a {
		padding: 1.35rem;
		border-right: 1px solid var(--line);
	}
	a {
		color: var(--ink);
		text-decoration: none;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	a:hover {
		background: var(--panel-hover);
		color: var(--signal);
	}
	div:last-child,
	a:last-child {
		border: 0;
	}
	span,
	small {
		display: block;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.1em;
	}
	strong {
		display: inline-block;
		margin: 0.7rem 0.35rem 0.15rem 0;
		font-family: var(--font-display);
		font-size: 1.85rem;
	}
	@media (max-width: 600px) {
		section {
			grid-template-columns: 1fr;
		}
		div,
		a {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
	}
</style>
