<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
</script>

<svelte:head><title>Team leaderboard - Zombies Records</title></svelte:head>
<div class="teams-page">
	<header>
		<div>
			<span>Team rankings</span>
			<h1>TEAM LEADERBOARD.</h1>
			<p>Every lineup is ranked independently. Changing one member creates a different team.</p>
		</div>
		<nav>
			{#each [2, 3, 4] as count (count)}<a
					class:active={data.playerCount === count}
					href={resolve(`/teams?player_count=${count}` as '/')}>{count}P</a
				>{/each}
		</nav>
	</header>
	{#if data.apiUnavailable}<FormAlert message="Team rankings are temporarily unavailable." />{/if}
	<section>
		<div class="table-head">
			<span>Rank</span><span>Players</span><span>Performance</span><span>Records</span><span
				>WRs</span
			><span></span>
		</div>
		{#if data.leaderboard?.entries.length}<div class="team-list">
				{#each data.leaderboard.entries as team (team.competitorKey)}<article>
						<strong class="rank">#{team.rank}</strong>
						<div class="roster">
							{#each team.members as member (member.id)}<a
									href={resolve('/players/[id]', { id: member.id })}
									><PlayerAvatar name={member.name} image={member.image} size="small" /><span
										>{member.name}</span
									></a
								>{/each}
						</div>
						<strong class="pp">{number.format(team.performancePoints)} <small>PP</small></strong
						><span>{team.recordCount}</span><span>{team.firstPlaces}</span><a
							class="open-team"
							href={resolve('/teams/[competitorKey]', { competitorKey: team.competitorKey })}
							aria-label={`Open ${team.members.map((member) => member.name).join(', ')}`}>→</a
						>
					</article>{/each}
			</div>{:else}<p class="empty">No {data.playerCount}P teams are ranked yet.</p>{/if}
	</section>
</div>

<style>
	.teams-page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.teams-page > header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 2rem;
	}
	header > div > span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.55rem 0;
		font-family: var(--font-display);
		font-size: clamp(3rem, 7vw, 6rem);
		font-style: italic;
		line-height: 0.85;
	}
	header p {
		margin: 1rem 0 0;
		color: var(--muted);
		font-size: 0.72rem;
	}
	header nav {
		display: flex;
		border: 1px solid var(--line);
	}
	header nav a {
		display: grid;
		width: 4rem;
		height: 3rem;
		place-items: center;
		border-right: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 900;
		text-decoration: none;
	}
	header nav a.active {
		background: var(--signal);
		color: white;
	}
	section {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.table-head,
	.team-list article {
		display: grid;
		grid-template-columns: 4rem minmax(20rem, 1fr) 10rem 6rem 5rem 5rem;
		align-items: center;
		gap: 1rem;
		padding: 0.7rem 1rem;
	}
	.table-head {
		min-height: 3rem;
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.52rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.team-list article {
		min-height: 5rem;
		border-bottom: 1px solid var(--line);
	}
	.rank {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-style: italic;
	}
	.roster {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}
	.roster a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--ink);
		font-size: 0.65rem;
		font-weight: 800;
		text-decoration: none;
	}
	.pp {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-style: italic;
	}
	.pp small {
		font-size: 0.55rem;
	}
	.team-list article > span {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.65rem;
	}
	.open-team {
		color: var(--signal);
		font-size: 1rem;
		font-weight: 900;
		text-decoration: none;
	}
	.empty {
		padding: 4rem;
		color: var(--muted);
		font-size: 0.7rem;
		text-align: center;
	}
	@media (max-width: 900px) {
		.table-head {
			display: none;
		}
		.team-list article {
			grid-template-columns: 3rem 1fr auto;
		}
		.roster {
			grid-column: 2 / -1;
		}
	}
	@media (max-width: 600px) {
		.teams-page {
			padding-bottom: 6rem;
		}
		.teams-page > header {
			align-items: flex-start;
			flex-direction: column;
		}
		.team-list article {
			grid-template-columns: auto 1fr auto;
		}
	}
</style>
