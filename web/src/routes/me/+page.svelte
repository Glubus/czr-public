<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import ClanDashboard from '$lib/features/player-dashboard/ClanDashboard.svelte';
	import DashboardOverview from '$lib/features/player-dashboard/DashboardOverview.svelte';
	import GoalsDashboard from '$lib/features/player-dashboard/GoalsDashboard.svelte';
	import PersonalRunsDashboard from '$lib/features/player-dashboard/PersonalRunsDashboard.svelte';
	import ProfileSettingsDashboard from '$lib/features/player-dashboard/ProfileSettingsDashboard.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	type Section = 'overview' | 'runs' | 'goals' | 'clan' | 'settings';
	const tabs: { id: Section; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'runs', label: 'Personal runs' },
		{ id: 'goals', label: 'Goals' },
		{ id: 'clan', label: 'Clan' },
		{ id: 'settings', label: 'Settings' }
	];
	function initialSection(): Section {
		return form?.section === 'settings' ? 'settings' : 'overview';
	}
	let section = $state<Section>(initialSection());
	let user = $derived(data.user!);
	let statuses = $derived(
		data.submissions.reduce<Record<string, number>>((counts, entry) => {
			counts[entry.submission.status] = (counts[entry.submission.status] ?? 0) + 1;
			return counts;
		}, {})
	);
</script>

<svelte:head><title>My dashboard - Zombies Records</title></svelte:head>

<main class="dashboard">
	<header class="hero">
		<div class="identity">
			<PlayerAvatar name={user.name} image={user.image} size="large" />
			<div>
				<span>Player dashboard</span>
				<h1>{user.name}</h1>
				<a href={resolve('/players/[id]', { id: user.id })}>View public profile ↗</a>
			</div>
		</div>
		<a class="primary" href={resolve('/submit')}>+ Submit a record</a>
	</header>

	<nav aria-label="Dashboard sections">
		{#each tabs as tab (tab.id)}<button
				class:active={section === tab.id}
				onclick={() => (section = tab.id)}>{tab.label}</button
			>{/each}
	</nav>

	{#if data.apiUnavailable}<FormAlert message="Some dashboard data could not be loaded." />{/if}
	{#if form?.message}<FormAlert message={form.message} />{/if}

	{#if section === 'overview'}
		<DashboardOverview
			submissions={data.submissions}
			invitations={data.invitations}
			notifications={data.notifications}
			feed={data.feed}
			{statuses}
		/>
	{:else if section === 'runs'}
		<PersonalRunsDashboard runs={data.runs} games={data.games} />
	{:else if section === 'goals'}
		<GoalsDashboard goals={data.goals} challenges={data.challenges} games={data.games} />
	{:else if section === 'clan'}
		<ClanDashboard
			clan={data.clan}
			ownClanRole={data.ownClanRole}
			clanPreferences={data.clanPreferences}
			clanInvitations={data.clanInvitations}
			managedClanInvitations={data.managedClanInvitations}
			user={data.user}
		/>
	{:else}
		<ProfileSettingsDashboard user={data.user} claims={data.claims} />
	{/if}
</main>

<style>
	.dashboard {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.hero {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2rem;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.identity span {
		color: var(--signal);
		font: 900 0.58rem monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.2rem 0;
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 5vw, 4rem);
		font-style: italic;
		line-height: 0.9;
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	.primary {
		background: var(--signal);
		color: #101311;
		padding: 0.8rem 1rem;
		font-weight: 900;
	}
	nav {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.2rem;
		border-bottom: 1px solid var(--line);
		overflow-x: auto;
	}
	nav button {
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--muted);
		padding: 0.8rem 1rem;
		cursor: pointer;
		white-space: nowrap;
	}
	nav button.active {
		border-color: var(--signal);
		color: var(--text);
	}
	@media (max-width: 650px) {
		.hero {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
