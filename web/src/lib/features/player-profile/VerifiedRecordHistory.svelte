<script lang="ts">
	import { resolve } from '$app/paths';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import RecordCard from '$lib/components/organisms/RecordCard.svelte';
	import { formatRecordScore } from '$lib/display';
	import type { VerifiedRecordHistoryEntry } from './contracts';

	let { records }: { records: VerifiedRecordHistoryEntry[] } = $props();

	const formatDate = (value: string | null) =>
		value
			? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
					new Date(value)
				)
			: 'Unknown date';
</script>

<section>
	<header>
		<div>
			<Eyebrow>Verified timeline</Eyebrow>
			<h2>RECENT RECORDS</h2>
		</div>
		<span>Latest {records.length}</span>
	</header>
	{#if records.length}
		<div>
			{#each records as record (record.submissionId)}
				<RecordCard
					href={resolve('/submissions/[id]', { id: String(record.submissionId) })}
					position={record.isBestRecord ? 'PB' : ''}
					mapName={record.map.name}
					categoryName={record.category.name}
					context={record.game.name}
					result={formatRecordScore(
						record.scoreValue,
						record.category.scoreType,
						record.runDurationMs
					)}
					points={record.isBestRecord ? record.points : null}
					date={formatDate(record.verifiedAt)}
					highlight={record.isBestRecord}
				/>
			{/each}
		</div>
	{:else}
		<p>No verified history yet.</p>
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
	p {
		margin: 0;
		padding: 3rem 1rem;
		color: var(--muted);
		font-size: 0.68rem;
		text-align: center;
	}
</style>
