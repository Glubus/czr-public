<script lang="ts">
	import { enhance } from '$app/forms';
	import ActionButton from '$lib/components/atoms/ActionButton.svelte';
	import Badge from '$lib/components/atoms/Badge.svelte';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData } from '../../../routes/admin/$types';

	let { claims }: Pick<PageData, 'claims'> = $props();
	let visibleClaims = $derived([...claims]);
	let pendingClaim = $state<{ id: number; decision: string } | null>(null);

	const date = (value: string) =>
		new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));

	const enhanceClaim: SubmitFunction = ({ formData }) => {
		const id = Number(formData.get('id'));
		const decision = String(formData.get('status') ?? '');
		pendingClaim = { id, decision };
		return async ({ result, update }) => {
			if (result.type === 'success') {
				visibleClaims = visibleClaims.filter((claim) => claim.id !== id);
			}
			await update({ reset: false, invalidateAll: false });
			pendingClaim = null;
		};
	};
</script>

<section aria-labelledby="profile-claims-title">
	<header>
		<div>
			<Eyebrow>Identity review</Eyebrow>
			<h2 id="profile-claims-title">Profile claims</h2>
		</div>
		<Badge>{visibleClaims.length} pending</Badge>
	</header>

	{#if visibleClaims.length}
		<div class="claims">
			{#each visibleClaims as claim (claim.id)}
				<article>
					<div class="claim-heading">
						<span class="claim-id">#{claim.id}</span>
						<div>
							<strong>{claim.profileExternalId.replace('zwr:player:', 'Player #')}</strong>
							<small>{date(claim.createdAt)} · account {claim.claimantUserId.slice(0, 8)}…</small>
						</div>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
							href={claim.proofUrl}
							target="_blank"
							rel="noreferrer">Proof ↗</a
						>
					</div>

					{#if claim.message}<blockquote>{claim.message}</blockquote>{/if}

					<form method="POST" action="?/claim" use:enhance={enhanceClaim}>
						<input type="hidden" name="id" value={claim.id} />
						<label>
							<span>Review note</span>
							<input
								name="reviewNote"
								maxlength="2000"
								placeholder="Required only when rejecting"
								disabled={pendingClaim?.id === claim.id}
							/>
						</label>
						<div class="actions">
							<ActionButton
								name="status"
								value="rejected"
								variant="danger"
								size="compact"
								full={false}
								arrow={false}
								disabled={pendingClaim?.id === claim.id}
								busy={pendingClaim?.id === claim.id && pendingClaim.decision === 'rejected'}
							>
								Reject
							</ActionButton>
							<ActionButton
								name="status"
								value="approved"
								size="compact"
								full={false}
								arrow={false}
								disabled={pendingClaim?.id === claim.id}
								busy={pendingClaim?.id === claim.id && pendingClaim.decision === 'approved'}
							>
								Approve
							</ActionButton>
						</div>
					</form>
				</article>
			{/each}
		</div>
	{:else}
		<div class="empty">
			<strong>Queue cleared</strong>
			<span>No player identity is waiting for review.</span>
		</div>
	{/if}
</section>

<style>
	section {
		min-width: 0;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 5rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.3rem 0 0;
		font: italic 1.35rem var(--font-display);
		text-transform: uppercase;
	}
	.claims {
		display: grid;
	}
	article {
		display: grid;
		gap: 0.8rem;
		padding: 1rem;
		border-bottom: 1px solid var(--line);
	}
	article:last-child {
		border-bottom: 0;
	}
	.claim-heading {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
	}
	.claim-heading > div {
		display: grid;
		min-width: 0;
		gap: 0.12rem;
	}
	.claim-id,
	small {
		color: var(--muted);
	}
	.claim-id {
		font: 700 0.65rem monospace;
	}
	small {
		overflow: hidden;
		font-size: 0.65rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a {
		color: var(--signal);
		font-size: 0.65rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	blockquote {
		margin: 0;
		padding: 0.65rem 0.75rem;
		border-left: 2px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--muted);
		font-size: 0.72rem;
		line-height: 1.45;
	}
	form {
		display: grid;
		gap: 0.65rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
	}
	label > span {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	input {
		width: 100%;
		min-width: 0;
		height: 2.55rem;
		padding: 0 0.7rem;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
		color: var(--ink);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.empty {
		display: grid;
		place-items: center;
		gap: 0.35rem;
		min-height: 9rem;
		padding: 1.5rem;
		color: var(--muted);
		text-align: center;
	}
	.empty strong {
		color: var(--ink);
		font-family: var(--font-display);
		text-transform: uppercase;
	}
	.empty span {
		font-size: 0.72rem;
	}
	@media (max-width: 520px) {
		.claim-heading {
			grid-template-columns: auto 1fr;
		}
		.claim-heading a {
			grid-column: 2;
		}
	}
</style>
