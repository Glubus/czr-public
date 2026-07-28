<script lang="ts">
	let {
		children,
		tone = 'signal'
	}: { children: import('svelte').Snippet; tone?: 'signal' | 'muted' } = $props();
</script>

<p class:tone-muted={tone === 'muted'}>{@render children()}</p>

<style>
	p {
		margin: 0;
		color: var(--signal);
		font-family: monospace;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	p.tone-muted {
		color: var(--muted);
	}
</style>
