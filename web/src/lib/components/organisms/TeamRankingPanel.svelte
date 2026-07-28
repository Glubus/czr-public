<script lang="ts">
	import { resolve } from '$app/paths';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import type { TeamLeaderboard } from '$lib/types';

	let { leaderboard, playerCount }: { leaderboard: TeamLeaderboard | null; playerCount: number } =
		$props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
</script>

<nav class="sizes" aria-label="Team size">
	{#each [2, 3, 4] as count (count)}<a
			class:active={playerCount === count}
			href={resolve(`/leaderboard?view=teams&player_count=${count}` as '/')}>{count} players</a
		>{/each}
</nav>
<section class="teams">
	<div class="head">
		<span>Rank</span><span>Players</span><span>Performance</span><span>Records</span><span>WRs</span
		><span></span>
	</div>
	{#if leaderboard?.entries.length}<div>
			{#each leaderboard.entries as team (team.competitorKey)}<article>
					<strong class="rank">#{team.rank}</strong>
					<div class="players">
						{#each team.members as member (member.id)}<a
								href={resolve('/players/[id]', { id: member.id })}
								><PlayerAvatar name={member.name} image={member.image} size="small" /><span
									>{member.name}</span
								></a
							>{/each}
					</div>
					<strong class="pp">{number.format(team.performancePoints)} <small>PP</small></strong><span
						>{team.recordCount}</span
					><span>{team.firstPlaces}</span><a
						class="open"
						href={resolve('/teams/[competitorKey]', { competitorKey: team.competitorKey })}
						aria-label={`Open ${team.members.map((member) => member.name).join(', ')}`}>→</a
					>
				</article>{/each}
		</div>{:else}<p>No {playerCount}-player teams are ranked yet.</p>{/if}
</section>

<style>
	.sizes {
		display: flex;
		margin: 1rem 0;
		border: 1px solid var(--line);
	}
	.sizes a {
		padding: 0.8rem 1.2rem;
		border-right: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.sizes a.active {
		background: var(--signal);
		color: #10120e;
	}
	.teams {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.head,
	article {
		display: grid;
		grid-template-columns: 4rem minmax(20rem, 1fr) 10rem 6rem 5rem 3rem;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
	}
	.head {
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.52rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	article {
		min-height: 5rem;
		border-bottom: 1px solid var(--line);
	}
	.rank,
	.pp {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-style: italic;
	}
	.pp small {
		font-size: 0.55rem;
	}
	.players {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}
	.players a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--ink);
		font-size: 0.65rem;
		font-weight: 800;
		text-decoration: none;
	}
	article > span {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.65rem;
	}
	.open {
		color: var(--signal);
		font-size: 1rem;
		text-decoration: none;
	}
	.teams > p {
		padding: 4rem;
		color: var(--muted);
		font-size: 0.7rem;
		text-align: center;
	}
	@media (max-width: 900px) {
		.head {
			display: none;
		}
		article {
			grid-template-columns: 3rem 1fr auto;
		}
		.players {
			grid-column: 2 / -1;
		}
	}
</style>
