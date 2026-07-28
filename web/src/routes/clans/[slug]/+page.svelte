<script lang="ts">
	import { resolve } from '$app/paths';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const date = (value: string) =>
		new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
</script>

<svelte:head><title>{data.clan?.name ?? 'Clan'} - Zombies Records</title></svelte:head>
<div class="clan-page">
	<a href={resolve('/leaderboard?view=clans' as '/')} class="back">← Clan leaderboard</a
	>{#if data.clan}<header
			class:has-background={Boolean(data.clan.backgroundImage)}
			style:--clan-background={data.clan.backgroundImage
				? `url("${data.clan.backgroundImage}")`
				: 'none'}
		>
			{#if data.clan.logoImage}<img class="clan-logo" src={data.clan.logoImage} alt="" />{/if}
			<div>
				<span>Clan / {data.clan.slug}</span>
				<h1>{data.clan.name}</h1>
				<p>{data.clan.members.length} members · founded {date(data.clan.createdAt)}</p>
			</div>
		</header>
		<div class="stats">
			<div>
				<small>Clan rank</small><strong>{data.stats?.rank ? `#${data.stats.rank}` : '-'}</strong
				><span>Global</span>
			</div>
			<div>
				<small>Clan score</small><strong>{number.format(data.stats?.score ?? 0)}</strong><span
					>Top 20 records</span
				>
			</div>
			<div>
				<small>Eligible records</small><strong
					>{number.format(data.stats?.eligibleRunCount ?? 0)}</strong
				><span>{data.stats?.countedRunCount ?? 0} counted</span>
			</div>
			<div>
				<small>Member PP</small><strong>{number.format(data.stats?.memberPoints ?? 0)}</strong><span
					>Current roster total</span
				>
			</div>
		</div>
		<section>
			<header>
				<div>
					<span>Current roster</span>
					<h2>MEMBERS</h2>
				</div>
				<b>{data.clan.members.length}</b>
			</header>
			<div class="members">
				{#each data.clan.members as member (member.id)}<a
						href={resolve('/players/[id]', { id: member.user.id })}
						><PlayerAvatar name={member.user.name} image={member.user.image} size="medium" />
						<div>
							<strong>{member.user.name}</strong><small>Joined {date(member.joinedAt)}</small>
						</div>
						<div class="member-score">
							<b>{number.format(member.user.performancePoints)} PP</b><span>{member.role}</span>
						</div></a
					>{/each}
			</div>
		</section>{:else}<div class="missing">CLAN NOT FOUND</div>{/if}
</div>

<style>
	.clan-page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.back {
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.clan-page > header {
		display: flex;
		align-items: end;
		gap: 1.5rem;
		min-height: 14rem;
		padding: 4rem 0 2rem;
		border-bottom: 1px solid var(--line-strong);
	}
	.clan-page > header.has-background {
		padding-inline: clamp(1rem, 3vw, 2.5rem);
		background-image:
			linear-gradient(90deg, rgba(7, 9, 8, 0.92), rgba(7, 9, 8, 0.42)), var(--clan-background);
		background-position: center;
		background-size: cover;
	}
	.clan-logo {
		width: clamp(5rem, 10vw, 8rem);
		aspect-ratio: 1;
		border: 1px solid var(--line-strong);
		object-fit: cover;
	}
	.clan-page > header > div > span,
	section header span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.6rem 0;
		font-family: var(--font-display);
		font-size: clamp(3rem, 8vw, 7rem);
		font-style: italic;
		line-height: 0.85;
		text-transform: uppercase;
	}
	.clan-page > header p {
		color: var(--muted);
		font-size: 0.65rem;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.stats > div {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		border-right: 1px solid var(--line);
	}
	.stats > div:last-child {
		border-right: 0;
	}
	.stats small,
	.stats span {
		color: var(--muted);
		font: 800 0.55rem monospace;
		text-transform: uppercase;
	}
	.stats strong {
		color: var(--signal);
		font: italic 2rem var(--font-display);
	}
	section {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	section > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.3rem 0 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-style: italic;
	}
	section header b {
		color: var(--signal);
		font-family: monospace;
	}
	.members {
		display: grid;
		grid-template-columns: 1fr;
	}
	.members a {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
		padding: 1rem;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.members a > div {
		display: grid;
		gap: 0.2rem;
	}
	.members strong {
		font-size: 0.7rem;
	}
	.members small {
		color: var(--muted);
		font-size: 0.52rem;
	}
	.member-score {
		display: grid;
		justify-items: end;
		gap: 0.2rem;
	}
	.member-score b {
		font: 800 0.58rem monospace;
	}
	.member-score span {
		color: var(--signal);
		font-size: 0.52rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.missing {
		padding: 8rem;
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2rem;
		text-align: center;
	}
	@media (max-width: 800px) {
		.stats {
			grid-template-columns: 1fr 1fr;
		}
		.stats > div:nth-child(2) {
			border-right: 0;
		}
	}
	@media (max-width: 550px) {
		.clan-page {
			padding-bottom: 6rem;
		}
		.stats {
			grid-template-columns: 1fr;
		}
		.stats > div {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
	}
</style>
