<script lang="ts">
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';

	let {
		user,
		detail
	}: {
		user: { name: string; image: string | null };
		detail?: string;
	} = $props();
</script>

<span class="identity">
	<PlayerAvatar name={user.name} image={user.image} />
	<span class="copy">
		<strong>{user.name}</strong>
		{#if detail}<small>{detail}</small>{/if}
	</span>
</span>

<style>
	.identity {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.85rem;
	}
	.copy {
		display: grid;
		min-width: 0;
		gap: 0.2rem;
	}
	strong {
		overflow: hidden;
		font-size: 0.93rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	small {
		color: var(--muted);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	@media (max-width: 680px) {
		small {
			display: none;
		}
	}
</style>
