<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ClanLeaderboard } from '$lib/types';

	let { leaderboard }: { leaderboard: ClanLeaderboard | null } = $props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
</script>

<p class="explanation">A clan's 20 strongest eligible records define its score.</p>
<section>
	<div class="head">
		<span>Rank</span><span>Clan</span><span>Members</span><span>Counted runs</span><span>Score</span
		>
	</div>
	{#if leaderboard?.entries.length}<div>
			{#each leaderboard.entries as entry (entry.clan.id)}<a
					href={resolve('/clans/[slug]', { slug: entry.clan.slug })}
					><strong>#{entry.rank}</strong>
					<div><span>{entry.clan.name}</span><small>{entry.clan.slug}</small></div>
					<span>{entry.clan.memberCount}</span><span
						>{entry.countedRunCount}/{entry.eligibleRunCount}</span
					><b>{number.format(entry.score)} <small>PTS</small></b></a
				>{/each}
		</div>{:else}<p>No clans are ranked yet.</p>{/if}
</section>

<style>
	.explanation {
		margin: 1rem 0;
		color: var(--muted);
		font-size: 0.7rem;
	}
	section {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.head,
	section a {
		display: grid;
		grid-template-columns: 5rem minmax(15rem, 1fr) 7rem 8rem 10rem;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 1rem;
	}
	.head {
		border-bottom: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.52rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	section a {
		min-height: 4.7rem;
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	section a:hover {
		background: var(--panel-hover);
	}
	section a > strong,
	section a > b {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-style: italic;
	}
	section a > div {
		display: grid;
		gap: 0.2rem;
	}
	section a > div span {
		font-size: 0.75rem;
		font-weight: 900;
	}
	section a small,
	section a > span {
		color: var(--muted);
		font-size: 0.55rem;
	}
	section > p {
		padding: 4rem;
		color: var(--muted);
		text-align: center;
	}
	@media (max-width: 700px) {
		.head {
			display: none;
		}
		section a {
			grid-template-columns: auto 1fr auto;
		}
		section a > span {
			display: none;
		}
	}
</style>
