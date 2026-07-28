<script lang="ts">
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	let {
		eyebrow,
		title,
		description = null,
		children
	}: {
		eyebrow: string;
		title: string;
		description?: string | null;
		children: import('svelte').Snippet;
	} = $props();
</script>

<div>
	<section>
		<Eyebrow>{eyebrow}</Eyebrow>
		<h1>{title}</h1>
		{#if description}<p>{description}</p>{/if}{@render children()}
	</section>
</div>

<style>
	div {
		display: grid;
		min-height: calc(100vh - 4.8rem);
		place-items: center;
		padding: 2rem;
	}
	section {
		width: min(100%, 38rem);
		padding: clamp(2rem, 5vw, 4rem);
		border: 1px solid var(--line);
		background: var(--panel);
	}
	h1 {
		margin: 1rem 0;
		font-family: var(--font-display);
		font-size: clamp(3rem, 7vw, 5.5rem);
		font-style: italic;
		line-height: 0.82;
	}
	p {
		color: var(--muted);
		font-size: 0.78rem;
		line-height: 1.6;
	}
	:global(section form) {
		display: grid;
		margin: 1.5rem 0;
	}
	:global(section > a) {
		display: inline-block;
		margin-top: 1.5rem;
		color: var(--signal);
		font-size: 0.7rem;
		font-weight: 800;
		text-decoration: none;
	}
</style>
