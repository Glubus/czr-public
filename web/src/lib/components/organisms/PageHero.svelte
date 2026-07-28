<script lang="ts">
	import Badge from '$lib/components/atoms/Badge.svelte';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	let {
		eyebrow,
		title,
		subtitle = null,
		badges = [],
		compact = false
	}: {
		eyebrow: string;
		title: string;
		subtitle?: string | null;
		badges?: string[];
		compact?: boolean;
	} = $props();
</script>

<header class:compact>
	<Eyebrow>{eyebrow}</Eyebrow>
	<h1>{title}</h1>
	{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
	{#if badges.length}<div class="badges">
			{#each badges as badge (badge)}<Badge>{badge}</Badge>{/each}
		</div>{/if}
</header>

<style>
	header {
		min-height: 25rem;
		padding: 7rem 0 2rem;
		border-bottom: 1px solid var(--line-strong);
		background: radial-gradient(circle at 70% 40%, rgba(228, 87, 53, 0.1), transparent 25%);
	}
	header.compact {
		min-height: 0;
		padding: 4rem 0 2rem;
	}
	h1 {
		max-width: 70rem;
		margin: 1rem 0;
		overflow-wrap: break-word;
		word-break: normal;
		font-family: var(--font-display);
		font-size: clamp(4rem, 9vw, 9rem);
		font-style: italic;
		line-height: 0.78;
	}
	.subtitle {
		margin: 0.5rem 0;
		color: var(--muted);
		font-size: 0.82rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	@media (max-width: 520px) {
		header {
			min-height: 18rem;
			padding-top: 4.5rem;
		}
		header.compact {
			padding-top: 3.4rem;
		}
		h1 {
			font-size: clamp(2.7rem, 13.5vw, 3.5rem);
			line-height: 0.82;
		}
	}
</style>
