<script lang="ts">
	import { playerInitials } from '$lib/display';

	let {
		name,
		image = null,
		size = 'medium'
	}: {
		name: string;
		image?: string | null;
		size?: 'small' | 'medium' | 'large' | 'profile';
	} = $props();

	let initials = $derived(playerInitials(name));
</script>

<span class="avatar {size}" aria-hidden="true">
	{#if image}<img src={image} alt="" />{:else}{initials || '?'}{/if}
</span>

<style>
	.avatar {
		display: inline-grid;
		flex: 0 0 auto;
		place-items: center;
		overflow: hidden;
		border: 1px solid var(--line-strong);
		background: linear-gradient(145deg, var(--panel-strong), var(--panel));
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.04em;
	}
	.small {
		width: 2rem;
		height: 2rem;
	}
	.medium {
		width: 2.65rem;
		height: 2.65rem;
	}
	.large {
		width: 3.4rem;
		height: 3.4rem;
	}
	.profile {
		width: clamp(5.5rem, 10vw, 8.5rem);
		height: clamp(5.5rem, 10vw, 8.5rem);
		font-size: clamp(1.4rem, 3vw, 2.6rem);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
