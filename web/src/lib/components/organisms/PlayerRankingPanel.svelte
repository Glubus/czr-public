<script lang="ts">
	import LeaderboardList from '$lib/components/LeaderboardList.svelte';
	import LeaderboardPanel from '$lib/components/organisms/LeaderboardPanel.svelte';
	import type { LeaderboardEntry } from '$lib/types';
	let { entries, page }: { entries: LeaderboardEntry[]; page: number } = $props();
</script>

<LeaderboardPanel
	eyebrow="Performance points"
	title="PLAYERS"
	status={`Page ${String(page + 1).padStart(2, '0')}`}
	statusTone="muted"
>
	<LeaderboardList {entries} />
</LeaderboardPanel>
