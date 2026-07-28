<script lang="ts">
	import { resolve } from '$app/paths';
	import LeaderboardPlayer from '$lib/components/molecules/LeaderboardPlayer.svelte';
	import LeaderboardPanel from '$lib/components/organisms/LeaderboardPanel.svelte';
	import type { HighestAverageLeaderboard } from '$lib/types';

	let { leaderboard }: { leaderboard: HighestAverageLeaderboard | null } = $props();
	const number = new Intl.NumberFormat('en-US'),
		decimal = new Intl.NumberFormat('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
</script>

<LeaderboardPanel
	eyebrow="Average PP per active best / Minimum 5 records"
	title="HIGHEST AVERAGE PP"
	status="Top 50"
>
	{#if leaderboard?.entries.length}
		<div class="table-head">
			<span>Rank</span><span>Player</span><span>Records</span><span>Average</span>
		</div>
		<ol>
			{#each leaderboard.entries as entry (entry.user.id)}
				<li class:podium={entry.rank <= 3} class="leaderboard-row">
					<strong class="rank">{String(entry.rank).padStart(2, '0')}</strong>
					<a class="player" href={resolve(`/players/${entry.user.id}` as '/')}>
						<LeaderboardPlayer user={entry.user} />
					</a>
					<span class="records">{number.format(entry.recordCount)} active bests</span>
					<strong class="average">{decimal.format(entry.averagePoints)} <small>PP</small></strong>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">No ranked records match these filters.</p>
	{/if}
</LeaderboardPanel>

<style>
	.table-head,
	.leaderboard-row {
		display: grid;
		grid-template-columns: 5rem minmax(14rem, 1fr) 12rem 11rem;
		align-items: center;
	}
	.table-head span:last-child {
		text-align: right;
	}
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rank,
	.average {
		font-family: var(--font-display);
	}
	.player {
		display: block;
		min-width: 0;
		color: var(--ink);
		text-decoration: none;
	}
	.records {
		color: var(--muted);
		font-size: 0.67rem;
		text-transform: uppercase;
	}
	.average {
		color: var(--signal);
		font-size: 1.25rem;
		text-align: right;
	}
	.average small {
		font-size: 0.62rem;
	}
	.empty {
		margin: 0;
		padding: 5rem 1.5rem;
		color: var(--muted);
		font-size: 0.75rem;
		text-align: center;
	}
	@media (max-width: 720px) {
		.leaderboard-row {
			grid-template-columns: 3rem minmax(0, 1fr) auto;
		}
		.records {
			display: none;
		}
		.average {
			font-size: 1rem;
		}
	}
</style>
