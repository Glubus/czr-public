<script lang="ts">
	import 'flag-icons/css/flag-icons.min.css';

	let {
		code,
		label = `${code.toUpperCase()} flag`,
		size = 'medium'
	}: {
		code: string;
		label?: string;
		size?: 'small' | 'medium' | 'large';
	} = $props();

	let normalizedCode = $derived(code.trim().toLowerCase());
</script>

<span class={`fi fi-${normalizedCode} country-flag ${size}`} role="img" aria-label={label}></span>

<style>
	.country-flag {
		flex: 0 0 auto;
		border: 1px solid color-mix(in srgb, white 18%, transparent);
		box-shadow: 0 0.15rem 0.45rem rgb(0 0 0 / 28%);
	}
	.small {
		font-size: 0.8rem;
	}
	.medium {
		font-size: 1.1rem;
	}
	.large {
		font-size: 1.55rem;
	}
</style>
