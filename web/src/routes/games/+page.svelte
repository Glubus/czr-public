<script lang="ts">
	import GameGrid from '$lib/components/organisms/GameGrid.svelte';
	import PageHero from '$lib/components/organisms/PageHero.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Games - Zombies Records</title></svelte:head>

<div class="page">
	<PageHero
		eyebrow="Records archive"
		title="GAMES"
		badges={[`${data.games.length} available`, 'Official & community maps']}
	/>
	<GameGrid games={data.games} />
</div>

<style>
	.page {
		padding: clamp(1rem, 4vw, 4rem);
	}
</style>
