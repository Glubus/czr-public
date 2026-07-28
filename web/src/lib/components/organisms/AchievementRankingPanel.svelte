<script lang="ts">
	import LeaderboardList from '$lib/components/LeaderboardList.svelte';
	import LeaderboardPanel from '$lib/components/organisms/LeaderboardPanel.svelte';
	import type { AchievementLeaderboardEntry } from '$lib/types';

	let { entries, page }: { entries: AchievementLeaderboardEntry[]; page: number } = $props();
</script>

<LeaderboardPanel
	eyebrow="Achievement points"
	title="AP LEADERBOARD"
	status={`Page ${String(page + 1).padStart(2, '0')}`}
	statusTone="muted"
>
	<LeaderboardList {entries} mode="achievements" />
</LeaderboardPanel>
