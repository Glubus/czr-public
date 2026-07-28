<script lang="ts">
	import { resolve } from '$app/paths';
	import PointsValue from '$lib/components/atoms/PointsValue.svelte';
	import LeaderboardPlayer from '$lib/components/molecules/LeaderboardPlayer.svelte';
	import LeaderboardPanel from '$lib/components/organisms/LeaderboardPanel.svelte';
	import type { HighestPointRecords } from '$lib/types';

	let {
		records,
		eyebrow = 'All verified boards',
		title = 'HIGHEST PP RECORDS',
		status = 'Top 50',
		compact = false,
		limit = 50
	}: {
		records: HighestPointRecords | null;
		eyebrow?: string;
		title?: string;
		status?: string;
		compact?: boolean;
		limit?: number;
	} = $props();
	const number = new Intl.NumberFormat('en-US');
	const date = new Intl.DateTimeFormat('en-US', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
	function score(entry: HighestPointRecords['entries'][number]) {
		if (entry.category.scoreType === 'round') return `Round ${number.format(entry.scoreValue)}`;
		if (entry.category.scoreType === 'time') {
			const seconds = Math.floor((entry.runDurationMs ?? entry.scoreValue) / 1000);
			const hours = Math.floor(seconds / 3600);
			const minutes = Math.floor((seconds % 3600) / 60);
			return `${hours ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
		}
		return number.format(entry.scoreValue);
	}
</script>

<div class:compact>
	<LeaderboardPanel {eyebrow} {title} {status}>
		<div class="table-head" aria-hidden="true">
			<span>Rank</span><span>Players</span><span>Record</span><span>Points</span><span></span>
		</div>
		{#each (records?.entries ?? []).slice(0, limit) as entry (entry.submissionId)}
			<div
				class:podium={entry.rank <= 3}
				class:world-record={entry.isWorldRecord}
				class="leaderboard-row"
			>
				<strong class="rank">{String(entry.rank).padStart(2, '0')}</strong>
				<div class="team">
					{#each entry.participants as participant (participant.user.id)}
						<a href={resolve('/players/[id]', { id: participant.user.id })}>
							<LeaderboardPlayer user={participant.user} />
						</a>
					{/each}
				</div>
				<a class="record" href={resolve('/maps/[id]', { id: String(entry.map.id) })}>
					<span class="compact-participants">
						{#each entry.participants as participant, index (participant.user.id)}
							{#if index}<i aria-hidden="true">·</i>{/if}<b>{participant.user.name}</b>
						{/each}
					</span>
					<span class="record-title"
						><strong>{entry.map.name}</strong>{#if entry.isWorldRecord}<span
								class="wr"
								aria-label="World record">WR</span
							>{/if}</span
					><small>{entry.game.name} · {entry.category.name} · {entry.playerCount}P</small>
					<span class="record-meta">
						<strong class="score">{score(entry)}</strong>
						<i aria-hidden="true">/</i>
						{#if entry.verifiedAt}<time datetime={entry.verifiedAt}
								>{date.format(new Date(entry.verifiedAt))}</time
							>{:else}<time>-</time>{/if}
					</span>
				</a>
				<PointsValue value={entry.points} />
				<a class="view" href={resolve(`/submissions/${entry.submissionId}`)}>View →</a>
			</div>
		{:else}
			<div class="empty">No verified PP records yet.</div>
		{/each}
	</LeaderboardPanel>
</div>

<style>
	.table-head,
	.leaderboard-row {
		display: grid;
		grid-template-columns: 5rem minmax(14rem, 1.1fr) minmax(20rem, 1.5fr) 10rem 5rem;
		align-items: center;
	}
	.table-head span:nth-child(n + 4) {
		text-align: right;
	}
	.leaderboard-row.world-record {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--signal) 12%, transparent),
			transparent 48%
		);
		box-shadow: inset 3px 0 var(--signal);
	}
	.rank {
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 1.05rem;
	}
	.podium .rank {
		color: var(--signal);
	}
	.team {
		display: flex;
		min-width: 0;
		flex-wrap: wrap;
		gap: 0.35rem 0.7rem;
	}
	.team a {
		min-width: 0;
		color: var(--ink);
		text-decoration: none;
	}
	.record {
		display: grid;
		min-width: 0;
		gap: 0.25rem;
		color: var(--ink);
		text-decoration: none;
	}
	.compact-participants {
		display: none;
	}
	.record-title {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.5rem;
	}
	.record-title strong {
		min-width: 0;
		font-size: 0.95rem;
	}
	.wr {
		flex: none;
		padding: 0.2rem 0.32rem;
		border: 1px solid var(--signal-soft);
		background: color-mix(in srgb, var(--signal) 14%, transparent);
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 0.55rem;
		font-style: italic;
		line-height: 1;
	}
	.record strong,
	.record small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.record small,
	time {
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
	}
	.record-meta {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.08rem;
	}
	.record-meta i {
		color: var(--line-strong);
		font-size: 0.65rem;
	}
	.score {
		font-size: 0.72rem;
	}
	.leaderboard-row :global(.points) {
		justify-self: end;
	}
	.view {
		justify-self: end;
		color: var(--signal);
		font-size: 0.66rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.empty {
		display: grid;
		min-height: 14rem;
		place-items: center;
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.72rem;
	}
	.compact .table-head {
		display: none;
	}
	.compact .leaderboard-row {
		grid-template-columns: 2.5rem minmax(0, 1fr) 5.5rem;
		gap: 0.7rem;
		padding-right: 1rem;
		padding-left: 1rem;
	}
	.compact .team,
	.compact .view {
		display: none;
	}
	.compact .compact-participants {
		display: flex;
		min-width: 0;
		gap: 0.3rem;
		overflow: hidden;
		color: var(--ink);
		font-size: 0.7rem;
		white-space: nowrap;
	}
	.compact .compact-participants b {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.compact .compact-participants i {
		color: var(--signal);
		font-style: normal;
	}
	@media (max-width: 1050px) {
		.table-head,
		.leaderboard-row {
			grid-template-columns: 4rem minmax(12rem, 1fr) minmax(17rem, 1.3fr) 8rem 4rem;
		}
	}
	@media (max-width: 820px) {
		.table-head,
		.leaderboard-row {
			grid-template-columns: 3rem minmax(0, 1fr) 7rem 4rem;
		}
		.table-head span:nth-child(2),
		.team {
			display: none;
		}
	}
	@media (max-width: 720px) {
		.table-head {
			display: none;
		}
		.leaderboard-row {
			grid-template-columns: 2.5rem minmax(0, 1fr) 6rem;
			gap: 0.5rem;
		}
		.view {
			display: none;
		}
	}
</style>
