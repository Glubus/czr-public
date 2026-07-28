<script lang="ts">
	import ChartTooltip from '$lib/components/atoms/ChartTooltip.svelte';
	import type { PointCurve } from './calculator';

	let {
		chart,
		worldRecord,
		targetRound,
		targetPoints
	}: {
		chart: PointCurve;
		worldRecord: number;
		targetRound: number;
		targetPoints: number;
	} = $props();
	let hovered = $state<{ x: number; y: number; round: number; points: number } | null>(null);
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
	const target = $derived({
		x: chart.targetX,
		y: chart.targetY,
		round: targetRound,
		points: targetPoints
	});
</script>

<div class="chart">
	<div class="title"><span>PP PROGRESSION</span><b>WR {number.format(worldRecord)}</b></div>
	<div class="plot">
		<svg viewBox="0 0 540 260" role="img" aria-label="PP progression by round">
			{#each [0.25, 0.5, 0.75, 1] as ratio (ratio)}<line
					class="grid"
					x1={chart.left}
					y1={chart.bottom - ratio * (chart.bottom - chart.top)}
					x2={chart.right}
					y2={chart.bottom - ratio * (chart.bottom - chart.top)}
				></line>{/each}
			<line x1={chart.left} y1={chart.top} x2={chart.left} y2={chart.bottom}></line><line
				x1={chart.left}
				y1={chart.bottom}
				x2={chart.right}
				y2={chart.bottom}
			></line><path d={chart.path}></path>
			{#each chart.markers as marker (marker.round)}<circle
					class="marker"
					cx={marker.x}
					cy={marker.y}
					r="3"
					role="button"
					tabindex="0"
					aria-label={`Round ${marker.round}, ${number.format(marker.points)} PP`}
					onmouseenter={() => (hovered = marker)}
					onmouseleave={() => (hovered = null)}
					onfocus={() => (hovered = marker)}
					onblur={() => (hovered = null)}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							hovered = hovered?.round === marker.round ? null : marker;
						}
					}}
				></circle>{/each}
			<circle
				class="target"
				cx={chart.targetX}
				cy={chart.targetY}
				r="5"
				role="button"
				tabindex="0"
				aria-label={`Target round ${targetRound}, ${number.format(targetPoints)} PP`}
				onmouseenter={() => (hovered = target)}
				onmouseleave={() => (hovered = null)}
				onfocus={() => (hovered = target)}
				onblur={() => (hovered = null)}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						hovered = target;
					}
				}}
			></circle>
			<text x={chart.left - 8} y={chart.top + 4} text-anchor="end"
				>{number.format(chart.maxPoints)}</text
			><text x={chart.left - 8} y={chart.bottom + 3} text-anchor="end">0 PP</text><text
				x={chart.left}
				y="239"
				text-anchor="middle">1</text
			><text x={chart.right} y="239" text-anchor="middle">R{chart.maximumRound}</text><text
				x={(chart.left + chart.right) / 2}
				y="255"
				text-anchor="middle">ROUND</text
			>
		</svg>
		{#if hovered}<ChartTooltip
				x={(hovered.x / 540) * 100}
				y={(hovered.y / 260) * 100}
				label={`Round ${hovered.round}`}
				value={`${number.format(hovered.points)} PP`}
				detail={hovered.round === targetRound ? 'Current target' : undefined}
			/>{/if}
	</div>
</div>

<style>
	.chart {
		margin-top: 1rem;
		padding: 0.75rem 0.65rem 0.25rem;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
	}
	.title {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 0.56rem;
		font-weight: 900;
		letter-spacing: 0.08em;
	}
	.title b {
		color: var(--ink);
	}
	.plot {
		position: relative;
	}
	svg {
		display: block;
		width: 100%;
		margin-top: 0.35rem;
		overflow: visible;
	}
	line {
		stroke: var(--line-strong);
		stroke-width: 1;
	}
	.grid {
		stroke: color-mix(in srgb, var(--line) 68%, transparent);
	}
	path {
		fill: none;
		stroke: var(--signal);
		stroke-width: 2.5;
		stroke-linejoin: round;
	}
	.target {
		fill: var(--panel);
		stroke: var(--signal);
		stroke-width: 2.5;
	}
	.marker {
		fill: var(--signal);
		stroke: var(--canvas-soft);
		stroke-width: 1;
	}
	circle:hover {
		fill: var(--signal);
		stroke-width: 3;
	}
	text {
		fill: var(--muted);
		font-size: 8px;
		font-weight: 800;
	}
</style>
