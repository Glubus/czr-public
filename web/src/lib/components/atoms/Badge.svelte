<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<span>{@render children()}</span>

<style>
	span {
		display: inline-flex;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 800;
		text-transform: uppercase;
	}
</style>
