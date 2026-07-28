<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import RecordCard from '$lib/components/organisms/RecordCard.svelte';
	import { formatRecordScore } from '$lib/display';
	import type { UserRecord } from '$lib/types';
	import type { SubmitFunction } from '@sveltejs/kit';
	let {
		records,
		title = 'BEST',
		eyebrow = 'Ranked records',
		meta = `${records.length} BY PP`,
		empty = 'No verified records yet.',
		owner = false,
		showContribution = false,
		pinnedIds = []
	}: {
		records: UserRecord[];
		title?: string;
		eyebrow?: string;
		meta?: string;
		empty?: string;
		owner?: boolean;
		showContribution?: boolean;
		pinnedIds?: number[];
	} = $props();
	let expanded = $state(false);
	let visibleRecords = $derived(expanded ? records : records.slice(0, 5));
	const date = new Intl.DateTimeFormat('en-US', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
	function score(record: UserRecord) {
		return formatRecordScore(record.scoreValue, record.category.scoreType, record.runDurationMs);
	}
	const enhancePin: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false, invalidateAll: result.type === 'success' });
		};
	};
</script>

<section>
	<header>
		<div>
			<Eyebrow>{eyebrow}</Eyebrow>
			<h2>{title}</h2>
		</div>
		<span>{meta}</span>
	</header>
	{#if records.length}<div class="table-head" aria-hidden="true">
			<span>Rank</span><span>Record</span><span>Result</span><span>Points</span><span>Date</span>
		</div>
		<ol>
			{#each visibleRecords as record, index (record.submissionId)}<li class:managed={owner}>
					<RecordCard
						href={resolve(`/submissions/${record.submissionId}` as '/')}
						position={record.isWorldRecord ? 'WR' : String(index + 1).padStart(2, '0')}
						mapName={record.map.name}
						categoryName={record.category.name}
						context={`${record.game.name} · ${record.playerCount} players`}
						result={score(record)}
						points={record.points}
						awardedPoints={showContribution ? record.awardedPoints : null}
						awardPercentage={showContribution ? record.awardPercentage : null}
						date={record.verifiedAt ? date.format(new Date(record.verifiedAt)) : null}
						highlight={record.isWorldRecord}
					/>
					{#if owner}<form method="POST" action="?/pinRecord" use:enhance={enhancePin}>
							<input type="hidden" name="submissionId" value={record.submissionId} />
							<input
								type="hidden"
								name="pinned"
								value={String(pinnedIds.includes(record.submissionId))}
							/>
							<button
								type="submit"
								class:pinned={pinnedIds.includes(record.submissionId)}
								aria-label={`${pinnedIds.includes(record.submissionId) ? 'Unpin' : 'Pin'} ${record.map.name} ${record.category.name}`}
								>{pinnedIds.includes(record.submissionId) ? 'Unpin' : 'Pin'}</button
							>
						</form>{/if}
				</li>{/each}
		</ol>
		{#if records.length > 5}<button
				class="more"
				type="button"
				onclick={() => (expanded = !expanded)}
				>{expanded ? 'Show less' : `Show more (${records.length - 5})`}</button
			>{/if}{:else}<p class="empty">{empty}</p>{/if}
</section>

<style>
	section {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 6.5rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.3rem 1.5rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.45rem 0 0;
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-style: italic;
	}
	header > span {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.6rem;
	}
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.table-head {
		display: grid;
		grid-template-columns: 4rem minmax(15rem, 1fr) 9rem 9rem 8rem;
		align-items: center;
	}
	.table-head {
		min-height: 2.7rem;
		padding: 0 1.2rem;
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	li {
		position: relative;
		border-bottom: 1px solid var(--line);
	}
	li:last-child {
		border: 0;
	}
	li.managed :global(.record-card) {
		padding-right: 5.5rem;
	}
	li form {
		position: absolute;
		top: 50%;
		right: 0.75rem;
		transform: translateY(-50%);
	}
	li form button {
		min-width: 3.7rem;
		height: 2rem;
		border: 1px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--muted);
		font-size: 0.5rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	li form button:hover,
	li form button.pinned {
		border-color: var(--signal);
		color: var(--signal);
	}
	.empty {
		margin: 0;
		padding: 4rem 1.5rem;
		color: var(--muted);
		font-size: 0.75rem;
		text-align: center;
	}
	.more {
		width: 100%;
		height: 3.6rem;
		border: 0;
		border-top: 1px solid var(--line);
		background: var(--canvas-soft);
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.more:hover {
		color: var(--signal);
	}
	@media (max-width: 850px) {
		.table-head {
			display: none;
		}
	}
</style>
