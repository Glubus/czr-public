<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
</script>

<svelte:head><title>Clan leaderboard - Zombies Records</title></svelte:head>
<div class="clans-page">
	<header>
		<span>Community rankings</span>
		<h1>CLAN LEADERBOARD.</h1>
		<p>A clan's 20 strongest eligible records define its score.</p>
	</header>
	{#if data.apiUnavailable}<FormAlert message="Clan rankings are temporarily unavailable." />{/if}
	<section>
		<div class="head">
			<span>Rank</span><span>Clan</span><span>Members</span><span>Counted runs</span><span
				>Score</span
			>
		</div>
		{#if data.leaderboard?.entries.length}<div>
				{#each data.leaderboard.entries as entry (entry.clan.id)}<a
						href={resolve('/clans/[slug]', { slug: entry.clan.slug })}
						><strong>#{entry.rank}</strong>
						<div><span>{entry.clan.name}</span><small>{entry.clan.slug}</small></div>
						<span>{entry.clan.memberCount}</span><span
							>{entry.countedRunCount}/{entry.eligibleRunCount}</span
						><b>{number.format(entry.score)} <small>PTS</small></b></a
					>{/each}
			</div>{:else}<p>No clans are ranked yet.</p>{/if}
	</section>
</div>

<style>
	.clans-page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	header > span {
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
		margin: 1rem 0 2rem;
		color: var(--muted);
		font-size: 0.72rem;
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
	section a > strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.25rem;
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
	section a small {
		color: var(--muted);
		font-size: 0.53rem;
		text-transform: uppercase;
	}
	section a > span {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.62rem;
	}
	section a > b {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-style: italic;
	}
	section > p {
		padding: 4rem;
		color: var(--muted);
		font-size: 0.7rem;
		text-align: center;
	}
	@media (max-width: 700px) {
		.clans-page {
			padding-bottom: 6rem;
		}
		.head {
			display: none;
		}
		section a {
			grid-template-columns: auto 1fr auto;
		}
		.clans-page section a > span {
			display: none;
		}
	}
</style>
