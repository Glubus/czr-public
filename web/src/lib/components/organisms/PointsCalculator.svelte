<script lang="ts">
	import { resolve } from '$app/paths';
	import PointCurveChart from '$lib/features/performance-points/PointCurveChart.svelte';
	import {
		buildRoundPointCurve,
		estimateRecordPoints,
		worldRecordScore
	} from '$lib/features/performance-points/calculator';
	import type { CategoryForMap } from '$lib/types';
	let {
		mapId,
		categories,
		initialCategory = 0,
		initialPlayerCount = 1
	}: {
		mapId: number;
		categories: CategoryForMap[];
		initialCategory?: number;
		initialPlayerCount?: number;
	} = $props();
	let open = $state(false),
		categoryId = $state(0),
		players = $state(1),
		targetScore = $state(1);
	let pool = $state<number | null>(null),
		scores = $state<number[]>([]),
		scoreType = $state<CategoryForMap['scoreType']>('round'),
		direction = $state<CategoryForMap['rankingDirection']>('higher_is_better'),
		loading = $state(false),
		failed = $state(false);
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
	let currentWorldRecord = $derived(worldRecordScore(scores, direction));
	let estimateResult = $derived(estimateRecordPoints(targetScore, pool, scores, direction));
	let chart = $derived(
		scoreType === 'round' ? buildRoundPointCurve(targetScore, pool, scores, direction) : null
	);
	async function load() {
		if (!categoryId) return;
		loading = true;
		failed = false;
		try {
			const assignmentId = categories.find((category) => category.id === categoryId)?.assignmentId;
			const response = await fetch(
				resolve(
					`/maps/${mapId}/categories/${categoryId}/pool?player_count=${players}${assignmentId ? `&assignment_id=${assignmentId}` : ''}`
				)
			);
			if (!response.ok) throw new Error();
			const data = (await response.json()) as {
				pool: number;
				scores: number[];
				scoreType: CategoryForMap['scoreType'];
				rankingDirection: CategoryForMap['rankingDirection'];
			};
			pool = data.pool;
			scores = data.scores;
			scoreType = data.scoreType;
			direction = data.rankingDirection;
			targetScore = scores.length
				? direction === 'higher_is_better'
					? Math.max(...scores)
					: Math.min(...scores)
				: 1;
		} catch {
			pool = null;
			failed = true;
		} finally {
			loading = false;
		}
	}
	function show() {
		categoryId ||= initialCategory || categories[0]?.id || 0;
		players = initialPlayerCount;
		open = true;
		void load();
	}
</script>

<button class="fab" type="button" onclick={show} aria-label="Open PP calculator"
	><svg viewBox="0 0 24 24" aria-hidden="true"
		><rect x="5" y="2.5" width="14" height="19" rx="1"></rect><line x1="8" y1="7" x2="16" y2="7"
		></line><circle cx="9" cy="12" r=".7"></circle><circle cx="12" cy="12" r=".7"></circle><circle
			cx="15"
			cy="12"
			r=".7"
		></circle><circle cx="9" cy="16" r=".7"></circle><circle cx="12" cy="16" r=".7"></circle><circle
			cx="15"
			cy="16"
			r=".7"
		></circle></svg
	></button
>
{#if open}
	<button
		class="backdrop"
		type="button"
		aria-label="Close PP calculator"
		onclick={() => (open = false)}
	></button>
	<aside aria-label="PP calculator">
		<header>
			<div>
				<span>THEORETICAL RECORD PP</span>
				<h2>PP CALCULATOR</h2>
			</div>
			<button type="button" onclick={() => (open = false)}>×</button>
		</header>
		<label
			>Category<select bind:value={categoryId} onchange={load}
				>{#each categories as category (category.id)}<option value={category.id}
						>{category.name}</option
					>{/each}</select
			></label
		>
		<fieldset>
			<legend>Players</legend>
			<div>
				{#each [1, 2, 3, 4] as size (size)}<button
						type="button"
						class:active={players === size}
						onclick={() => {
							players = size;
							void load();
						}}>{size}P</button
					>{/each}
			</div>
		</fieldset>
		<label
			>{scoreType === 'round'
				? 'Target round'
				: scoreType === 'time'
					? 'Target time'
					: 'Target score'}<input type="number" min="1" bind:value={targetScore} /></label
		>
		{#if chart}
			<PointCurveChart
				{chart}
				worldRecord={currentWorldRecord}
				targetRound={targetScore}
				targetPoints={estimateResult?.points ?? 0}
			/>
		{/if}
		<div class="result">
			<span>ESTIMATED #{estimateResult?.position ?? '-'} RECORD VALUE</span><strong
				>{loading ? '…' : estimateResult === null ? '-' : number.format(estimateResult.points)}
				{#if !loading && estimateResult !== null}<small>PP</small>{/if}</strong
			>
		</div>
		{#if failed}<p class="error">This pool is currently unavailable.</p>{/if}
		<p class="note">
			This is the record's PP value at the current pool, not the net increase to your profile.
		</p>
	</aside>
{/if}

<style>
	.fab {
		position: fixed;
		right: 1.5rem;
		bottom: 1.5rem;
		z-index: 20;
		display: grid;
		width: 3.5rem;
		height: 3.5rem;
		place-items: center;
		padding: 0;
		border: 0;
		background: var(--signal);
		color: #10120e;
		cursor: pointer;
	}
	.fab svg {
		width: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}
	.fab::before {
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.65rem);
		width: max-content;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--signal-soft);
		background: var(--panel);
		box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.38);
		color: var(--ink);
		content: attr(aria-label);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		opacity: 0;
		pointer-events: none;
		text-transform: uppercase;
		transform: translateY(0.25rem);
		transition:
			opacity 120ms ease,
			transform 120ms ease;
	}
	.fab:hover::before,
	.fab:focus-visible::before {
		opacity: 1;
		transform: translateY(0);
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 25;
		border: 0;
		background: rgba(0, 0, 0, 0.68);
	}
	aside {
		position: fixed;
		right: 1.5rem;
		bottom: 1.5rem;
		z-index: 30;
		width: min(34rem, calc(100vw - 2rem));
		padding: 1.3rem;
		border: 1px solid var(--line-strong);
		background: var(--panel);
		box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, 0.55);
	}
	aside > header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 1.3rem;
	}
	header span,
	label,
	legend,
	.result > span {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-style: italic;
	}
	header button {
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 1.7rem;
		cursor: pointer;
	}
	label {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.9rem;
	}
	select,
	input {
		height: 2.8rem;
		padding: 0 0.75rem;
		border: 1px solid var(--line);
		border-radius: 0;
		background: var(--canvas-soft);
		color: var(--ink);
	}
	fieldset {
		margin: 0.9rem 0 0;
		padding: 0;
		border: 0;
	}
	fieldset div {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-top: 0.45rem;
	}
	fieldset button {
		height: 2.7rem;
		border: 1px solid var(--line);
		border-right: 0;
		background: var(--canvas-soft);
		color: var(--muted);
		font-weight: 900;
		cursor: pointer;
	}
	fieldset button:last-child {
		border-right: 1px solid var(--line);
	}
	fieldset button.active {
		background: var(--signal);
		color: #10120e;
	}
	.result {
		margin-top: 1rem;
		padding: 1.2rem;
		border: 1px solid var(--signal-soft);
		background: color-mix(in srgb, var(--signal) 8%, var(--canvas-soft));
	}
	.result strong {
		display: block;
		margin-top: 0.4rem;
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2.35rem;
	}
	.result small {
		font-size: 0.7rem;
	}
	.note,
	.error {
		margin: 0.8rem 0 0;
		color: var(--muted);
		font-size: 0.62rem;
		line-height: 1.5;
	}
	.error {
		color: var(--danger);
	}
	@media (max-width: 550px) {
		aside {
			right: 1rem;
			bottom: 1rem;
		}
	}
</style>
