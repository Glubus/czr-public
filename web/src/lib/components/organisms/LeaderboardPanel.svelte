<script lang="ts">
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';

	let {
		eyebrow,
		title,
		status,
		statusTone = 'signal',
		children
	}: {
		eyebrow: string;
		title: string;
		status: string;
		statusTone?: 'signal' | 'muted';
		children: import('svelte').Snippet;
	} = $props();
</script>

<section class="panel">
	<header>
		<div>
			<Eyebrow tone="muted">{eyebrow}</Eyebrow>
			<h2>{title}</h2>
		</div>
		<strong class:muted={statusTone === 'muted'}>{status}</strong>
	</header>
	{@render children()}
</section>

<style>
	.panel {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 7rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.55rem 0 0;
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-style: italic;
	}
	header > strong {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	header > strong.muted {
		color: var(--muted);
	}
	.panel :global(.table-head) {
		display: grid;
		min-height: 2.65rem;
		align-items: center;
		padding: 0 1.25rem;
		border: 0;
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.panel :global(.leaderboard-row) {
		min-height: 5.25rem;
		padding: 0.65rem 1.25rem;
		border: 0;
		border-bottom: 1px solid var(--line);
		transition: background 150ms ease;
	}
	.panel :global(.leaderboard-row:last-child) {
		border-bottom: 0;
	}
	.panel :global(.leaderboard-row:hover) {
		background: var(--panel-hover);
		transform: none;
	}
	.panel :global(.leaderboard-row.podium) {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--signal) 9%, transparent),
			transparent 38%
		);
	}
	.panel :global(.leaderboard-row .rank) {
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 1.05rem;
		letter-spacing: 0.06em;
	}
	.panel :global(.leaderboard-row.podium .rank) {
		color: var(--signal);
	}
	@media (max-width: 720px) {
		header {
			min-height: 6rem;
			padding-inline: 1rem;
		}
		.panel :global(.table-head) {
			display: none;
		}
		.panel :global(.leaderboard-row) {
			padding-inline: 0.85rem;
		}
	}
</style>
