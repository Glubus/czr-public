<script lang="ts">
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import { formatRecordScore } from '$lib/display';
	import type { PersonalRunEntry } from './contracts';

	let { runs }: { runs: PersonalRunEntry[] } = $props();

	const formatDate = (value: string) =>
		new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
			new Date(value)
		);
</script>

<section>
	<header>
		<div>
			<Eyebrow>Progress outside rankings</Eyebrow>
			<h2>PERSONAL RUNS</h2>
		</div>
		<span>Public & shared</span>
	</header>
	{#if runs.length}
		<div>
			{#each runs as run (run.id)}
				<article>
					<span>Attempt</span>
					<div>
						<strong>{run.map.name}</strong>
						<small>{run.game.name} · {run.category.name}</small>
					</div>
					<div class="score">
						<strong
							>{formatRecordScore(
								run.scoreValue,
								run.category.scoreType,
								run.runDurationMs
							)}</strong
						>
						<small>{formatDate(run.createdAt)}</small>
					</div>
					{#if run.proofUrl}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={run.proofUrl} target="_blank" rel="noreferrer">Proof ↗</a>
					{/if}
				</article>
			{/each}
		</div>
	{:else}
		<p>No personal runs are shared with you.</p>
	{/if}
</section>

<style>
	section {
		margin-top: 1rem;
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
	h2 {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 1.55rem;
		font-style: italic;
	}
	header > span {
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	article {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr) auto 4rem;
		align-items: center;
		gap: 1rem;
		min-height: 4.5rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	article > span {
		width: max-content;
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--line-strong);
		color: var(--muted);
		font-size: 0.5rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	article > div {
		display: grid;
		gap: 0.22rem;
	}
	article strong {
		font-size: 0.72rem;
	}
	article small {
		color: var(--muted);
		font-size: 0.55rem;
	}
	.score {
		justify-items: end;
	}
	article > a {
		color: var(--signal);
		font-size: 0.56rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	p {
		margin: 0;
		padding: 3rem 1rem;
		color: var(--muted);
		font-size: 0.68rem;
		text-align: center;
	}
	@media (max-width: 600px) {
		article {
			grid-template-columns: 1fr auto;
		}
		article > span {
			grid-column: 1 / -1;
		}
	}
</style>
