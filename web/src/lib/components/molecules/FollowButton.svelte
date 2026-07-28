<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	let {
		targetType,
		targetId,
		following,
		authenticated
	}: { targetType: string; targetId: string; following: boolean; authenticated: boolean } =
		$props();
	let pendingState = $state<boolean | null>(null);
	let shownFollowing = $derived(pendingState ?? following);
	let targetLabel = $derived(
		targetType === 'map'
			? 'map'
			: targetType === 'category_assignment' || targetType === 'map_category'
				? 'this category'
				: targetType
	);
	const enhanceFollow: SubmitFunction = () => {
		if (authenticated) pendingState = !shownFollowing;
		return async ({ result, update }) => {
			await update({ reset: false, invalidateAll: result.type === 'success' });
			pendingState = null;
		};
	};
</script>

<form method="POST" action="?/follow" use:enhance={enhanceFollow}>
	<input type="hidden" name="targetType" value={targetType} />
	<input type="hidden" name="targetId" value={targetId} />
	<input type="hidden" name="following" value={String(shownFollowing)} />
	<button
		class:following={shownFollowing}
		aria-label={`${shownFollowing ? 'Unfollow' : 'Follow'} ${targetLabel}`}
		>{authenticated
			? shownFollowing
				? `Following ${targetLabel} ✓`
				: `+ Follow ${targetLabel}`
			: `Sign in to follow ${targetLabel}`}</button
	>
</form>

<style>
	form {
		display: flex;
		justify-content: flex-end;
		margin: -3.7rem 0 1rem;
		position: relative;
		z-index: 2;
	}
	button {
		min-height: 2.7rem;
		padding: 0 0.9rem;
		border: 1px solid var(--line-strong);
		background: var(--panel);
		color: var(--ink);
		font-size: 0.56rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	button.following {
		border-color: color-mix(in srgb, var(--signal) 60%, var(--line));
		color: var(--signal);
	}
	@media (max-width: 650px) {
		form {
			margin: 0 0 1rem;
			justify-content: flex-start;
		}
	}
</style>
