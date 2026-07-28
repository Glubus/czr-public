<script lang="ts">
	let {
		x,
		y,
		label,
		value,
		detail
	}: { x: number; y: number; label: string; value: string; detail?: string } = $props();
</script>

<div class="tooltip" role="tooltip" style={`left: ${x}%; top: ${y}%`}>
	<span>{label}</span>
	<strong>{value}</strong>
	{#if detail}<small>{detail}</small>{/if}
</div>

<style>
	.tooltip {
		position: absolute;
		z-index: 4;
		display: grid;
		min-width: 8.5rem;
		gap: 0.2rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--signal-soft);
		background: color-mix(in srgb, var(--panel) 94%, transparent);
		box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.42);
		pointer-events: none;
		transform: translate(-50%, calc(-100% - 0.65rem));
		white-space: nowrap;
	}
	.tooltip::after {
		position: absolute;
		bottom: -0.28rem;
		left: 50%;
		width: 0.48rem;
		height: 0.48rem;
		border-right: 1px solid var(--signal-soft);
		border-bottom: 1px solid var(--signal-soft);
		background: var(--panel);
		content: '';
		transform: translateX(-50%) rotate(45deg);
	}
	span,
	small {
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1rem;
		letter-spacing: 0.03em;
	}
	small {
		font-size: 0.5rem;
		letter-spacing: 0.05em;
	}
</style>
