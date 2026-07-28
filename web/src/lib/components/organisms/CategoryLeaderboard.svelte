<script lang="ts">
	import { resolve } from '$app/paths';
	import PointsValue from '$lib/components/atoms/PointsValue.svelte';
	import Pagination from '$lib/components/molecules/Pagination.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import { formatRecordScore } from '$lib/display';
	import type { MapLeaderboard } from '$lib/types';
	let {
		mapId,
		leaderboard,
		page,
		playerCount,
		assignmentId
	}: {
		mapId: number;
		leaderboard: MapLeaderboard;
		page: number;
		playerCount: number;
		assignmentId: number;
	} = $props();
	const date = new Intl.DateTimeFormat('en-US', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
	function score(value: number, duration: number | null) {
		return formatRecordScore(value, leaderboard.category.scoreType, duration);
	}
	const base = $derived(`/maps/${mapId}/categories/${leaderboard.category.id}`);
	const pageLink = (next: number) =>
		`${base}?player_count=${playerCount}&assignment_id=${assignmentId}&page=${next - 1}`;
</script>

<section class="records">
	<div class="head">
		<span>Rank</span><span>Players</span><span>Score</span><span>Points</span><span>Date</span><span
		></span>
	</div>
	{#if leaderboard.entries.length}
		{#each leaderboard.entries as entry (entry.submission.id)}
			<div class:podium={entry.rank <= 3} class="row">
				<strong class="rank">{String(entry.rank).padStart(2, '0')}</strong>
				<div class="team">
					{#each entry.participants.length ? entry.participants : [{ user: entry.user, points: entry.points }] as participant (participant.user.id)}<a
							href={resolve('/players/[id]', { id: participant.user.id })}
							><PlayerAvatar
								name={participant.user.name}
								image={participant.user.image}
								size="small"
							/><span>{participant.user.name}</span></a
						>{/each}
				</div>
				<strong class="score">{score(entry.scoreValue, entry.submission.runDurationMs)}</strong>
				<PointsValue value={entry.points} />
				<time datetime={entry.submission.submittedAt}
					>{date.format(new Date(entry.submission.submittedAt))}</time
				>
				<a class="view" href={resolve(`/submissions/${entry.submission.id}`)}>View →</a>
			</div>
		{/each}
	{:else}<div class="empty">No records in this category yet.</div>{/if}
</section>
<Pagination current={page + 1} totalPages={leaderboard.totalPages} pageHref={pageLink} />

<style>
	.records {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.head,
	.row {
		display: grid;
		grid-template-columns: 4rem minmax(12rem, 1fr) 9rem 7.5rem 7rem 5rem;
		align-items: center;
	}
	.head {
		padding: 0.9rem 1.2rem;
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.row {
		min-height: 4.8rem;
		padding: 0.6rem 1.2rem;
		border-top: 1px solid var(--line);
	}
	.row.podium {
		background: linear-gradient(90deg, rgba(228, 87, 53, 0.08), transparent 35%);
	}
	.rank {
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 1.1rem;
	}
	.podium .rank {
		color: var(--signal);
	}
	.team {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.9rem;
		padding: 0.35rem 0;
	}
	.team a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--ink);
		font-size: 0.72rem;
		font-weight: 800;
		text-decoration: none;
	}
	.score {
		font-family: var(--font-display);
		font-size: 1rem;
	}
	time {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	.view {
		color: var(--ink);
		font-size: 0.65rem;
		font-weight: 800;
		text-decoration: none;
	}
	.empty {
		display: grid;
		min-height: 15rem;
		place-items: center;
		color: var(--muted);
		font-size: 0.75rem;
	}
	@media (max-width: 800px) {
		.head {
			display: none;
		}
		.row {
			grid-template-columns: 2.5rem 1fr auto;
		}
		.score {
			justify-self: end;
		}
		.row :global(.points) {
			grid-column: 2/4;
			justify-self: end;
		}
		.row time {
			grid-column: 2;
			padding-bottom: 0.5rem;
		}
		.view {
			display: none;
		}
	}
</style>
