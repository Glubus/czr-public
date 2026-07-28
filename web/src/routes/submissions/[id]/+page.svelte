<script lang="ts">
	import Breadcrumb from '$lib/components/molecules/Breadcrumb.svelte';
	import PageHero from '$lib/components/organisms/PageHero.svelte';
	import ProofViewer from '$lib/components/organisms/ProofViewer.svelte';
	import SubmissionSummary from '$lib/components/organisms/SubmissionSummary.svelte';
	import RecordDiscussion from '$lib/features/record-discussion/RecordDiscussion.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let proofUrl = $derived(
		data.detail?.proofs.find((proof) => proof.sourceUrl)?.sourceUrl ??
			data.detail?.submission.proofUrl ??
			null
	);
</script>

<svelte:head>
	<title>Submission #{data.detail?.submission.id ?? ''} - Zombies Records</title>
	<meta
		name="description"
		content={data.detail
			? `${data.detail.category.name} record on ${data.detail.map.name} by ${data.detail.participants.map((participant) => participant.user.name).join(', ')}.`
			: 'Verified Zombies record submission.'}
	/>
	<meta property="og:type" content="video.other" />
	<meta
		property="og:title"
		content={data.detail
			? `${data.detail.map.name} · ${data.detail.category.name} - Zombies Records`
			: 'Record submission - Zombies Records'}
	/>
	<meta
		property="og:description"
		content={data.detail
			? `${data.detail.participants.map((participant) => participant.user.name).join(', ')} · ${data.detail.submission.playerCount}P verified performance.`
			: 'Verified Zombies record submission.'}
	/>
</svelte:head>

<div class="page">
	{#if data.detail}
		<Breadcrumb
			items={[
				{ label: data.detail.map.name, href: `/maps/${data.detail.map.id}` },
				{
					label: data.detail.category.name,
					href: `/maps/${data.detail.map.id}/categories/${data.detail.category.id}?player_count=${data.detail.submission.playerCount}${data.detail.submission.categoryAssignmentId ? `&assignment_id=${data.detail.submission.categoryAssignmentId}` : ''}`
				},
				{ label: `Submission #${data.detail.submission.id}` }
			]}
		/>
		<PageHero
			compact
			eyebrow="Verified performance"
			title={data.detail.map.name}
			subtitle={data.detail.category.name}
		/>
		<div class="grid">
			<ProofViewer url={proofUrl} level={data.detail.submission.proofLevel} />
			<SubmissionSummary detail={data.detail} />
		</div>
		<RecordDiscussion
			comments={data.comments}
			viewer={data.viewer}
			submissionId={data.detail.submission.id}
			message={form?.message}
		/>
	{:else}
		<section class="missing">
			<strong>SUBMISSION NOT FOUND</strong>
			<p>This submission is unavailable or has not been verified.</p>
		</section>
	{/if}
</div>

<style>
	.page {
		padding: clamp(1rem, 3vw, 3rem);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1.65fr) minmax(20rem, 0.65fr);
		gap: 1rem;
		margin-top: 1rem;
	}
	.missing {
		display: grid;
		min-height: 28rem;
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
		font-size: 0.72rem;
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
