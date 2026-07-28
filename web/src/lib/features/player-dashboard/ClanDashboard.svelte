<script lang="ts">
	import { resolve } from '$app/paths';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import { searchCatalogPlayers } from '$lib/features/record-submission/catalog-client';
	import type { Player } from '$lib/types';
	import type { PageData } from '../../../routes/me/$types';

	let {
		clan,
		ownClanRole,
		clanPreferences,
		clanInvitations,
		managedClanInvitations,
		user
	}: Pick<
		PageData,
		| 'clan'
		| 'ownClanRole'
		| 'clanPreferences'
		| 'clanInvitations'
		| 'managedClanInvitations'
		| 'user'
	> = $props();
	let query = $state('');
	let results = $state<Player[]>([]);
	let invitee = $state<Player | null>(null);
	let loading = $state(false);
	const canManage = $derived(Boolean(clan && ['owner', 'admin'].includes(ownClanRole ?? '')));

	$effect(() => {
		const value = query.trim();
		if (!canManage || value.length < 2) {
			results = [];
			return;
		}
		loading = true;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await searchCatalogPlayers(fetch, value, controller.signal);
				results = response.entries.filter(
					(player) => !clan?.members.some((member) => member.user.id === player.id)
				);
			} catch (error) {
				if ((error as Error).name !== 'AbortError') results = [];
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}, 220);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function date(value: string) {
		return new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(value));
	}
</script>

<div class="layout">
	{#if clan}
		<section class="panel">
			<header>
				<div>
					<span>Your clan</span>
					<h2>{clan.name}</h2>
				</div>
				<a href={resolve('/clans/[slug]', { slug: clan.slug })}>Public page →</a>
			</header>
			{#if canManage}
				<div class="uploads">
					<form method="POST" action="?/uploadMedia" enctype="multipart/form-data">
						<input type="hidden" name="kind" value="clan-logo" /><label
							>Clan logo <small>Image or GIF · 4 MB</small><input
								name="file"
								type="file"
								accept="image/jpeg,image/png,image/webp,image/gif"
								required
							/></label
						><button>Upload logo</button>
					</form>
					<form method="POST" action="?/uploadMedia" enctype="multipart/form-data">
						<input type="hidden" name="kind" value="clan-background" /><label
							>Clan background <small>Image or GIF · 10 MB</small><input
								name="file"
								type="file"
								accept="image/jpeg,image/png,image/webp,image/gif"
								required
							/></label
						><button>Upload background</button>
					</form>
				</div>
			{/if}
			<div class="members">
				{#each clan.members as member (member.id)}
					<article>
						<a href={resolve('/players/[id]', { id: member.user.id })}
							><PlayerAvatar name={member.user.name} image={member.user.image} size="small" /><span
								><strong>{member.user.name}</strong><small>{member.role}</small></span
							></a
						>
						{#if ownClanRole === 'owner' && member.role !== 'owner'}<form
								method="POST"
								action="?/clanMemberRole"
							>
								<input type="hidden" name="clanId" value={clan.id} /><input
									type="hidden"
									name="userId"
									value={member.user.id}
								/><button name="role" value={member.role === 'admin' ? 'member' : 'admin'}
									>{member.role === 'admin' ? 'Demote' : 'Promote'}</button
								>
							</form>{/if}
						{#if member.role !== 'owner' && (member.user.id === user?.id || ownClanRole === 'owner' || (ownClanRole === 'admin' && member.role === 'member'))}<form
								method="POST"
								action="?/removeClanMember"
							>
								<input type="hidden" name="clanId" value={clan.id} /><input
									type="hidden"
									name="userId"
									value={member.user.id}
								/><button>{member.user.id === user?.id ? 'Leave' : 'Remove'}</button>
							</form>{/if}
					</article>
				{/each}
			</div>
			<form class="preference" method="POST" action="?/clanPreferences">
				<label
					><input
						type="checkbox"
						name="autoAcceptClanRuns"
						checked={clanPreferences.autoAcceptClanRuns}
					/> Automatically accept records submitted for this clan</label
				><button>Save preference</button>
			</form>
		</section>
	{:else}
		<section class="panel">
			<header>
				<div>
					<span>Build a roster</span>
					<h2>Create a clan</h2>
				</div>
			</header>
			<p>
				Create a permanent community group, invite members, and compete on the clan leaderboard.
			</p>
			<form class="stack" method="POST" action="?/createClan">
				<label>Clan name<input name="name" minlength="2" maxlength="80" required /></label>
				<small>The public URL is generated securely from the clan name.</small>
				<button class="primary">Create clan →</button>
			</form>
		</section>
	{/if}

	<section class="panel">
		<header>
			<div>
				<span>Membership</span>
				<h2>Invitations</h2>
			</div>
			<b>{clanInvitations.length}</b>
		</header>
		{#if clanInvitations.length}<div class="invites">
				{#each clanInvitations as entry (entry.invitation.id)}<article>
						<div>
							<strong>{entry.clan.name}</strong><small
								>Invited by {entry.inviter?.name ?? 'Clan staff'} · expires {date(
									entry.invitation.expiresAt
								)}</small
							>
						</div>
						<form method="POST" action="?/clanInvitation">
							<input type="hidden" name="id" value={entry.invitation.id} /><button
								name="status"
								value="rejected">Decline</button
							><button class="primary" name="status" value="accepted">Join clan</button>
						</form>
					</article>{/each}
			</div>{:else}<p>No pending clan invitations.</p>{/if}
	</section>

	{#if clan && canManage}
		<section class="panel management">
			<header>
				<div>
					<span>Roster controls</span>
					<h2>Invite players</h2>
				</div>
			</header>
			<form class="stack" method="POST" action="?/inviteClanMember">
				<input type="hidden" name="clanId" value={clan.id} /><input
					type="hidden"
					name="userId"
					value={invitee?.id ?? ''}
				/>
				<label
					>Player<input
						type="search"
						bind:value={query}
						placeholder="Search by player name…"
						autocomplete="off"
					/></label
				>
				{#if invitee}<div class="selected">
						<PlayerAvatar name={invitee.name} image={invitee.image} size="small" /><strong
							>{invitee.name}</strong
						><button type="button" onclick={() => (invitee = null)}>Change</button>
					</div>
				{:else if query.trim().length >= 2}<div class="results">
						{#each results as player (player.id)}<button
								type="button"
								onclick={() => {
									invitee = player;
									query = player.name;
									results = [];
								}}
								><PlayerAvatar name={player.name} image={player.image} size="small" /><span
									>{player.name}</span
								><small>{Math.round(player.performancePoints).toLocaleString('en-US')} PP</small
								></button
							>{/each}{#if loading}<small>Searching…</small>{/if}
					</div>{/if}
				<button class="primary" disabled={!invitee}>Send invitation →</button>
			</form>
			<div class="invites">
				{#each managedClanInvitations.filter((entry) => entry.invitation.status === 'pending') as entry (entry.invitation.id)}
					<article>
						<PlayerAvatar name={entry.invitee.name} image={entry.invitee.image} size="small" />
						<div>
							<strong>{entry.invitee.name}</strong><small
								>Expires {date(entry.invitation.expiresAt)}</small
							>
						</div>
						<form method="POST" action="?/revokeClanInvitation">
							<input type="hidden" name="clanId" value={clan.id} /><input
								type="hidden"
								name="invitationId"
								value={entry.invitation.id}
							/><button>Revoke</button>
						</form>
					</article>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 0.8fr);
		gap: 1rem;
	}
	.panel {
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 1.25rem;
	}
	header,
	article,
	article a,
	.selected {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	header {
		margin-bottom: 1rem;
	}
	header span {
		color: var(--signal);
		font: 900 0.58rem monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0.2rem 0 0;
		font-family: var(--font-display);
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	small,
	p {
		color: var(--muted);
	}
	article a span,
	article > div {
		display: grid;
	}
	.members,
	.invites,
	.stack,
	.uploads {
		display: grid;
		gap: 0.75rem;
	}
	.members article,
	.invites article,
	.selected {
		border: 1px solid var(--line);
		padding: 0.75rem;
	}
	.uploads {
		grid-template-columns: 1fr 1fr;
		margin-bottom: 1rem;
	}
	.uploads form,
	.stack,
	label {
		display: grid;
		gap: 0.4rem;
	}
	input {
		border: 1px solid var(--line);
		background: var(--field);
		color: var(--text);
		padding: 0.7rem;
	}
	button {
		border: 1px solid var(--line);
		background: transparent;
		color: var(--text);
		padding: 0.55rem 0.7rem;
		cursor: pointer;
	}
	.primary {
		background: var(--signal);
		color: #101311;
		font-weight: 900;
	}
	.preference {
		margin-top: 1rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.preference label {
		display: flex;
		align-items: center;
		text-transform: none;
	}
	.results {
		border: 1px solid var(--line);
		display: grid;
	}
	.results button {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		text-align: left;
	}
	.management {
		grid-column: 1 / -1;
	}
	@media (max-width: 850px) {
		.layout,
		.uploads {
			grid-template-columns: 1fr;
		}
	}
</style>
