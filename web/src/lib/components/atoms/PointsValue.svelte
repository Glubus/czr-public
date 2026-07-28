<script lang="ts">
	let {
		value,
		empty = '-',
		size = 'medium'
	}: { value: number | null; empty?: string; size?: 'small' | 'medium' | 'large' } = $props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
</script>

<span class="points {size}"
	><strong>{value === null ? empty : number.format(value)}</strong><small>PP</small></span
>

<style>
	.points {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
		color: var(--signal);
	}
	strong {
		font-family: var(--font-display);
		font-size: 1.25rem;
	}
	small {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
	}
	.small strong {
		font-size: 1rem;
	}
	.large strong {
		font-size: 2.8rem;
	}
	.large small {
		font-size: 0.7rem;
	}
</style>
