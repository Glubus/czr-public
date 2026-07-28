<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import GlobalSearch from '$lib/components/organisms/GlobalSearch.svelte';
	import NavigationLoading from '$lib/components/organisms/NavigationLoading.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import '../app.css';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
	const navigation = [
		{ href: '/', label: 'Home', icon: '⌂' },
		{ href: '/games', label: 'Games', icon: '▦' },
		{ href: '/leaderboard', label: 'Leaderboards', icon: '≡' },
		{ href: '/compare', label: 'Compare', icon: '⇄' },
		{ href: '/submit', label: 'Submit', icon: '+' }
	] as const;
	let currentPath = $derived(page.url.pathname);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#0b0d0c" />
	{#if !currentPath.startsWith('/players/') && !currentPath.startsWith('/maps/') && !currentPath.startsWith('/submissions/')}
		<meta name="description" content="Verified Zombies leaderboards, records and statistics." />
	{/if}
</svelte:head>

<a class="skip-link" href="#content">Skip to content</a>
<NavigationLoading />
<div class="app-shell">
	<aside class="sidebar">
		<a class="brand-link" href={resolve('/')} aria-label="Home"><BrandMark /></a>
		<nav class="desktop-nav" aria-label="Primary navigation">
			<p class="nav-label">Explore</p>
			{#each navigation as item (item.href)}
				<a
					class:active={currentPath === item.href ||
						(item.href !== '/' && currentPath.startsWith(`${item.href}/`))}
					href={resolve(item.href)}><span aria-hidden="true">{item.icon}</span>{item.label}</a
				>
			{/each}
		</nav>
	</aside>

	<div class="main-column">
		<header class="topbar">
			<a class="mobile-brand" href={resolve('/')} aria-label="Home"><BrandMark compact /></a>
			<GlobalSearch />
			{#if data.user}
				<div class="account-area">
					<a
						class="notification-button"
						href={resolve('/me')}
						aria-label={`${data.unreadNotifications} unread notifications`}
					>
						<span aria-hidden="true">♢</span>{#if data.unreadNotifications}<b
								>{Math.min(99, data.unreadNotifications)}</b
							>{/if}
					</a>
					<details class="account-menu">
						<summary class="account-link"
							><PlayerAvatar name={data.user.name} image={data.user.image} size="small" /><span
								>{data.user.name}</span
							><b aria-hidden="true">⌄</b></summary
						>
						<div>
							<a href={resolve('/me')}
								><span>Dashboard</span><small>Submissions, goals & settings</small></a
							>
							<a href={resolve('/players/[id]', { id: data.user.id })}
								><span>Public profile</span><small>View your competitive page</small></a
							>
							{#if data.user.roles.some( (role) => ['ROLE_ADMIN', 'ROLE_MODERATOR', 'ROLE_CHECKER'].includes(role) )}<a
									href={resolve('/admin')}><span>Moderation</span><small>Review the queue</small></a
								>{/if}
							<form method="POST" action={resolve('/logout')}>
								<button type="submit">Sign out <span>↪</span></button>
							</form>
						</div>
					</details>
				</div>
			{:else}
				<a class="submit-button" href={resolve('/login')}
					>Sign in <span aria-hidden="true">→</span></a
				>
			{/if}
		</header>
		<main id="content">{@render children()}</main>
		<footer class="site-footer">
			<div>
				<BrandMark compact />
				<p>Community-maintained Zombies records, rankings and player history.</p>
			</div>
			<nav aria-label="Legal information">
				<a href={resolve('/privacy')}>Privacy</a>
				<a href={resolve('/terms')}>Terms</a>
				{#if data.legalContactEmail}
					<a href={`mailto:${data.legalContactEmail}`}>Contact</a>
				{/if}
			</nav>
			<small>© {new Date().getFullYear()} {data.legalOperatorName ?? 'Zombies Records'}</small>
		</footer>
	</div>

	<nav class="mobile-nav" aria-label="Navigation mobile">
		{#each navigation as item (item.href)}
			<a
				class:active={currentPath === item.href ||
					(item.href !== '/' && currentPath.startsWith(`${item.href}/`))}
				href={resolve(item.href)}
				><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></a
			>
		{/each}
	</nav>
</div>

<style>
	.account-area,
	.account-link {
		display: flex;
		align-items: center;
	}
	.account-area {
		gap: 0.5rem;
	}
	.site-footer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 2rem;
		width: min(calc(100% - 2rem), 94rem);
		margin: 3rem auto 0;
		padding: 1.5rem 1rem 2rem;
		border-top: 1px solid var(--line);
		color: var(--muted);
	}
	.site-footer > div {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.site-footer p {
		max-width: 24rem;
		margin: 0;
		font-size: 0.57rem;
		line-height: 1.5;
	}
	.site-footer nav {
		display: flex;
		gap: 1.2rem;
	}
	.site-footer a {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 800;
		text-decoration: none;
		text-transform: uppercase;
	}
	.site-footer a:hover {
		color: var(--ink);
	}
	.site-footer > small {
		font-size: 0.5rem;
		white-space: nowrap;
	}
	.account-menu {
		position: relative;
	}
	.account-menu summary {
		cursor: pointer;
		list-style: none;
	}
	.account-menu summary::-webkit-details-marker {
		display: none;
	}
	.account-menu summary > b {
		color: var(--muted);
		font-size: 0.7rem;
	}
	.account-menu > div {
		position: absolute;
		top: calc(100% + 0.7rem);
		right: 0;
		z-index: 50;
		width: 16rem;
		padding: 0.35rem;
		border: 1px solid var(--line-strong);
		background: #101311;
		box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.55);
	}
	.account-menu > div > a {
		display: grid;
		gap: 0.22rem;
		padding: 0.75rem;
		color: var(--ink);
		text-decoration: none;
	}
	.account-menu > div > a:hover {
		background: var(--panel-hover);
	}
	.account-menu > div > a span {
		font-size: 0.68rem;
		font-weight: 900;
	}
	.account-menu > div > a small {
		color: var(--muted);
		font-size: 0.55rem;
	}
	.account-menu form {
		margin-top: 0.25rem;
		padding-top: 0.25rem;
		border-top: 1px solid var(--line);
	}
	.account-menu form button {
		display: flex;
		width: 100%;
		height: auto;
		justify-content: space-between;
		padding: 0.75rem;
		border: 0;
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.notification-button {
		position: relative;
		display: grid;
		width: 2.3rem;
		height: 2.3rem;
		place-items: center;
		border: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.notification-button b {
		position: absolute;
		top: -0.35rem;
		right: -0.35rem;
		display: grid;
		min-width: 1rem;
		height: 1rem;
		place-items: center;
		padding: 0 0.2rem;
		border-radius: 1rem;
		background: var(--signal);
		color: white;
		font-size: 0.48rem;
	}
	.account-link {
		gap: 0.6rem;
		color: var(--ink);
		font-size: 0.72rem;
		font-weight: 800;
		text-decoration: none;
	}
	.account-area button {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: 1px solid var(--line);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
	@media (max-width: 580px) {
		.account-link > span {
			display: none;
		}
		.site-footer {
			grid-template-columns: 1fr;
			gap: 1rem;
			margin-bottom: 4rem;
		}
		.site-footer > div {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
