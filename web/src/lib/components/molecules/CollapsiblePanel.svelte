<script lang="ts">
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';

	let {
		id,
		title,
		eyebrow,
		count,
		children
	}: {
		id: string;
		title: string;
		eyebrow: string;
		count: number;
		children: import('svelte').Snippet;
	} = $props();
	let expanded = $state(true);
</script>

<section>
	<header>
		<button
			class="toggle"
			type="button"
			aria-expanded={expanded}
			aria-controls={id}
			onclick={() => (expanded = !expanded)}
		>
			<div>
				<Eyebrow>{eyebrow}</Eyebrow>
				<h2>{title}</h2>
			</div>
			<span class="summary">
				<b>{count.toString().padStart(2, '0')}</b>
				<i class:collapsed={!expanded}>⌃</i>
			</span>
		</button>
	</header>
	{#if expanded}<div {id}>{@render children()}</div>{/if}
</section>

<style>
	section {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header,
	.toggle {
		min-height: 7rem;
	}
	.toggle {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.toggle:hover {
		background: var(--panel-hover);
	}
	h2 {
		margin: 0.5rem 0 0;
		font-family: var(--font-display);
		font-style: italic;
	}
	.summary {
		display: flex;
		align-items: center;
		gap: 1.2rem;
	}
	.summary b {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2rem;
	}
	.summary i {
		color: var(--muted);
		font-size: 1.1rem;
		font-style: normal;
		transition: transform 160ms ease;
	}
	.summary i.collapsed {
		transform: rotate(180deg);
	}
</style>
