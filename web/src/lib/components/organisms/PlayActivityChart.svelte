<script lang="ts">
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import ChartTooltip from '$lib/components/atoms/ChartTooltip.svelte';
	import type { UserRecords } from '$lib/types';

	let {
		history,
		total
	}: {
		history: UserRecords['mostPlayed']['playHistory'];
		total: number;
	} = $props();
	const number = new Intl.NumberFormat('en-US');
	const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
	let hoveredPoint = $state<{
		x: number;
		y: number;
		value: number;
		month: Date;
	} | null>(null);
	let graph = $derived.by(() => {
		if (!history.length) return null;
		const values = history.map((entry) => entry.playCount);
		const highest = Math.max(1, ...values);
		const roughStep = Math.max(1, highest / 4);
		const power = 10 ** Math.floor(Math.log10(roughStep));
		const normalized = roughStep / power;
		const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power;
		const max = Math.max(step, Math.ceil(highest / step) * step);
		const left = 72;
		const top = 22;
		const bottom = 278;
		const width = 1000;
		const coordinates = history.map((entry, index) => ({
			x:
				history.length === 1
					? (left + width - 26) / 2
					: left + (index / (history.length - 1)) * (width - left - 26),
			y: bottom - (entry.playCount / max) * (bottom - top),
			value: entry.playCount,
			month: new Date(`${entry.month}T00:00:00Z`),
			showLabel:
				index % Math.max(1, Math.ceil(history.length / 12)) === 0 || index === history.length - 1
		}));
		const yTicks = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => ({
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
			<Eyebrow>Verified activity</Eyebrow>
			<h2>PLAYS OVER TIME</h2>
		</div>
		<strong>{number.format(total)} PLAYS</strong>
	</header>
	{#if graph}
		<div class="chart-scroll">
			<div class="plot">
				<svg viewBox={`0 0 ${graph.width} 330`} role="img" aria-label="Verified plays per month">
					{#each graph.yTicks as tick (tick.value)}
						<line x1={graph.left} y1={tick.y} x2={graph.width - 26} y2={tick.y}></line>
						<text class="y-label" x={graph.left - 10} y={tick.y + 3} text-anchor="end"
							>{number.format(tick.value)}</text
						>
					{/each}
					{#each graph.coordinates as point (point.month.getTime())}
						{#if point.showLabel}
							<line class="month-line" x1={point.x} y1="22" x2={point.x} y2={graph.bottom}></line>
						{/if}
					{/each}
					<polygon points={graph.area}></polygon>
					<polyline points={graph.line}></polyline>
					{#each graph.coordinates as point (point.month.getTime())}
						<circle
							cx={point.x}
							cy={point.y}
							r="3.5"
							role="button"
							tabindex="0"
							aria-label={`${monthLabel.format(point.month)}, ${number.format(point.value)} plays`}
							onmouseenter={() => (hoveredPoint = point)}
							onmouseleave={() => (hoveredPoint = null)}
							onfocus={() => (hoveredPoint = point)}
							onblur={() => (hoveredPoint = null)}
						></circle>
						{#if point.showLabel}
							<text class="month-label" x={point.x} y="308" text-anchor="middle"
								>{monthLabel.format(point.month)}</text
							>
						{/if}
					{/each}
					<text
						class="axis-label"
						x="14"
						y="150"
						transform="rotate(-90 14 150)"
						text-anchor="middle">PLAYS PER MONTH</text
					>
				</svg>
				{#if hoveredPoint}
					<ChartTooltip
						x={(hoveredPoint.x / graph.width) * 100}
						y={(hoveredPoint.y / 330) * 100}
						label={monthLabel.format(hoveredPoint.month)}
						value={`${number.format(hoveredPoint.value)} plays`}
						detail="Verified submissions during the month"
					/>
				{/if}
			</div>
		</div>
	{:else}
		<p class="empty">No verified activity to chart yet.</p>
	{/if}
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
	circle:hover,
	circle:focus {
		fill: var(--signal);
		stroke-width: 3;
	}
	text {
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
