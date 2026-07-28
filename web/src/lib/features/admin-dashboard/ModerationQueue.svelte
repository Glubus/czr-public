<script lang="ts">
	import { resolve } from '$app/paths';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import Badge from '$lib/components/atoms/Badge.svelte';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import type { PageData } from '../../../routes/admin/$types';

	let { queue, overview, status }: Pick<PageData, 'queue' | 'overview' | 'status'> = $props();
	const statuses = [
		{ value: 'pending', label: 'Pending' },
		{ value: 'awaiting_participants', label: 'Awaiting team' },
		{ value: 'verified', label: 'Verified' },
		{ value: 'rejected', label: 'Rejected' }
	];
	const date = (value: string) =>
		new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
</script>

<section aria-labelledby="record-queue-title">
	<header>
		<div>
			<Eyebrow>Submission workflow</Eyebrow>
			<h2 id="record-queue-title">Record queue</h2>
		</div>
		<nav aria-label="Submission status">
			{#each statuses as entry (entry.value)}
				<a
					class:active={status === entry.value}
					href={resolve(`/admin?status=${entry.value}` as '/')}
				>
					<span>{entry.label}</span><b>{overview?.submissions[entry.value] ?? 0}</b>
				</a>
			{/each}
		</nav>
	</header>

	{#if queue?.entries.length}
		<div class="table">
			<div class="table-head" aria-hidden="true">
				<span>ID</span><span>Submitted by</span><span>Record</span><span>Score</span><span
					>Status</span
				><span></span>
			</div>
			<div class="rows">
				{#each queue.entries as entry (entry.submission.id)}
					<a
						class="row"
						href={resolve('/admin/submissions/[id]', {
							id: String(entry.submission.id)
						})}
					>
						<span class="id">#{entry.submission.id}</span>
						<span class="submitter">
							<PlayerAvatar
								name={entry.submitter.name}
								image={entry.submitter.image}
								size="small"
							/>
							<span
								><strong>{entry.submitter.name}</strong><small
									>{date(entry.submission.submittedAt)}</small
								></span
							>
						</span>
						<span class="record">
							<strong>{entry.map.name}</strong>
							<small
								>{entry.game.name} · {entry.category.name} · {entry.submission.playerCount}P</small
							>
						</span>
						<span class="score">
							<strong>{entry.submission.scoreValue.toLocaleString('en-US')}</strong>
							<small>{entry.submission.proofLevel.replaceAll('_', ' ')}</small>
						</span>
						<span class="status"><Badge>{entry.submission.status.replace('_', ' ')}</Badge></span>
						<b>{entry.submission.status === 'pending' ? 'Review' : 'Inspect'} →</b>
					</a>
				{/each}
			</div>
		</div>
	{:else}
		<div class="empty">
			<strong>Nothing in this queue</strong>
			<span>No submission currently matches the selected status.</span>
		</div>
	{/if}
</section>

<style>
	section {
		min-width: 0;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: end;
		gap: 1.5rem;
		padding: 1rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.25rem 0 0;
		font: italic 1.35rem var(--font-display);
		text-transform: uppercase;
	}
	nav {
		display: flex;
		min-width: 0;
		justify-content: flex-end;
		gap: 0.35rem;
		overflow-x: auto;
	}
	nav a {
		display: flex;
		min-height: 2.25rem;
		align-items: center;
		gap: 0.45rem;
		padding: 0 0.65rem;
		border: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.54rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
		white-space: nowrap;
	}
	nav a b {
		color: var(--ink);
		font-family: monospace;
	}
	nav a.active {
		border-color: var(--signal);
		background: color-mix(in srgb, var(--signal) 9%, var(--canvas-soft));
		color: var(--signal);
	}
	.table {
		min-width: 0;
		overflow-x: auto;
	}
	.table-head,
	.row {
		display: grid;
		min-width: 48rem;
		grid-template-columns: 2.7rem 9.5rem minmax(12rem, 1fr) 6.5rem 6.5rem 4rem;
		align-items: center;
		gap: 0.7rem;
		padding: 0 0.9rem;
	}
	.table-head {
		min-height: 2.25rem;
		border-bottom: 1px solid var(--line);
		background: var(--canvas-soft);
		color: var(--muted);
		font-size: 0.52rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.row {
		min-height: 4.2rem;
		border-bottom: 1px solid var(--line);
		color: inherit;
		text-decoration: none;
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}
	.row:last-child {
		border-bottom: 0;
	}
	.row:hover {
		background: var(--panel-hover);
		box-shadow: inset 2px 0 var(--signal);
	}
	.row > span,
	.submitter > span {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}
	.submitter {
		display: flex !important;
		align-items: center;
		gap: 0.5rem;
	}
	.row strong {
		overflow: hidden;
		font-size: 0.7rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row small,
	.id {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.56rem;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.id {
		font-family: monospace;
	}
	.row > b {
		color: var(--signal);
		font-size: 0.57rem;
		text-align: right;
		text-transform: uppercase;
	}
	.empty {
		display: grid;
		min-height: 12rem;
		place-items: center;
		align-content: center;
		gap: 0.35rem;
		padding: 2rem;
		color: var(--muted);
		text-align: center;
	}
	.empty strong {
		color: var(--ink);
		font: italic 1.2rem var(--font-display);
		text-transform: uppercase;
	}
	.empty span {
		font-size: 0.68rem;
	}
	@media (max-width: 700px) {
		header {
			grid-template-columns: 1fr;
			align-items: stretch;
		}
		nav {
			justify-content: flex-start;
		}
	}
</style>
