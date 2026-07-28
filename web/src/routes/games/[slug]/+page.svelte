<script lang="ts">
	import { resolve } from '$app/paths';
	import GameMapList from '$lib/components/organisms/GameMapList.svelte';
	import FollowButton from '$lib/components/molecules/FollowButton.svelte';
	import PageHero from '$lib/components/organisms/PageHero.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.game?.name ?? 'Game'} - Zombies Records</title></svelte:head>
<div class="page">
	<a href={resolve('/games')}>← All games</a>{#if data.game}<PageHero
			eyebrow={`Game archive / ${data.game.shortName}`}
			title={data.game.name}
			badges={[
				data.game.gameType === 'zombies' ? 'Zombies' : 'Non-Zombies',
				data.game.studio,
				String(data.game.releaseYear ?? 'Unknown year')
			]}
		/><FollowButton
			targetType="game"
			targetId={String(data.game.id)}
			following={data.isFollowing}
			authenticated={data.authenticated}
		/><GameMapList maps={data.maps} modes={data.modes} />{:else}<div class="missing">
			GAME NOT FOUND
		</div>{/if}
</div>

<style>
	.page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.page > a {
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 800;
		text-decoration: none;
		text-transform: uppercase;
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
