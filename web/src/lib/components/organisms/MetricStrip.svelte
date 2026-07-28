<script lang="ts">
	export type MetricStripItem = {
		label: string;
		value: string | number;
		index?: string;
		highlight?: boolean;
	};

	let {
		items,
		variant = 'compact',
		label
	}: {
		items: MetricStripItem[];
		variant?: 'compact' | 'platform';
		label?: string;
	} = $props();
</script>

<section class:platform={variant === 'platform'} aria-label={label}>
	{#each items as item (item.label)}
		<div class:highlight={item.highlight}>
			{#if item.index}<span class="index">{item.index}</span>{/if}
			<strong>{item.value}</strong>
			<p>{item.label}</p>
		</div>
	{/each}
</section>

<style>
	section {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-bottom: 1rem;
		border: 1px solid var(--line);
	}
	section > div {
		display: grid;
		gap: 0.5rem;
		padding: 1rem;
		border-right: 1px solid var(--line);
		background: var(--panel);
	}
	section > div:last-child {
		border-right: 0;
	}
	p {
		margin: 0;
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	strong {
		order: 2;
		font-family: var(--font-display);
		font-size: 2rem;
		font-style: italic;
	}
	p {
		order: 1;
	}
	.platform {
		grid-template-columns: repeat(5, 1fr);
		margin-bottom: 0;
		border-top: 0;
		background: var(--canvas-soft);
	}
	.platform > div {
		display: block;
		min-width: 0;
		min-height: 7.5rem;
		padding: 1.2rem 1.4rem;
		background: transparent;
	}
	.platform .index {
		color: #525952;
		font-family: monospace;
		font-size: 0.62rem;
	}
	.platform strong {
		display: block;
		margin-top: 0.7rem;
		font-size: clamp(1.35rem, 2.2vw, 1.75rem);
		font-style: normal;
		letter-spacing: 0.04em;
	}
	.platform p {
		margin-top: 0.2rem;
		font-size: 0.7rem;
		font-weight: 400;
		text-transform: none;
	}
	.platform .highlight strong {
		color: var(--signal);
	}
	@media (max-width: 650px) {
		section {
			grid-template-columns: 1fr 1fr;
		}
		section > div:nth-child(2) {
			border-right: 0;
		}
		section > div:nth-child(-n + 2) {
			border-bottom: 1px solid var(--line);
		}
	}
	@media (max-width: 850px) {
		.platform {
			grid-template-columns: repeat(2, 1fr);
		}
		.platform > div {
			border-bottom: 1px solid var(--line);
		}
		.platform > div:nth-child(2n) {
			border-right: 0;
		}
		.platform > div:last-child {
			grid-column: 1 / -1;
			border-bottom: 0;
		}
	}
	@media (max-width: 500px) {
		.platform > div {
			min-height: 6.5rem;
			padding: 1rem;
		}
	}
</style>
