<script lang="ts">
	import PointsValue from '$lib/components/atoms/PointsValue.svelte';

	let {
		href,
		position,
		mapName,
		categoryName,
		context,
		result,
		points = null,
		awardedPoints = null,
		awardPercentage = null,
		date = null,
		highlight = false
	}: {
		href: string;
		position?: string | number;
		mapName: string;
		categoryName: string;
		context?: string;
		result: string;
		points?: number | null;
		awardedPoints?: number | null;
		awardPercentage?: number | null;
		date?: string | null;
		highlight?: boolean;
	} = $props();
	const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
	const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a class:highlight class="record-card" {href}>
	<span class="position">{position ?? '-'}</span>
	<div class="record-name">
		<strong>{mapName} <span>· {categoryName}</span></strong>
		{#if context}<small>{context}</small>{/if}
	</div>
	<strong class="result">{result}</strong>
	{#if points !== null}<span class="points-cell">
			<PointsValue value={points} />
			{#if awardedPoints !== null && awardPercentage !== null}<small
					>{decimal.format(awardedPoints)} PP ({percent.format(awardPercentage)}%)</small
				>{/if}
		</span>{:else}<span class="no-points">-</span>{/if}
	<span class="date">{date ?? '-'}</span>
</a>

<style>
	.record-card {
		display: grid;
		grid-template-columns: 4rem minmax(15rem, 1fr) 9rem 9rem 8rem;
		min-height: 4.8rem;
		align-items: center;
		padding: 0.6rem 1.2rem;
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.record-card:hover {
		background: var(--panel-hover);
	}
	.record-card.highlight {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--signal) 10%, transparent),
			transparent 48%
		);
		box-shadow: inset 2px 0 var(--signal);
	}
	.position {
		color: var(--muted);
		font-family: var(--font-display);
		font-size: 0.9rem;
	}
	.highlight .position {
		color: var(--signal);
	}
	.record-name {
		min-width: 0;
	}
	.record-name strong {
		display: block;
		overflow: hidden;
		font-size: 0.75rem;
		font-weight: 900;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.record-name strong span {
		color: var(--muted);
		font-weight: 700;
	}
	.record-name small {
		display: block;
		margin-top: 0.25rem;
		color: var(--muted);
		font-size: 0.58rem;
	}
	.result {
		font-family: var(--font-display);
		font-size: 0.92rem;
	}
	.points-cell {
		display: grid;
		justify-items: start;
		gap: 0.2rem;
	}
	.points-cell > small {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.62rem;
		font-weight: 800;
		white-space: nowrap;
	}
	.no-points,
	.date {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.58rem;
	}
	.date {
		text-align: right;
	}
	@media (max-width: 850px) {
		.record-card {
			grid-template-columns: 3rem minmax(0, 1fr) auto 5rem;
		}
		.date {
			display: none;
		}
	}
	@media (max-width: 600px) {
		.record-card {
			grid-template-columns: 2.4rem minmax(0, 1fr) auto;
			padding-inline: 0.8rem;
		}
		.points-cell,
		.no-points {
			display: none;
		}
	}
</style>
