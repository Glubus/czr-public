<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import ProofViewer from '$lib/components/organisms/ProofViewer.svelte';
	import { categoryVariantLabel } from '$lib/display';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let decision = $state<'verified' | 'rejected'>('verified');
	let proofUrl = $derived(
		data.detail.proofs.find((proof) => proof.sourceUrl)?.sourceUrl ??
			data.detail.submission.proofUrl ??
			null
	);
	let current = $derived(data.leaderboard?.entries[0] ?? null);
	let ruleset = $derived(
		categoryVariantLabel(
			(data.detail.submission.rulesSnapshot.specific ?? {}) as Record<string, unknown>
		) ?? 'Default ruleset'
	);
	const date = (value: string) =>
		new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
</script>

<svelte:head
	><title>Review submission #{data.detail.submission.id} - Zombies Records</title></svelte:head
>
<div class="review-page">
	<nav class="breadcrumb">
		<a href={resolve('/admin')}>Moderation</a><span>/</span><strong
			>Submission #{data.detail.submission.id}</strong
		>
	</nav>
	<header class="review-hero">
		<div>
			<span>Evidence review</span>
			<h1>{data.detail.map.name}</h1>
			<p>{data.detail.category.name} · {ruleset} · {data.detail.submission.playerCount}P</p>
		</div>
		<span class={`status ${data.detail.submission.status}`}
			>{data.detail.submission.status.replace('_', ' ')}</span
		>
	</header>
	{#if form?.message}<FormAlert message={form.message} />{/if}
	<div class="review-grid">
		<div class="evidence-column">
			<ProofViewer url={proofUrl} level={data.detail.submission.proofLevel} />
			<section class="rules">
				<header><span>Rules snapshot</span><strong>At submission time</strong></header>
				<div>
					<article>
						<h3>Global rules</h3>
						<pre>{JSON.stringify(data.detail.submission.rulesSnapshot.global ?? {}, null, 2)}</pre>
					</article>
					<article>
						<h3>Specific rules</h3>
						<pre>{JSON.stringify(
								data.detail.submission.rulesSnapshot.specific ?? {},
								null,
								2
							)}</pre>
					</article>
				</div>
			</section>
		</div>
		<aside>
			<section class="summary">
				<header><span>Submission</span><strong>#{data.detail.submission.id}</strong></header>
				<dl>
					<div>
						<dt>Score</dt>
						<dd>{data.detail.submission.scoreValue.toLocaleString('en-US')}</dd>
					</div>
					<div>
						<dt>Submitted</dt>
						<dd>{date(data.detail.submission.submittedAt)}</dd>
					</div>
					<div>
						<dt>Platform</dt>
						<dd>{data.detail.submission.platform ?? 'Not specified'}</dd>
					</div>
					<div>
						<dt>Game version</dt>
						<dd>{data.detail.submission.gameVersion ?? 'Not specified'}</dd>
					</div>
					<div>
						<dt>Map version</dt>
						<dd>{data.detail.submission.mapVersion ?? 'Not specified'}</dd>
					</div>
				</dl>
			</section>
			<section class="team">
				<header><span>Participants</span><strong>{data.detail.participants.length}</strong></header>
				{#each data.detail.participants as participant (participant.user.id)}<article>
						<PlayerAvatar
							name={participant.user.name}
							image={participant.user.image}
							size="small"
						/>
						<div>
							<a href={resolve('/players/[id]', { id: participant.user.id })}
								>{participant.user.name}</a
							><small>{participant.role} · {participant.acceptanceSource}</small>
						</div>
						<span class:accepted={participant.status === 'accepted'}>{participant.status}</span>
					</article>{/each}
			</section>
			<section class="comparison">
				<header>
					<span>Current board</span><strong>{data.leaderboard?.totalEntries ?? 0} records</strong>
				</header>
				{#if current}<article>
						<div>
							<small>Current #1</small><strong>{current.scoreValue.toLocaleString('en-US')}</strong>
						</div>
						<div>
							<small>Candidate</small><strong
								>{data.detail.submission.scoreValue.toLocaleString('en-US')}</strong
							>
						</div>
						<span
							>{data.detail.category.rankingDirection === 'higher_is_better'
								? data.detail.submission.scoreValue - current.scoreValue
								: current.scoreValue - data.detail.submission.scoreValue} difference</span
						>
					</article>
					<a
						href={resolve(
							`/maps/${data.detail.map.id}/categories/${data.detail.category.id}?assignment_id=${data.detail.submission.categoryAssignmentId}&player_count=${data.detail.submission.playerCount}` as '/'
						)}>Open full leaderboard →</a
					>{:else}<p>No verified record exists on this exact board.</p>{/if}
			</section>
			{#if data.detail.submission.status === 'pending'}<section class="decision">
					<header><span>Decision</span><strong>Moderator action</strong></header>
					<div class="decision-tabs">
						<button
							type="button"
							class:active={decision === 'verified'}
							onclick={() => (decision = 'verified')}>Approve</button
						><button
							type="button"
							class:active={decision === 'rejected'}
							onclick={() => (decision = 'rejected')}>Reject</button
						>
					</div>
					<form method="POST">
						<input type="hidden" name="status" value={decision} /><label
							>Review note {decision === 'rejected' ? '(required)' : '(optional)'}<textarea
								name="reviewNote"
								required={decision === 'rejected'}
								placeholder={decision === 'rejected'
									? 'Explain what must be corrected…'
									: 'Internal or player-facing context…'}></textarea></label
						><button class:reject={decision === 'rejected'}
							>{decision === 'verified' ? 'Approve record' : 'Reject submission'} →</button
						>
					</form>
				</section>{/if}
		</aside>
	</div>
</div>

<style>
	.review-page {
		padding: clamp(1rem, 3vw, 3rem);
	}
	.breadcrumb {
		display: flex;
		gap: 0.6rem;
		color: var(--muted);
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	.breadcrumb a {
		color: var(--muted);
		text-decoration: none;
	}
	.breadcrumb strong {
		color: var(--ink);
	}
	.review-hero {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin: 1.5rem 0;
	}
	.review-hero > div > span,
	section > header span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.56rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.45rem 0 0.3rem;
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 6vw, 5.5rem);
		font-style: italic;
		line-height: 0.9;
		text-transform: uppercase;
	}
	.review-hero p {
		margin: 0;
		color: var(--muted);
		font-size: 0.72rem;
	}
	.status {
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--line-strong);
		color: var(--muted);
		font-size: 0.56rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.status.pending {
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
	.review-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.65fr) minmax(20rem, 0.65fr);
		gap: 1rem;
	}
	.evidence-column,
	aside {
		display: grid;
		align-content: start;
		gap: 1rem;
	}
	section {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	section > header {
		display: flex;
		min-height: 4rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	section > header strong {
		color: var(--muted);
		font-size: 0.55rem;
		text-transform: uppercase;
	}
	.rules > div {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.rules article {
		min-width: 0;
		padding: 1rem;
		border-right: 1px solid var(--line);
	}
	.rules article:last-child {
		border: 0;
	}
	.rules h3 {
		margin: 0 0 0.7rem;
		font-size: 0.62rem;
		text-transform: uppercase;
	}
	.rules pre {
		margin: 0;
		overflow: auto;
		color: var(--muted);
		font-size: 0.58rem;
		line-height: 1.6;
	}
	dl {
		margin: 0;
	}
	dl > div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	dl > div:last-child {
		border: 0;
	}
	dt {
		color: var(--muted);
		font-size: 0.56rem;
		text-transform: uppercase;
	}
	dd {
		margin: 0;
		font-size: 0.63rem;
		font-weight: 800;
		text-align: right;
	}
	.team article {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	.team article > div {
		display: grid;
		gap: 0.2rem;
	}
	.team a {
		color: var(--ink);
		font-size: 0.65rem;
		font-weight: 800;
		text-decoration: none;
	}
	.team small {
		color: var(--muted);
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.team article > span {
		color: var(--muted);
		font-size: 0.52rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.team article > span.accepted {
		color: #69ce88;
	}
	.comparison article {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.comparison article > div {
		display: grid;
		gap: 0.3rem;
		padding: 1rem;
		border-right: 1px solid var(--line);
	}
	.comparison article small {
		color: var(--muted);
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.comparison article strong {
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-style: italic;
	}
	.comparison article > span {
		grid-column: 1 / -1;
		padding: 0.55rem 1rem;
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-family: monospace;
		font-size: 0.55rem;
	}
	.comparison > a {
		display: block;
		padding: 0.8rem 1rem;
		border-top: 1px solid var(--line);
		color: var(--signal);
		font-size: 0.56rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.comparison > p {
		margin: 0;
		padding: 1.2rem;
		color: var(--muted);
		font-size: 0.62rem;
	}
	.decision-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.decision-tabs button {
		min-height: 2.8rem;
		border: 0;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		background: transparent;
		color: var(--muted);
		font-size: 0.57rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	.decision-tabs button.active {
		background: var(--signal);
		color: white;
	}
	.decision form {
		display: grid;
		gap: 1rem;
		padding: 1rem;
	}
	.decision label {
		display: grid;
		gap: 0.5rem;
		color: var(--muted);
		font-size: 0.54rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.decision textarea {
		min-height: 7rem;
		padding: 0.8rem;
		border: 1px solid var(--line-strong);
		border-radius: 0;
		background: var(--canvas-soft);
		color: var(--ink);
		resize: vertical;
	}
	.decision form button {
		min-height: 3rem;
		border: 0;
		background: #3b8954;
		color: white;
		font-size: 0.62rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	.decision form button.reject {
		background: var(--signal);
	}
	@media (max-width: 950px) {
		.review-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		.review-page {
			padding-bottom: 6rem;
		}
		.review-hero {
			align-items: flex-start;
			flex-direction: column;
		}
		.rules > div {
			grid-template-columns: 1fr;
		}
		.rules article {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
	}
</style>
