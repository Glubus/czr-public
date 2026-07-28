<script lang="ts">
	import CollapsiblePanel from '$lib/components/molecules/CollapsiblePanel.svelte';
	import CollapsibleSubsection from '$lib/components/molecules/CollapsibleSubsection.svelte';
	import MapCardGrid from '$lib/components/molecules/MapCardGrid.svelte';
	import type { MapResult } from '$lib/types';

	let {
		maps,
		modes = []
	}: { maps: MapResult[]; modes?: Array<{ map: MapResult; label: string }> } = $props();
	let official = $derived(maps.filter((map) => map.type === 'official'));
	let community = $derived(maps.filter((map) => map.type === 'custom'));
	let uem = $derived(maps.filter((map) => map.type === 'uem'));
	let modeGroups = $derived(
		[...new Set(modes.map((mode) => mode.label))].map((label) => ({
			label,
			maps: modes.filter((mode) => mode.label === label).map((mode) => mode.map)
		}))
	);
</script>

<div class="groups">
	{#each [{ id: 'official-maps', title: 'OFFICIAL MAPS', eyebrow: 'Base game content', maps: official, code: 'OF' }, { id: 'community-maps', title: 'COMMUNITY MAPS', eyebrow: 'Custom creations', maps: community, code: 'CM' }, { id: 'uem-maps', title: 'UEM MAPS', eyebrow: 'Community · Ultimate Experience Mod', maps: uem, code: 'UE' }] as group (group.id)}
		{#if group.maps.length}
			<CollapsiblePanel
				id={group.id}
				title={group.title}
				eyebrow={group.eyebrow}
				count={group.maps.length}
			>
				<MapCardGrid maps={group.maps} code={group.code} />
			</CollapsiblePanel>
		{/if}
	{/each}

	{#if modeGroups.length}
		<CollapsiblePanel
			id="game-modes"
			title="GAME MODES"
			eyebrow="Boards outside standard maps"
			count={modes.length}
		>
			{#each modeGroups as mode (mode.label)}
				<CollapsibleSubsection
					id={`game-mode-${mode.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}
					title={mode.label}
					count={mode.maps.length}
				>
					<MapCardGrid maps={mode.maps} code="MD" />
				</CollapsibleSubsection>
			{/each}
		</CollapsiblePanel>
	{/if}
</div>

<style>
	.groups {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}
</style>
