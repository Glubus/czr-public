<script lang="ts">
	import { resolve } from '$app/paths';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import MetricStrip from '$lib/components/organisms/MetricStrip.svelte';
	import { formatRecordScore } from '$lib/display';
	import type { ActivityFeedPage, NotificationPage, ParticipationInvitation } from './contracts';
	import type { SubmissionCollection } from '$lib/types';

	let {
		submissions,
		invitations,
		notifications,
		feed,
		statuses
	}: {
		submissions: SubmissionCollection['entries'];
		invitations: ParticipationInvitation[];
		notifications: NotificationPage['entries'];
		feed: ActivityFeedPage['entries'];
		statuses: Record<string, number>;
	} = $props();

	const date = (value: string) =>
		new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(value));
	const notificationLabel = (type: string) =>
		type
			.split(/[._]/)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
</script>

<MetricStrip
	items={[
		{
			label: 'Active queue',
			value: (statuses.pending ?? 0) + (statuses.awaiting_participants ?? 0)
		},
		{ label: 'Verified', value: statuses.verified ?? 0 },
		{ label: 'Invitations', value: invitations.length },
		{ label: 'Unread', value: notifications.filter((entry) => !entry.readAt).length }
	]}
/>

{#if invitations.length}
	<section class="panel urgent">
		<header>
			<div>
				<span>Action required</span>
				<h2>Teammate invitations</h2>
			</div>
			<b>{invitations.length}</b>
		</header>
		<div class="invitation-list">
			{#each invitations as entry (entry.invitation.id)}
				<article>
					<PlayerAvatar
						name={entry.submitter?.name ?? 'Player'}
						image={entry.submitter?.image ?? null}
						size="medium"
					/>
					<div>
						<strong>{entry.submitter?.name ?? 'A player'} invited you</strong>
						<small>
							{entry.group.submissions.length}
							{entry.group.submissions.length === 1 ? 'record' : 'records'} · expires {date(
								entry.invitation.expiresAt
							)}
						</small>
					</div>
					<form method="POST" action="?/invitation">
						<input type="hidden" name="id" value={entry.invitation.id} />
						<button name="status" value="rejected">Decline</button>
						<button name="status" value="accepted" class="accept">Accept</button>
					</form>
				</article>
			{/each}
		</div>
	</section>
{/if}

<div class="grid">
	<section class="panel">
		<header>
			<div>
				<span>Your activity</span>
				<h2>Recent submissions</h2>
			</div>
			<a href={resolve('/submit')}>New submission →</a>
		</header>
		{#if submissions.length}
			<div class="submission-list">
				{#each submissions.slice(0, 8) as entry (entry.submission.id)}
					<article>
						<span class={`status ${entry.submission.status}`}
							>{entry.submission.status.replace('_', ' ')}</span
						>
						<div>
							<strong>{entry.map.name}</strong>
							<small>
								{entry.game.name} · {entry.category.name} · {entry.submission.playerCount}P
							</small>
						</div>
						<div class="value">
							<strong>
								{formatRecordScore(
									entry.submission.scoreValue,
									entry.category.scoreType,
									entry.submission.runDurationMs
								)}
							</strong>
							<small>
								{entry.submission.status === 'verified' && entry.points !== null
									? `+${entry.points.toFixed(2)} PP · `
									: ''}{date(entry.submission.submittedAt)}
							</small>
						</div>
						{#if entry.submission.status === 'verified'}
							<a href={resolve('/submissions/[id]', { id: String(entry.submission.id) })}>View →</a>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<p class="empty">No submissions yet. Your first verified run starts here.</p>
		{/if}
	</section>

	<section class="panel">
		<header>
			<div>
				<span>Inbox</span>
				<h2>Notifications</h2>
			</div>
			{#if notifications.some((entry) => !entry.readAt)}
				<form method="POST" action="?/readAll"><button>Mark all read</button></form>
			{/if}
		</header>
		{#if notifications.length}
			<div class="notification-list">
				{#each notifications.slice(0, 8) as entry (entry.id)}
					<article class:unread={!entry.readAt}>
						<i></i>
						<div>
							<strong>{notificationLabel(entry.type)}</strong><small>{date(entry.createdAt)}</small>
						</div>
						{#if !entry.readAt}
							<form method="POST" action="?/readNotification">
								<input type="hidden" name="id" value={entry.id} />
								<button aria-label={`Mark ${notificationLabel(entry.type)} as read`}>✓</button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<p class="empty">You are all caught up.</p>
		{/if}
	</section>
</div>

<section class="panel feed">
	<header>
		<div>
			<span>Following feed</span>
			<h2>Latest activity</h2>
		</div>
		<a href={resolve('/leaderboard?scope=following' as '/')}>Following leaderboard →</a>
	</header>
	{#if feed.length}
		<div class="feed-list">
			{#each feed.slice(0, 10) as entry (entry.id)}
				<article>
					<i></i>
					<div>
						<strong>{notificationLabel(entry.type)}</strong><small>{date(entry.createdAt)}</small>
					</div>
					{#if typeof entry.payload.submissionId === 'number'}
						<a href={resolve('/submissions/[id]', { id: String(entry.payload.submissionId) })}
							>View record →</a
						>
					{/if}
				</article>
			{/each}
		</div>
	{:else}
		<p class="empty">Follow players, games, maps, or categories to build your activity feed.</p>
	{/if}
</section>

<style>
	.panel {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.panel > header {
		display: flex;
		min-height: 4.7rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--line);
	}
	.panel h2 {
		margin: 0.25rem 0 0;
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-style: italic;
		text-transform: uppercase;
	}
	.panel header span {
		color: var(--signal);
		font-size: 0.55rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.panel header a,
	.panel header button {
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}
	.urgent {
		margin-bottom: 1rem;
		border-color: color-mix(in srgb, var(--signal) 55%, var(--line));
	}
	.urgent > header b {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		background: var(--signal);
		font-size: 0.7rem;
	}
	.invitation-list article {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	.invitation-list article > div,
	.submission-list article > div,
	.notification-list div,
	.feed-list article > div {
		display: grid;
		gap: 0.22rem;
	}
	.invitation-list form {
		display: flex;
		gap: 0.4rem;
	}
	.invitation-list button {
		min-height: 2.3rem;
		padding: 0 0.8rem;
		border: 1px solid var(--line-strong);
		background: transparent;
		color: var(--ink);
		font-size: 0.58rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.invitation-list .accept {
		border-color: var(--signal);
		background: var(--signal);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1.7fr) minmax(18rem, 0.8fr);
		gap: 1rem;
	}
	.submission-list article {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.8rem;
		min-height: 4.4rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	.status {
		width: max-content;
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--line-strong);
		color: var(--muted);
		font-size: 0.52rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.status.pending,
	.status.awaiting_participants {
		border-color: #b88237;
		color: #e5ad5b;
	}
	.status.verified {
		border-color: #3b8954;
		color: #69ce88;
	}
	.status.rejected {
		border-color: #934636;
		color: #ed765c;
	}
	.value {
		justify-items: end;
	}
	.submission-list a,
	.feed-list a {
		color: var(--signal);
		font-size: 0.56rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	small {
		color: var(--muted);
		font-size: 0.55rem;
	}
	.notification-list article {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--line);
		opacity: 0.6;
	}
	.notification-list article.unread {
		opacity: 1;
	}
	.notification-list i,
	.feed-list i {
		width: 0.42rem;
		height: 0.42rem;
		border-radius: 50%;
		background: var(--signal);
	}
	.notification-list form {
		margin-left: auto;
	}
	.feed {
		margin-top: 1rem;
	}
	.feed-list {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.feed-list article {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.9rem 1rem;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.empty {
		margin: 0;
		padding: 2rem 1.2rem;
		color: var(--muted);
		font-size: 0.68rem;
		line-height: 1.6;
	}
	@media (max-width: 900px) {
		.grid,
		.feed-list {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 650px) {
		.submission-list article {
			grid-template-columns: 1fr auto;
		}
		.status {
			grid-column: 1 / -1;
		}
		.invitation-list article {
			grid-template-columns: auto 1fr;
		}
		.invitation-list form {
			grid-column: 2;
		}
	}
</style>
