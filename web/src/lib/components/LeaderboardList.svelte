<script lang="ts">
	import { resolve } from '$app/paths';
	import LeaderboardPlayer from '$lib/components/molecules/LeaderboardPlayer.svelte';
	import type { AchievementLeaderboardEntry, LeaderboardEntry } from '$lib/types';

	let {
		entries,
		limit,
		mode = 'performance'
	}: {
		entries: Array<LeaderboardEntry | AchievementLeaderboardEntry>;
		limit?: number;
		mode?: 'performance' | 'achievements';
	} = $props();
	let visibleEntries = $derived(limit ? entries.slice(0, limit) : entries);
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	const count = (entry: LeaderboardEntry | AchievementLeaderboardEntry) =>
		'recordCount' in entry ? entry.recordCount : entry.unlockedCount;
	const points = (entry: LeaderboardEntry | AchievementLeaderboardEntry) =>
		'achievementPoints' in entry ? entry.achievementPoints : entry.user.performancePoints;
</script>

{#if visibleEntries.length > 0}
	<div class="leaderboard-list">
		<div class="table-head" aria-hidden="true">
			<span>Rank</span><span>Player</span><span
				>{mode === 'achievements' ? 'Achievements' : 'Records'}</span
			><span>Points</span>
		</div>
		{#each visibleEntries as entry (entry.user.id)}
			<a
				class:podium={entry.rank <= 3}
				class="leaderboard-row"
				href={resolve('/players/[id]', { id: entry.user.id })}
			>
				<span class="rank">{String(entry.rank).padStart(2, '0')}</span>
				<span class="player">
					<LeaderboardPlayer user={entry.user} detail={`#${entry.user.id.slice(0, 6)}`} />
				</span>
				<span class="records"
					><strong>{count(entry)}</strong><small
						>{mode === 'achievements' ? 'unlocked' : 'verified'}</small
					></span
				>
				<span class="points"
					><strong>{number.format(points(entry))}</strong><small
						>{mode === 'achievements' ? 'AP' : 'PP'}</small
					></span
				>
			</a>
		{/each}
	</div>
{:else}
	<div class="empty-state">
		<span aria-hidden="true">∅</span><strong
			>{mode === 'achievements' ? 'No achievements yet' : 'No records yet'}</strong
		>
		<p>
			{mode === 'achievements'
				? 'Unlocked achievements will appear here.'
				: 'Verified records will appear here.'}
		</p>
	</div>
{/if}

<style>
	.leaderboard-list {
		display: grid;
	}
	.table-head,
	.leaderboard-row {
		display: grid;
		grid-template-columns: 4.4rem minmax(12rem, 1fr) 6.5rem 8rem;
		align-items: center;
	}
	.table-head {
		padding: 0 1.25rem 0.65rem;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.table-head span:nth-child(n + 3) {
		text-align: right;
	}
	.leaderboard-row {
		min-height: 4.9rem;
		padding: 0.65rem 1.25rem;
		border-top: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
		transition:
			background 150ms ease,
			transform 150ms ease;
	}
	.leaderboard-row:hover {
		background: var(--panel-hover);
		transform: translateX(3px);
	}
	.leaderboard-row.podium {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--signal) 9%, transparent),
			transparent 38%
		);
	}
	.rank {
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 1.1rem;
		letter-spacing: 0.08em;
	}
	.podium .rank {
		color: var(--signal);
	}
	.player {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
	}
	.records,
	.points {
		display: grid;
		gap: 0.2rem;
	}
	small {
		color: var(--muted);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.records,
	.points {
		justify-items: end;
	}
	.points strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.05rem;
		letter-spacing: 0.04em;
	}
	.empty-state {
		display: grid;
		min-height: 15rem;
		place-content: center;
		justify-items: center;
		padding: 2rem;
		text-align: center;
	}
	.empty-state > span {
		margin-bottom: 1rem;
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2rem;
	}
	.empty-state p {
		margin: 0.4rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}
	@media (max-width: 680px) {
		.table-head {
			display: none;
		}
		.leaderboard-row {
			grid-template-columns: 2.5rem minmax(0, 1fr) 5rem;
			padding-inline: 0.85rem;
		}
		.records {
			display: none;
		}
	}
</style>
