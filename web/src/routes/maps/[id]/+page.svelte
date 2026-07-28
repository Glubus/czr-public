<script lang="ts">
	import { resolve } from '$app/paths';
	import MapCategoryGrid from '$lib/components/organisms/MapCategoryGrid.svelte';
	import FollowButton from '$lib/components/molecules/FollowButton.svelte';
	import PageHero from '$lib/components/organisms/PageHero.svelte';
	import PointsCalculator from '$lib/components/organisms/PointsCalculator.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.map?.name ?? 'Map'} - Zombies Records</title>
	<meta
		name="description"
		content={data.map?.description ??
			`Browse verified categories and leaderboards for ${data.map?.name ?? 'this Zombies map'}.`}
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content={`${data.map?.name ?? 'Map'} - Zombies Records`} />
	<meta
		property="og:description"
		content={data.map?.description ?? 'Verified categories, records and leaderboards.'}
	/>
	{#if data.map?.thumbnailUrl}<meta property="og:image" content={data.map.thumbnailUrl} />{/if}
</svelte:head>
<div class="page">
	<a class="back" href={resolve('/games')}>← All games</a>
	{#if data.map}
		<PageHero
			eyebrow={`Map / ${data.map.type}`}
			title={data.map.name}
			badges={[
				data.map.status,
				data.map.type === 'uem' ? 'UEM' : data.map.type === 'custom' ? 'Community' : 'Official'
			]}
		/>
		<FollowButton
			targetType="map"
			targetId={String(data.map.id)}
			following={data.isFollowing}
			authenticated={data.authenticated}
		/>
		<MapCategoryGrid mapId={data.map.id} categories={data.categories} />
		<section class="intel">
			<span>INTEL / DESCRIPTION</span>
			<p>{data.map.description ?? 'No description available.'}</p>
			<dl>
				<div>
					<dt>AUTHORS</dt>
					<dd>{data.map.authors.join(', ') || 'Unknown'}</dd>
				</div>
				<div>
					<dt>SOURCES</dt>
					<dd>{data.map.sources.length}</dd>
				</div>
			</dl>
		</section>
		<PointsCalculator mapId={data.map.id} categories={data.categories} />
	{:else}<div class="missing">MAP NOT FOUND</div>{/if}
</div>

<style>
	.page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.back {
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		text-decoration: none;
		text-transform: uppercase;
	}
	.intel {
		margin-top: 1rem;
		padding: 2rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.intel > span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.65rem;
		letter-spacing: 0.12em;
	}
	.intel p {
		max-width: 45rem;
		color: #adb3ad;
		line-height: 1.7;
	}
	dl {
		display: flex;
		gap: 3rem;
		margin-top: 2rem;
	}
	dt {
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 800;
	}
	dd {
		margin: 0.4rem 0 0;
		font-size: 0.78rem;
	}
	.missing {
		display: grid;
		min-height: 25rem;
		place-items: center;
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2rem;
	}
</style>
