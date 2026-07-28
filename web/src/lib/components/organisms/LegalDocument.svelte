<script lang="ts">
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		intro,
		updated,
		children
	}: {
		eyebrow: string;
		title: string;
		intro: string;
		updated: string;
		children: Snippet;
	} = $props();
</script>

<div class="legal-page">
	<header>
		<div>
			<Eyebrow>{eyebrow}</Eyebrow>
			<h1>{title}</h1>
			<p>{intro}</p>
		</div>
		<span>Last updated<br /><strong>{updated}</strong></span>
	</header>
	<article>{@render children()}</article>
</div>

<style>
	.legal-page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.legal-page > header {
		display: flex;
		min-height: 17rem;
		align-items: flex-end;
		justify-content: space-between;
		gap: 2rem;
		padding: clamp(1.5rem, 4vw, 3rem);
		border: 1px solid var(--line);
		background:
			radial-gradient(
				circle at 85% 20%,
				color-mix(in srgb, var(--signal) 15%, transparent),
				transparent 30%
			),
			var(--panel);
	}
	header > div {
		max-width: 48rem;
	}
	h1 {
		margin: 0.6rem 0 1rem;
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 7vw, 6rem);
		font-style: italic;
		line-height: 0.86;
		letter-spacing: -0.04em;
		text-transform: uppercase;
	}
	header p {
		max-width: 44rem;
		margin: 0;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.75;
	}
	header > span {
		flex: 0 0 auto;
		color: var(--muted);
		font-size: 0.54rem;
		font-weight: 800;
		line-height: 1.7;
		text-align: right;
		text-transform: uppercase;
	}
	header > span strong {
		color: var(--ink);
	}
	article {
		max-width: 62rem;
		margin: 1rem auto 0;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	:global(.legal-section) {
		display: grid;
		grid-template-columns: minmax(10rem, 0.35fr) minmax(0, 1fr);
		gap: clamp(1.5rem, 5vw, 4rem);
		padding: clamp(1.5rem, 4vw, 3rem);
		border-bottom: 1px solid var(--line);
	}
	:global(.legal-section:last-child) {
		border-bottom: 0;
	}
	:global(.legal-section h2) {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-style: italic;
		text-transform: uppercase;
	}
	:global(.legal-copy) {
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.8;
	}
	:global(.legal-copy p:first-child) {
		margin-top: 0;
	}
	:global(.legal-copy p:last-child) {
		margin-bottom: 0;
	}
	:global(.legal-copy ul) {
		display: grid;
		gap: 0.55rem;
		padding-left: 1.2rem;
	}
	:global(.legal-copy strong),
	:global(.legal-copy a) {
		color: var(--ink);
	}
	:global(.legal-notice) {
		padding: 0.8rem 1rem;
		border-left: 2px solid var(--signal);
		background: color-mix(in srgb, var(--signal) 7%, transparent);
		color: var(--ink);
	}
	@media (max-width: 650px) {
		.legal-page {
			padding-bottom: 6rem;
		}
		.legal-page > header {
			min-height: 15rem;
			flex-direction: column;
			align-items: flex-start;
			justify-content: flex-end;
		}
		header > span {
			text-align: left;
		}
		:global(.legal-section) {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
	}
</style>
