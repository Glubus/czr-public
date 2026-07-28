<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatRecordScore } from '$lib/display';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import RecordCard from '$lib/components/organisms/RecordCard.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
	const date = (value: string | null) =>
		value
			? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
			: 'Unknown';
</script>

<svelte:head
	><title>{data.detail ? `${data.detail.playerCount}P team` : 'Team'} - Zombies Records</title
	></svelte:head
>
<div class="team-page">
	<a class="back" href={resolve(`/teams?player_count=${data.detail?.playerCount ?? 2}` as '/')}
		>← Team leaderboard</a
	>{#if data.detail}<header>
			<div>
				<span>{data.detail.playerCount}-player team</span>
				<h1>{data.detail.members.map((member) => member.name).join(' / ')}</h1>
				<p>Last verified performance {date(data.detail.lastVerifiedAt)}</p>
			</div>
			<strong>{number.format(data.detail.performancePoints)} <small>PP</small></strong>
		</header>
		<section class="members">
			<header><span>Players</span><small>{data.detail.playerCount} members</small></header>
			{#each data.detail.members as member, index (member.id)}<a
					href={resolve('/players/[id]', { id: member.id })}
					><b>{String(index + 1).padStart(2, '0')}</b><PlayerAvatar
						name={member.name}
						image={member.image}
						size="small"
					/><strong>{member.name}</strong><span aria-hidden="true">→</span></a
				>{/each}
		</section>
		<div class="metrics">
			<div><span>Records</span><strong>{data.detail.recordCount}</strong></div>
			<div><span>World records</span><strong>{data.detail.firstPlaces}</strong></div>
			<div><span>Podiums</span><strong>{data.detail.podiums}</strong></div>
		</div>
		<section class="records">
			<header>
				<div>
					<span>Verified runs</span>
					<h2>TOP TEAM RECORDS</h2>
				</div>
			</header>
			{#if data.records.length}<div>
					{#each data.records as record, index (record.submissionId)}<RecordCard
							href={resolve('/submissions/[id]', { id: String(record.submissionId) })}
							position={record.isWorldRecord ? 'WR' : String(index + 1).padStart(2, '0')}
							mapName={record.map.name}
							categoryName={record.category.name}
							context={record.game.name}
							result={formatRecordScore(record.scoreValue, record.scoreType, record.runDurationMs)}
							points={record.points}
							date={date(record.verifiedAt)}
							highlight={record.isWorldRecord}
						/>{/each}
				</div>{:else}<p>No records are available.</p>{/if}
		</section>{:else}<section class="missing">TEAM NOT FOUND</section>{/if}
</div>

<style>
	.team-page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.back {
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.team-page > header {
		display: flex;
		min-height: 15rem;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		padding: 3rem 0 2rem;
		border-bottom: 1px solid var(--line-strong);
	}
	header span,
	.records header span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h1 {
		max-width: 60rem;
		margin: 0.6rem 0;
		font-family: var(--font-display);
		font-size: clamp(2.6rem, 6vw, 5.5rem);
		font-style: italic;
		line-height: 0.9;
		text-transform: uppercase;
	}
	header p {
		color: var(--muted);
		font-size: 0.65rem;
	}
	.team-page > header > strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: clamp(2rem, 4vw, 4rem);
		font-style: italic;
	}
	.team-page > header small {
		font-size: 0.7rem;
	}
	.members {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.members > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	.members > header small {
		color: var(--muted);
		font-size: 0.54rem;
	}
	.members a {
		display: grid;
		grid-template-columns: 2.5rem auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
		padding: 1rem;
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.members a:hover {
		background: var(--panel-hover);
	}
	.members a > b,
	.members a > span {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.6rem;
	}
	.members a > strong {
		font-size: 0.72rem;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		margin-top: 1rem;
		border: 1px solid var(--line);
	}
	.metrics > div {
		display: grid;
		gap: 0.4rem;
		padding: 1rem;
		border-right: 1px solid var(--line);
		background: var(--panel);
	}
	.metrics span {
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.metrics strong {
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-style: italic;
	}
	.records {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.records > header {
		padding: 1rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.3rem 0 0;
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-style: italic;
	}
	.records > p,
	.missing {
		padding: 4rem;
		color: var(--muted);
		font-size: 0.7rem;
		text-align: center;
	}
	@media (max-width: 700px) {
		.team-page {
			padding-bottom: 6rem;
		}
		.team-page > header {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
