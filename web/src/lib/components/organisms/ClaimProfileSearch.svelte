<script lang="ts">
	import PlayerSearchSelect from '$lib/components/PlayerSearchSelect.svelte';
</script>

<PlayerSearchSelect
	label="Player profile"
	name="profileUserId"
	endpoint="/claimable-profiles"
	hint="Select your imported leaderboard profile from the results."
	resultSuffix="Imported profile"
	selectedSuffix="Ready to claim"
/>
