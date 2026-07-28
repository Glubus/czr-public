<script lang="ts">
	import { resolve } from '$app/paths';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import MetricGrid from '$lib/components/molecules/MetricGrid.svelte';
	import PerformanceChart from '$lib/components/organisms/PerformanceChart.svelte';
	import PlayActivityChart from '$lib/components/organisms/PlayActivityChart.svelte';
	import MostPlayed from '$lib/components/organisms/MostPlayed.svelte';
	import TopPlays from '$lib/components/organisms/TopPlays.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import PlayerMilestones from '$lib/features/player-profile/PlayerMilestones.svelte';
	import ScopedPlayerRanks from '$lib/features/player-profile/ScopedPlayerRanks.svelte';
	import SharedPersonalRuns from '$lib/features/player-profile/SharedPersonalRuns.svelte';
	import VerifiedRecordHistory from '$lib/features/player-profile/VerifiedRecordHistory.svelte';
	import type { PlayerProfileTab } from '$lib/features/player-profile/contracts';
	import type { ActionData, PageData } from './$types';
	import CountryFlag from '$lib/components/CountryFlag.svelte';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	let tab = $state<PlayerProfileTab>('top');
	let profileGlow = $derived(
		data.records?.user.profileColor?.toLowerCase() === '#101311'
			? '#e45735'
			: (data.records?.user.profileColor ?? '#e45735')
	);
	let pinnedRecords = $derived(data.records?.pinnedEntries ?? []);
	let worldRecords = $derived(data.records?.worldRecordEntries ?? []);
	let ownsProfile = $derived(Boolean(data.records && data.viewer?.id === data.records.user.id));
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }),
		decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
	let metrics = $derived(
		data.records
			? [
					{
						label: 'Performance',
						value: decimal.format(data.records.user.performancePoints),
						suffix: 'PP'
					},
					{
						label: 'Clan',
						value: data.socialContext.clan?.name ?? '-',
						suffix: data.socialContext.clan
							? `${data.socialContext.clan.role} · View roster →`
							: 'No affiliation',
						...(data.socialContext.clan
							? {
									href: resolve('/clans/[slug]', {
										slug: data.socialContext.clan.slug
									})
								}
							: {})
					},
					{
						label: 'Ranked records',
						value: number.format(data.records.recordCount),
						suffix: 'Active bests'
					},
					{
						label: 'Average record',
						value: decimal.format(data.records.averageRecordPoints),
						suffix: 'PP per best'
					}
				]
			: []
	);
</script>

<svelte:head>
	<title>{data.records?.user.name ?? 'Player'} - Zombies Records</title>
	<meta
		name="description"
		content={data.records
			? `${data.records.user.name} is ranked #${data.records.globalRank} with ${Math.round(data.records.user.performancePoints)} PP on Zombies Records.`
			: 'Competitive Zombies player profile.'}
	/>
	<meta property="og:type" content="profile" />
	<meta property="og:title" content={`${data.records?.user.name ?? 'Player'} - Zombies Records`} />
	<meta
		property="og:description"
		content={data.records
			? `Global rank #${data.records.globalRank} · ${Math.round(data.records.user.performancePoints)} PP · ${data.records.recordCount} ranked records.`
			: 'Competitive Zombies player profile.'}
	/>
	{#if data.records?.user.image}<meta property="og:image" content={data.records.user.image} />{/if}
</svelte:head>
<div class="page" style:--profile-glow={profileGlow}>
	<a class="back" href={resolve('/leaderboard')}>← Global leaderboard</a>{#if data.records}<header
			class:has-background={Boolean(data.records.user.backgroundImage)}
			style:--profile-background={data.records.user.backgroundImage
				? `url("${data.records.user.backgroundImage}")`
				: 'none'}
		>
			<PlayerAvatar name={data.records.user.name} image={data.records.user.image} size="profile" />
			<div class="identity">
				<Eyebrow>Player profile</Eyebrow>
				<h1>{data.records.user.name}</h1>
				<span>{data.records.recordCount} ranked records</span>
				{#if data.badges.length}<div class="badges">
						{#each data.badges as badge (badge.id)}
							<span style:--badge-color={badge.color} title={badge.description}>{badge.name}</span>
						{/each}
					</div>{/if}
			</div>
			{#if data.viewer?.id !== data.records.user.id}<div class="profile-actions">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
						href={`${resolve('/compare')}?player1=${encodeURIComponent(data.records.user.id)}`}
						>Compare</a
					>
					<form method="POST" action="?/follow" class="follow-form">
						<input type="hidden" name="following" value={String(data.isFollowing)} />
						<button class:following={data.isFollowing}
							>{data.isFollowing ? 'Following ✓' : '+ Follow'}</button
						>
					</form>
				</div>{/if}
			<div class="ranks">
				<div class="rank">
					<small>GLOBAL RANK</small><strong>#{number.format(data.records.globalRank)}</strong>
					{#if data.records.user.countryCode && data.records.countryRank}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={`${resolve('/leaderboard')}?scope=country&country=${data.records.user.countryCode}`}
							class="country-rank"
						>
							<CountryFlag
								code={data.records.user.countryCode}
								label={`${data.records.user.countryCode} flag`}
								size="large"
							/>
							<span
								><b>#{number.format(data.records.countryRank)}</b>
								{data.records.user.countryCode}</span
							>
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>
			</div>
		</header>
		{#if form?.message}<FormAlert message={form.message} />{/if}
		<MetricGrid items={metrics} />
		<nav class="profile-tabs" aria-label="Profile sections">
			{#each [{ id: 'top', label: 'Top plays', count: data.records.recordCount }, { id: 'history', label: 'History', count: data.history.length }, { id: 'played', label: 'Most played', count: data.records.mostPlayed.totalPlayCount }, { id: 'runs', label: 'Personal runs', count: data.personalRuns.length }, { id: 'ranks', label: 'Ranks', count: data.ranks.games.length + data.ranks.categories.length }, { id: 'achievements', label: 'Achievements', count: data.achievements.filter((entry) => entry.unlockedAt).length }] as item (item.id)}
				<button
					data-testid={`profile-tab-${item.id}`}
					class:active={tab === item.id}
					onclick={() => (tab = item.id as PlayerProfileTab)}
					>{item.label}<span>{item.count}</span></button
				>
			{/each}
		</nav>
		{#if tab === 'top'}<PerformanceChart
				history={data.performanceHistory}
				current={data.records.user.performancePoints}
			/>
			{#if ownsProfile || pinnedRecords.length}<TopPlays
					records={pinnedRecords}
					title="PINNED RECORDS"
					eyebrow="Profile showcase"
					meta={`${pinnedRecords.length}/3 PINNED`}
					empty="Pin up to three current PBs from the Best or World Records sections."
					owner={ownsProfile}
					pinnedIds={data.records.pinnedSubmissionIds}
				/>{/if}<TopPlays
				records={data.records.entries}
				title="BEST"
				meta={`TOP ${data.records.recordCount} BY PP`}
				owner={ownsProfile}
				showContribution
				pinnedIds={data.records.pinnedSubmissionIds}
			/><TopPlays
				records={worldRecords}
				title="WORLD RECORDS"
				eyebrow="Current number ones"
				meta={`${worldRecords.length} ACTIVE WR`}
				empty="No active world records right now."
				owner={ownsProfile}
				pinnedIds={data.records.pinnedSubmissionIds}
			/>
		{:else if tab === 'history'}<VerifiedRecordHistory records={data.history} />
		{:else if tab === 'played'}<PlayActivityChart
				history={data.records.mostPlayed.playHistory}
				total={data.records.mostPlayed.totalPlayCount}
			/><MostPlayed data={data.records.mostPlayed} />
		{:else if tab === 'runs'}<SharedPersonalRuns runs={data.personalRuns} />
		{:else if tab === 'ranks'}<ScopedPlayerRanks ranks={data.ranks} />
		{:else}<PlayerMilestones
				achievements={data.achievements}
				socialContext={data.socialContext}
			/>{/if}
	{:else}<section class="missing">
			<strong>PLAYER NOT FOUND</strong>
			<p>This profile could not be loaded.</p>
		</section>{/if}
</div>

<style>
	.page {
		position: relative;
		min-height: 100%;
		padding: clamp(0.75rem, 1.25vw, 1.25rem) clamp(1rem, 3vw, 3rem) clamp(1rem, 3vw, 3rem);
	}
	.back {
		display: inline-block;
		margin-bottom: clamp(1rem, 2vw, 1.75rem);
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		text-decoration: none;
		text-transform: uppercase;
	}
	.page > header {
		display: flex;
		position: relative;
		min-height: 18rem;
		align-items: flex-end;
		gap: 1.5rem;
		padding: 3rem clamp(1rem, 3vw, 2.5rem) 2rem;
		border-bottom: 1px solid var(--line-strong);
		background: color-mix(in srgb, var(--panel) 92%, transparent);
		box-shadow:
			0 1.4rem 4.5rem -2.3rem color-mix(in srgb, var(--profile-glow) 58%, transparent),
			inset 0 0 5rem color-mix(in srgb, var(--profile-glow) 10%, transparent);
		isolation: isolate;
	}
	.page > header::after,
	.page > header.has-background::before {
		position: absolute;
		z-index: -1;
		inset: 0;
		content: '';
		pointer-events: none;
	}
	.page > header::after {
		background: linear-gradient(90deg, rgba(7, 9, 8, 0.72), rgba(7, 9, 8, 0.2));
	}
	.page > header.has-background::before {
		z-index: -2;
		background-image: var(--profile-background);
		background-position: center;
		background-size: cover;
		-webkit-mask-image: linear-gradient(to bottom, black 0%, black 50%, transparent 100%);
		mask-image: linear-gradient(to bottom, black 0%, black 50%, transparent 100%);
	}
	.page > header.has-background::after {
		background: linear-gradient(90deg, rgba(7, 9, 8, 0.88), rgba(7, 9, 8, 0.3));
	}
	.identity {
		min-width: 0;
	}
	.identity h1 {
		margin: 0.65rem 0 0.45rem;
		overflow-wrap: anywhere;
		font-family: var(--font-display);
		font-size: clamp(3.2rem, 7vw, 7.5rem);
		font-style: italic;
		letter-spacing: -0.035em;
		line-height: 0.8;
	}
	.identity > span {
		color: var(--muted);
		font-size: 0.72rem;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.65rem;
	}
	.badges span {
		padding: 0.3rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--badge-color) 65%, transparent);
		background: color-mix(in srgb, var(--badge-color) 16%, transparent);
		color: color-mix(in srgb, var(--badge-color) 78%, white);
		font: 900 0.56rem monospace;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.profile-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}
	.profile-actions > a,
	.follow-form button {
		min-height: 2.7rem;
		padding: 0 0.9rem;
		border: 1px solid var(--line-strong);
		background: transparent;
		color: var(--ink);
		font-size: 0.58rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
		display: flex;
		align-items: center;
	}
	.ranks {
		display: flex;
		align-items: end;
		gap: clamp(1rem, 2.5vw, 2.5rem);
		margin-left: auto;
	}
	.rank {
		display: grid;
		justify-items: end;
	}
	.rank small {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.12em;
	}
	.rank strong {
		margin-top: 0.35rem;
		color: var(--signal);
		font-family: var(--font-display);
		font-size: clamp(2rem, 4vw, 4rem);
		font-style: italic;
	}
	.country-rank {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.2rem;
		color: var(--muted);
		font: 800 0.58rem monospace;
		text-decoration: none;
	}
	.country-rank:hover {
		color: var(--ink);
	}
	.country-rank b {
		color: var(--ink);
		font-size: 1.15rem;
		line-height: 1;
	}
	.follow-form {
		margin-left: auto;
	}
	.follow-form button {
		min-height: 2.7rem;
		padding: 0 1rem;
		border: 1px solid var(--signal);
		background: var(--signal);
		color: white;
		font-size: 0.62rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	.follow-form button.following {
		border-color: var(--line-strong);
		background: transparent;
		color: var(--muted);
	}
	.profile-tabs {
		display: flex;
		margin-top: 1rem;
		overflow-x: auto;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
	}
	.profile-tabs button {
		display: flex;
		min-height: 3.3rem;
		align-items: center;
		gap: 0.7rem;
		padding: 0 1.2rem;
		border: 0;
		border-right: 1px solid var(--line);
		background: transparent;
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	.profile-tabs button span {
		font-family: monospace;
		font-size: 0.52rem;
	}
	.profile-tabs button.active {
		background: var(--signal);
		color: white;
	}
	.missing {
		display: grid;
		min-height: 24rem;
		place-content: center;
		justify-items: center;
		margin-top: 2rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.missing strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2rem;
	}
	.missing p {
		color: var(--muted);
		font-size: 0.75rem;
	}
	@media (max-width: 850px) {
		.page > header {
			min-height: 15rem;
			flex-wrap: wrap;
		}
		.ranks {
			width: 100%;
			margin-left: 0;
		}
		.rank {
			justify-items: start;
		}
		.follow-form {
			margin-left: 0;
		}
	}
	@media (max-width: 600px) {
		.page > header {
			align-items: center;
			gap: 1rem;
		}
	}
</style>
