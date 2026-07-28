<script lang="ts">
	let {
		id,
		title,
		count,
		children
	}: {
		id: string;
		title: string;
		count: number;
		children: import('svelte').Snippet;
	} = $props();
	let expanded = $state(true);
</script>

<section>
	<button
		type="button"
		aria-expanded={expanded}
		aria-controls={id}
		onclick={() => (expanded = !expanded)}
	>
		<strong>{title}</strong>
		<span><b>{count.toString().padStart(2, '0')}</b><i class:collapsed={!expanded}>⌃</i></span>
	</button>
	{#if expanded}<div {id}>{@render children()}</div>{/if}
</section>

<style>
	section {
		border-top: 1px solid var(--line);
	}
	button {
		display: flex;
		width: 100%;
		min-height: 3.4rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.5rem;
		border: 0;
		background: var(--canvas-soft);
		color: var(--ink);
		cursor: pointer;
	}
	button:hover {
		background: var(--panel-hover);
	}
	button > strong {
		color: var(--signal);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	button span {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	button b {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.6rem;
	}
	button i {
		color: var(--muted);
		font-size: 0.9rem;
		font-style: normal;
		transition: transform 160ms ease;
	}
	button i.collapsed {
		transform: rotate(180deg);
	}
</style>
