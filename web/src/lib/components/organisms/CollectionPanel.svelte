<script lang="ts">
	let {
		index,
		title,
		count,
		empty,
		children
	}: {
		index: string;
		title: string;
		count: number;
		empty: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<section>
	<header>
		<div>
			<span>{index}</span>
			<h2>{title}</h2>
		</div>
		<small>{count}</small>
	</header>
	{#if count && children}{@render children()}{:else}<div class="empty">{empty}</div>{/if}
</section>

<style>
	section {
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
	header div {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	header span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.6rem;
	}
	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-style: italic;
	}
	header small {
		color: var(--muted);
		font-family: monospace;
	}
	:global(ul) {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	:global(li) {
		border-bottom: 1px solid var(--line);
	}
	:global(li:last-child) {
		border: 0;
	}
	:global(li > a) {
		display: grid;
		min-height: 4.5rem;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.7rem 1rem;
		color: var(--ink);
		text-decoration: none;
	}
	:global(li > a:hover) {
		background: var(--panel-hover);
	}
	:global(li > a > span:not(.avatar)) {
		display: grid;
		min-width: 0;
		gap: 0.25rem;
	}
	:global(li strong) {
		overflow: hidden;
		font-size: 0.76rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(li small) {
		color: var(--muted);
		font-size: 0.6rem;
	}
	:global(li b) {
		color: var(--signal);
	}
	.empty {
		display: grid;
		min-height: 9rem;
		place-items: center;
		color: var(--muted);
		font-size: 0.7rem;
	}
</style>
