<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/atoms/Badge.svelte';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import BadgeAdministration from '$lib/features/admin-dashboard/BadgeAdministration.svelte';
	import ModerationQueue from '$lib/features/admin-dashboard/ModerationQueue.svelte';
	import ProfileClaimsQueue from '$lib/features/admin-dashboard/ProfileClaimsQueue.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const age = (value: string) => {
		const hours = Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000);
		return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
	};
	const metrics = $derived([
		{ index: '01', label: 'Pending review', value: data.overview?.submissions.pending ?? 0 },
		{
			index: '02',
			label: 'Awaiting roster',
			value: data.overview?.submissions.awaiting_participants ?? 0
		},
		{ index: '03', label: 'Profile claims', value: data.overview?.profileClaims.pending ?? 0 },
		{ index: '04', label: 'Verified records', value: data.overview?.submissions.verified ?? 0 }
	]);
</script>

<svelte:head><title>Moderation - Zombies Records</title></svelte:head>

<main>
	<div class="admin-shell">
		<aside class="rail">
			<header>
				<span>ZR</span>
				<div>
					<strong>Control room</strong>
					<small>Admin workspace</small>
				</div>
			</header>
			<nav aria-label="Admin sections">
				<a class="active" href={resolve('/admin')}>
					<i>01</i><span><strong>Moderation</strong><small>Queues & claims</small></span>
				</a>
				<a href={resolve('/admin/catalog')}>
					<i>02</i><span><strong>Catalogue</strong><small>Games, maps, rules</small></span>
				</a>
				<a href={resolve('/admin/engagement')}>
					<i>03</i><span><strong>Engagement</strong><small>Achievements</small></span>
				</a>
				<a href={resolve('/games')}>
					<i>↗</i><span><strong>Public site</strong><small>Open catalogue</small></span>
				</a>
			</nav>
			<footer>
				<span class:offline={data.apiUnavailable}></span>
				<div>
					<strong>{data.apiUnavailable ? 'API unavailable' : 'Systems online'}</strong>
					<small>{data.apiUnavailable ? 'Read-only fallback' : 'Live moderation data'}</small>
				</div>
			</footer>
		</aside>

		<section class="content">
			<header class="page-header">
				<div>
					<Eyebrow>Operations / moderation</Eyebrow>
					<h1>Review desk</h1>
					<p>Records and player identities that need a human decision.</p>
				</div>
				{#if data.overview?.oldestPendingSubmission}
					<a
						class="priority"
						href={resolve('/admin/submissions/[id]', {
							id: String(data.overview.oldestPendingSubmission.id)
						})}
					>
						<span><small>Oldest pending</small><strong>Needs review</strong></span>
						<Badge>{age(data.overview.oldestPendingSubmission.submittedAt)}</Badge>
						<b>Open →</b>
					</a>
				{/if}
			</header>

			{#if data.apiUnavailable}
				<FormAlert message="The moderation queue is temporarily unavailable." />
			{/if}
			{#if form?.message}<FormAlert message={form.message} />{/if}

			<section class="metrics" aria-label="Moderation summary">
				{#each metrics as metric (metric.label)}
					<div>
						<i>{metric.index}</i>
						<span
							><small>{metric.label}</small><strong>{metric.value.toLocaleString('en-US')}</strong
							></span
						>
					</div>
				{/each}
			</section>

			<div class="workspace">
				<ModerationQueue queue={data.queue} overview={data.overview} status={data.status} />
				<ProfileClaimsQueue claims={data.claims} />
			</div>

			{#if data.canManageBadges}
				<BadgeAdministration badges={data.badges} />
			{/if}
		</section>
	</div>
</main>

<style>
	main {
		width: min(100%, 112rem);
		margin: 0 auto;
		padding: clamp(0.75rem, 2vw, 1.5rem);
	}
	.admin-shell {
		display: grid;
		grid-template-columns: 13.5rem minmax(0, 1fr);
		align-items: start;
		gap: 1rem;
	}
	.rail {
		position: sticky;
		top: 1rem;
		display: grid;
		min-height: calc(100vh - 2rem);
		grid-template-rows: auto 1fr auto;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.rail > header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border-bottom: 1px solid var(--line);
	}
	.rail > header > span {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		place-items: center;
		background: var(--signal);
		color: #0b0d0c;
		font-family: var(--font-display);
		font-style: italic;
		font-weight: 900;
	}
	.rail header div,
	.rail footer div,
	.rail nav span {
		display: grid;
		gap: 0.12rem;
	}
	.rail small {
		color: var(--muted);
		font-size: 0.56rem;
	}
	.rail nav {
		display: grid;
		align-content: start;
		padding: 0.5rem;
	}
	.rail nav a {
		display: grid;
		grid-template-columns: 1.8rem 1fr;
		align-items: center;
		gap: 0.55rem;
		padding: 0.8rem 0.65rem;
		border: 1px solid transparent;
		color: var(--muted);
		text-decoration: none;
	}
	.rail nav a:hover {
		background: var(--panel-hover);
		color: var(--ink);
	}
	.rail nav a.active {
		border-color: color-mix(in srgb, var(--signal) 38%, var(--line));
		background: color-mix(in srgb, var(--signal) 7%, var(--canvas-soft));
		color: var(--ink);
	}
	.rail nav i {
		color: var(--signal);
		font: normal 0.58rem monospace;
	}
	.rail nav strong {
		font-size: 0.67rem;
		text-transform: uppercase;
	}
	.rail footer {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.85rem 1rem;
		border-top: 1px solid var(--line);
	}
	.rail footer > span {
		width: 0.48rem;
		height: 0.48rem;
		border-radius: 50%;
		background: #62c584;
		box-shadow: 0 0 0.65rem color-mix(in srgb, #62c584 55%, transparent);
	}
	.rail footer > span.offline {
		background: #e98179;
		box-shadow: none;
	}
	.rail footer strong {
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.content {
		display: grid;
		min-width: 0;
		gap: 1rem;
	}
	.page-header {
		display: flex;
		min-height: 7rem;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.2rem 1.4rem;
		border: 1px solid var(--line);
		background:
			linear-gradient(110deg, color-mix(in srgb, var(--signal) 6%, transparent), transparent 45%),
			var(--panel);
	}
	h1 {
		margin: 0.32rem 0 0;
		font: italic clamp(2.2rem, 4vw, 3.6rem)/0.9 var(--font-display);
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}
	.page-header p {
		margin: 0.5rem 0 0;
		color: var(--muted);
		font-size: 0.72rem;
	}
	.priority {
		display: grid;
		grid-template-columns: auto auto auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--signal) 35%, var(--line));
		background: var(--canvas-soft);
		color: inherit;
		text-decoration: none;
	}
	.priority > span {
		display: grid;
		gap: 0.15rem;
	}
	.priority small {
		color: var(--muted);
		font-size: 0.55rem;
		text-transform: uppercase;
	}
	.priority b {
		color: var(--signal);
		font-size: 0.6rem;
		text-transform: uppercase;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.metrics > div {
		display: grid;
		min-width: 0;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.8rem;
		padding: 0.85rem 1rem;
		border-right: 1px solid var(--line);
	}
	.metrics > div:last-child {
		border-right: 0;
	}
	.metrics i {
		color: color-mix(in srgb, var(--muted) 50%, transparent);
		font: normal 0.58rem monospace;
	}
	.metrics span {
		display: grid;
		gap: 0.2rem;
	}
	.metrics small {
		color: var(--muted);
		font-size: 0.54rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.metrics strong {
		font: italic 1.55rem/1 var(--font-display);
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(19rem, 23rem);
		align-items: start;
		gap: 1rem;
	}
	@media (max-width: 1100px) {
		.admin-shell {
			grid-template-columns: 1fr;
		}
		.rail {
			position: static;
			min-height: 0;
			grid-template-columns: auto 1fr auto;
			grid-template-rows: auto;
		}
		.rail nav {
			display: flex;
			overflow-x: auto;
		}
		.rail nav a {
			min-width: 9rem;
		}
		.rail footer {
			border-top: 0;
			border-left: 1px solid var(--line);
		}
	}
	@media (max-width: 850px) {
		.workspace {
			grid-template-columns: 1fr;
		}
		.metrics {
			grid-template-columns: 1fr 1fr;
		}
		.metrics > div:nth-child(2) {
			border-right: 0;
		}
		.metrics > div:nth-child(-n + 2) {
			border-bottom: 1px solid var(--line);
		}
	}
	@media (max-width: 650px) {
		main {
			padding: 0.6rem;
		}
		.rail {
			grid-template-columns: 1fr;
		}
		.rail > header,
		.rail footer {
			display: none;
		}
		.rail nav {
			padding: 0.35rem;
		}
		.page-header {
			align-items: flex-start;
			flex-direction: column;
		}
		.priority {
			width: 100%;
		}
	}
</style>
