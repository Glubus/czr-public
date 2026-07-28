<script lang="ts">
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import ChartTooltip from '$lib/components/atoms/ChartTooltip.svelte';
	import type { PerformanceHistory } from '$lib/types';
	let { history, current }: { history: PerformanceHistory | null; current: number } = $props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }),
		monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
	let hoveredPoint = $state<{
		x: number;
		y: number;
		value: number;
		change: number;
		month: Date;
	} | null>(null);
	let graph = $derived.by(() => {
		const snapshots = history?.entries ?? [];
		if (!snapshots.length) return null;
		const maximumPoints = 40,
			stride = Math.max(1, Math.ceil((snapshots.length - 1) / (maximumPoints - 1))),
			displayed = snapshots.filter(
				(entry, index) =>
					entry.source !== 'daily' || index % stride === 0 || index === snapshots.length - 1
			),
			values = displayed.map((entry) => entry.points),
			roughStep = Math.max(1, current / 4),
			power = 10 ** Math.floor(Math.log10(roughStep)),
			normalized = roughStep / power,
			step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power,
			max = Math.max(step, Math.ceil(current / step) * step),
			left = 72,
			top = 22,
			bottom = 278,
			width = 1000,
			coordinates = values.map((value, index) => ({
				id: displayed[index]?.id ?? index,
				x:
					displayed.length === 1
						? (left + width - 26) / 2
						: left + (index / (displayed.length - 1)) * (width - left - 26),
				y: bottom - (value / max) * (bottom - top),
				value,
				change: displayed[index]?.delta ?? value - (values[index - 1] ?? 0),
				month: new Date(displayed[index]?.recordedAt ?? 0),
				source: displayed[index]?.source ?? 'daily'
			})),
			yTicks = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => ({
				value: index * step,
				y: bottom - ((index * step) / max) * (bottom - top)
			}));
		return {
			line: coordinates.map((point) => `${point.x},${point.y}`).join(' '),
			area: `${left},${bottom} ${coordinates.map((point) => `${point.x},${point.y}`).join(' ')} ${width - 26},${bottom}`,
			coordinates,
			yTicks,
			width,
			left,
			bottom
		};
	});
</script>

<section>
	<header>
		<div>
			<Eyebrow>Performance</Eyebrow>
			<h2>TOP PLAY PROGRESSION</h2>
		</div>
		<strong>{number.format(current)} PP</strong>
	</header>
	{#if graph}<div class="chart-scroll">
			<div class="plot">
				<svg
					viewBox={`0 0 ${graph.width} 330`}
					role="img"
					aria-label="Monthly performance progression from top plays"
				>
					{#each graph.yTicks as tick (tick.value)}
						<line x1={graph.left} y1={tick.y} x2={graph.width - 26} y2={tick.y}></line>
						<text class="y-label" x={graph.left - 10} y={tick.y + 3} text-anchor="end"
							>{number.format(tick.value)}</text
						>
					{/each}
					{#each graph.coordinates as point (point.id)}
						<line class="month-line" x1={point.x} y1="22" x2={point.x} y2={graph.bottom}></line>
					{/each}
					<polygon points={graph.area}></polygon><polyline points={graph.line}></polyline>
					{#each graph.coordinates as point (point.id)}
						<circle
							cx={point.x}
							cy={point.y}
							r="3.5"
							role="button"
							tabindex="0"
							aria-label={`${monthLabel.format(point.month)}, ${number.format(point.value)} PP`}
							onmouseenter={() => (hoveredPoint = point)}
							onmouseleave={() => (hoveredPoint = null)}
							onfocus={() => (hoveredPoint = point)}
							onblur={() => (hoveredPoint = null)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									hoveredPoint =
										hoveredPoint?.month.getTime() === point.month.getTime() ? null : point;
								}
							}}
						></circle>
						<text class="month-label" x={point.x} y="308" text-anchor="middle"
							>{monthLabel.format(point.month)}</text
						>
					{/each}
					<text
						class="axis-label"
						x="14"
						y="150"
						transform="rotate(-90 14 150)"
						text-anchor="middle">PERFORMANCE POINTS</text
					>
				</svg>
				{#if hoveredPoint}
					<ChartTooltip
						x={(hoveredPoint.x / graph.width) * 100}
						y={(hoveredPoint.y / 330) * 100}
						label={monthLabel.format(hoveredPoint.month)}
						value={`${number.format(hoveredPoint.value)} PP`}
						detail={`${hoveredPoint.change >= 0 ? '+' : ''}${number.format(hoveredPoint.change)} PP · verified history`}
					/>
				{/if}
			</div>
		</div>{:else}<p class="empty">
			Exact progression tracking starts with the first recorded snapshot.
		</p>{/if}
</section>

<style>
	section {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 6.5rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.3rem 1.5rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.45rem 0 0;
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-style: italic;
	}
	header > strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.35rem;
	}
	.chart-scroll {
		padding: 1.5rem 1.5rem 1rem;
	}
	.plot {
		position: relative;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	line {
		stroke: var(--line);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.month-line {
		stroke: color-mix(in srgb, var(--line) 55%, transparent);
	}
	polygon {
		fill: color-mix(in srgb, var(--signal) 13%, transparent);
	}
	polyline {
		fill: none;
		stroke: var(--signal);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 3;
		vector-effect: non-scaling-stroke;
	}
	circle {
		fill: var(--panel);
		stroke: var(--signal);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	circle:hover {
		fill: var(--signal);
		stroke-width: 3;
	}
	text {
		color: var(--muted);
		fill: var(--muted);
		font-family: monospace;
		font-size: 9px;
		text-transform: uppercase;
	}
	.month-label {
		font-size: 7.5px;
	}
	.axis-label {
		font-size: 7px;
		font-weight: 900;
		letter-spacing: 0.08em;
	}
	.empty {
		margin: 0;
		padding: 4rem 1.5rem;
		color: var(--muted);
		font-size: 0.75rem;
		text-align: center;
	}
</style>
