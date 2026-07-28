<script lang="ts">
	import Breadcrumb from '$lib/components/molecules/Breadcrumb.svelte';
	import CategoryVariantTabs from '$lib/components/molecules/CategoryVariantTabs.svelte';
	import FollowButton from '$lib/components/molecules/FollowButton.svelte';
	import PlayerCountTabs from '$lib/components/molecules/PlayerCountTabs.svelte';
	import CategoryLeaderboard from '$lib/components/organisms/CategoryLeaderboard.svelte';
	import PageHero from '$lib/components/organisms/PageHero.svelte';
	import PointsCalculator from '$lib/components/organisms/PointsCalculator.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let base = $derived(`/maps/${data.map?.id}/categories/${data.leaderboard?.category.id}`);
</script>

<svelte:head
	><title>{data.leaderboard?.category.name ?? 'Category'} - {data.map?.name ?? 'Map'}</title
	></svelte:head
>
<div class="page">
	<Breadcrumb
		items={[
			{ label: 'Games', href: '/games' },
			{ label: data.map?.name ?? 'Map', href: `/maps/${data.map?.id ?? ''}` },
			{ label: data.leaderboard?.category.name ?? 'Category' }
		]}
	/>
	<PageHero
		compact
		eyebrow={`${data.map?.name ?? 'Map'} / Leaderboard`}
		title={data.leaderboard?.category.name ?? 'Category'}
		badges={[data.leaderboard?.category.scoreType ?? 'score', data.map?.type ?? 'map']}
	/>
	{#if data.leaderboard}<FollowButton
			targetType="map_category"
			targetId={`${data.map?.id}:${data.leaderboard.category.assignmentId}`}
			following={data.isFollowing}
			authenticated={data.authenticated}
		/>{/if}
	<CategoryVariantTabs
		basePath={base}
		variants={data.variants}
		selected={data.leaderboard?.category.assignmentId ?? 0}
		playerCount={data.playerCount}
	/>
	<PlayerCountTabs
		basePath={base}
		selected={data.playerCount}
		assignmentId={data.leaderboard?.category.assignmentId}
	/>
	{#if data.map && data.leaderboard}<CategoryLeaderboard
			mapId={data.map.id}
			leaderboard={data.leaderboard}
			page={data.page}
			playerCount={data.playerCount}
			assignmentId={data.leaderboard.category.assignmentId}
		/>{/if}
	{#if data.map && data.leaderboard}<PointsCalculator
			mapId={data.map.id}
			categories={[data.leaderboard.category]}
			initialCategory={data.leaderboard.category.id}
			initialPlayerCount={data.playerCount}
		/>{/if}
</div>

<style>
	.page {
		padding: clamp(1rem, 3vw, 3rem);
	}
</style>
