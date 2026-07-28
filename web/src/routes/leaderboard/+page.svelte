<script lang="ts">
	import { resolve } from '$app/paths';
	import AveragePointsPanel from '$lib/components/organisms/AveragePointsPanel.svelte';
	import AchievementRankingPanel from '$lib/components/organisms/AchievementRankingPanel.svelte';
	import ClanRankingPanel from '$lib/components/organisms/ClanRankingPanel.svelte';
	import LeaderboardFilters from '$lib/components/organisms/LeaderboardFilters.svelte';
	import HighestPointRecordsPanel from '$lib/components/organisms/HighestPointRecordsPanel.svelte';
	import PageHero from '$lib/components/organisms/PageHero.svelte';
	import PlayerRankingPanel from '$lib/components/organisms/PlayerRankingPanel.svelte';
	import TeamRankingPanel from '$lib/components/organisms/TeamRankingPanel.svelte';
	import Pagination from '$lib/components/molecules/Pagination.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	function query(page: number) {
		const params = [`page=${page}`];
		if (data.filters.view === 'achievements') params.push('view=achievements');
		if (data.filters.game) params.push(`game=${encodeURIComponent(data.filters.game)}`);
		if (data.filters.category) params.push(`category=${encodeURIComponent(data.filters.category)}`);
		if (data.filters.mapsStatus !== 'all') params.push(`maps_status=${data.filters.mapsStatus}`);
		if (data.filters.scope !== 'world') params.push(`scope=${data.filters.scope}`);
		if (data.filters.country) params.push(`country=${data.filters.country}`);
		return `/leaderboard?${params.join('&')}`;
	}
	function viewHref(view: 'players' | 'records' | 'average' | 'achievements' | 'teams' | 'clans') {
		const params: string[] = [];
		if (view !== 'players') params.push(`view=${view}`);
		if (view === 'teams') params.push(`player_count=${data.filters.playerCount}`);
		if (view === 'teams' || view === 'clans') {
			return `/leaderboard?${params.join('&')}`;
		}
		if (data.filters.game) params.push(`game=${encodeURIComponent(data.filters.game)}`);
		if (data.filters.category) {
			params.push(`category=${encodeURIComponent(data.filters.category)}`);
		}
		if (data.filters.mapsStatus !== 'all') params.push(`maps_status=${data.filters.mapsStatus}`);
		if (data.filters.scope !== 'world') params.push(`scope=${data.filters.scope}`);
		if (data.filters.country) params.push(`country=${data.filters.country}`);
		return `/leaderboard${params.length ? `?${params.join('&')}` : ''}`;
	}
</script>

<svelte:head><title>Global leaderboard - Zombies Records</title></svelte:head>
<div class="page">
	<PageHero compact eyebrow="Zombies / Global ranking" title="GLOBAL LEADERBOARD." />
	<nav class="views" aria-label="Leaderboard type">
		<a class:active={data.filters.view === 'players'} href={resolve(viewHref('players') as '/')}
			>Players</a
		>
		<a class:active={data.filters.view === 'records'} href={resolve(viewHref('records') as '/')}
			>Highest PP Records</a
		>
		<a class:active={data.filters.view === 'average'} href={resolve(viewHref('average') as '/')}
			>Highest Average PP</a
		>
		<a
			class:active={data.filters.view === 'achievements'}
			href={resolve(viewHref('achievements') as '/')}>Achievement Points</a
		>
		<a class:active={data.filters.view === 'teams'} href={resolve(viewHref('teams') as '/')}
			>Teams</a
		>
		<a class:active={data.filters.view === 'clans'} href={resolve(viewHref('clans') as '/')}
			>Clans</a
		>
	</nav>
	{#if data.filters.view === 'teams'}
		<TeamRankingPanel leaderboard={data.teams} playerCount={data.filters.playerCount} />
	{:else if data.filters.view === 'clans'}
		<ClanRankingPanel leaderboard={data.clans} />
	{:else if data.filters.view === 'records'}
		<LeaderboardFilters
			games={data.games}
			categories={data.categories}
			filters={data.filters}
			view="records"
		/>
		<HighestPointRecordsPanel records={data.highestRecords} />
	{:else if data.filters.view === 'achievements'}
		<AchievementRankingPanel
			entries={data.achievementLeaderboard?.entries ?? []}
			page={data.filters.page}
		/>
		<Pagination
			current={data.filters.page + 1}
			totalPages={data.achievementLeaderboard?.totalPages ?? 0}
			pageHref={(page) => query(page - 1)}
		/>
	{:else if data.filters.view === 'average'}
		<LeaderboardFilters
			games={data.games}
			categories={data.categories}
			filters={data.filters}
			view="average"
		/>
		<AveragePointsPanel leaderboard={data.highestAverage} />
	{:else}
		<LeaderboardFilters
			games={data.games}
			categories={data.categories}
			filters={data.filters}
			defaultCountry={data.user?.countryCode ?? ''}
		/>
		<PlayerRankingPanel entries={data.leaderboard?.entries ?? []} page={data.filters.page} />
		<Pagination
			current={data.filters.page + 1}
			totalPages={data.leaderboard?.totalPages ?? 0}
			pageHref={(page) => query(page - 1)}
		/>
	{/if}
</div>

<style>
	.page {
		padding: clamp(1rem, 3vw, 3rem);
	}
	.views {
		display: flex;
		overflow-x: auto;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
	}
	.views a {
		min-width: 11rem;
		padding: 0.95rem 1.2rem;
		border-right: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 900;
		text-align: center;
		text-decoration: none;
		text-transform: uppercase;
	}
	.views a.active {
		background: var(--signal);
		color: #10120e;
	}
</style>
