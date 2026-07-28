<script lang="ts">
	import { resolve } from '$app/paths';
	let { items }: { items: Array<{ label: string; href?: string }> } = $props();
	const link = (href: string) => resolve(href as '/');
</script>

<nav aria-label="Breadcrumb">
	{#each items as item, index (`${item.label}:${index}`)}
		{#if index > 0}<span>/</span>{/if}
		{#if item.href}<a href={link(item.href)}>{item.label}</a>{:else}<strong>{item.label}</strong
			>{/if}
	{/each}
</nav>

<style>
	nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	a {
		color: var(--muted);
		text-decoration: none;
	}
	a:hover,
	strong {
		color: var(--signal);
	}
	span {
		color: var(--line-strong);
	}
</style>
