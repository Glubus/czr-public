<script lang="ts">
	import CountryFlag from './CountryFlag.svelte';

	let {
		code,
		name,
		selected = false,
		showMarker = false
	}: {
		code: string;
		name: string;
		selected?: boolean;
		showMarker?: boolean;
	} = $props();
</script>

<span class="country-choice">
	<CountryFlag {code} label={`${name} flag`} size="medium" />
	<span class="copy"><strong>{name}</strong><small>{code}</small></span>
	{#if showMarker}<i aria-hidden="true">{selected ? '✓' : '→'}</i>{/if}
</span>

<style>
	.country-choice {
		display: flex;
		width: 100%;
		min-width: 0;
		align-items: center;
		gap: 0.65rem;
	}
	.copy {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}
	.copy strong {
		overflow: hidden;
		color: var(--ink);
		font-size: 0.76rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.copy small {
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	i {
		margin-left: auto;
		color: var(--signal);
		font-style: normal;
	}
</style>
