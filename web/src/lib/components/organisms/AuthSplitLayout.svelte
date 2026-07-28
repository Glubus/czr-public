<script lang="ts">
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	let {
		title,
		description,
		panelTitle,
		children,
		footer
	}: {
		title: string;
		description: string;
		panelTitle: string;
		children: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	} = $props();
</script>

<div>
	<section class="intro">
		<Eyebrow>Player account</Eyebrow>
		<h1>{title}</h1>
		<p>{description}</p>
	</section>
	<section class="panel">
		<header>
			<Eyebrow>Account</Eyebrow>
			<h2>{panelTitle}</h2>
		</header>
		{@render children()}{#if footer}<footer>{@render footer()}</footer>{/if}
	</section>
</div>

<style>
	div {
		display: grid;
		min-height: calc(100vh - 4.8rem);
		grid-template-columns: minmax(0, 1.1fr) minmax(25rem, 0.9fr);
	}
	.intro {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: clamp(2rem, 6vw, 7rem);
		border-right: 1px solid var(--line);
		background: radial-gradient(circle at 35% 65%, rgba(228, 87, 53, 0.12), transparent 28%);
	}
	.intro h1 {
		margin: 1rem 0;
		font-family: var(--font-display);
		font-size: clamp(5rem, 10vw, 11rem);
		font-style: italic;
		line-height: 0.75;
	}
	.intro > p {
		max-width: 30rem;
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.7;
	}
	.panel {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(2rem, 5vw, 5rem);
		background: var(--canvas-soft);
	}
	.panel h2 {
		margin: 0.7rem 0 2rem;
		font-family: var(--font-display);
		font-size: 2.2rem;
		font-style: italic;
	}
	:global(.panel form) {
		display: grid;
	}
	footer {
		margin-top: 1.5rem;
		color: var(--muted);
		font-size: 0.72rem;
	}
	:global(footer a) {
		color: var(--ink);
		font-weight: 800;
	}
	@media (max-width: 800px) {
		div {
			grid-template-columns: 1fr;
		}
		.intro {
			min-height: 15rem;
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
		.intro h1 {
			font-size: 4rem;
		}
		.panel {
			padding-bottom: 6rem;
		}
	}
</style>
