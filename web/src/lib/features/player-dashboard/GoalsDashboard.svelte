<script lang="ts">
	import { loadGameMaps, loadMapCategories } from '$lib/features/record-submission/catalog-client';
	import type { CategoryForMap, MapResult } from '$lib/types';
	import type { PageData } from '../../../routes/me/$types';

	let { goals, challenges, games }: Pick<PageData, 'goals' | 'challenges' | 'games'> = $props();
	let metric = $state('performance_points');
	let gameId = $state('');
	let mapId = $state('');
	let assignmentId = $state('');
	let maps = $state<MapResult[]>([]);
	let categories = $state<CategoryForMap[]>([]);
	let loading = $state(false);
	let game = $derived(games.find((entry) => String(entry.id) === gameId));

	async function selectGame(value: string) {
		gameId = value;
		mapId = '';
		assignmentId = '';
		maps = [];
		categories = [];
		if (!game) return;
		loading = true;
		try {
			maps = (await loadGameMaps(fetch, game.slug)).entries;
		} finally {
			loading = false;
		}
	}

	async function selectMap(value: string) {
		mapId = value;
		assignmentId = '';
		categories = [];
		if (!value) return;
		loading = true;
		try {
			categories = (await loadMapCategories(fetch, value)).entries;
		} finally {
			loading = false;
		}
	}

	function percent(goal: PageData['goals'][number]) {
		if (goal.direction === 'lower_is_better') {
			return goal.progress > 0 ? Math.min(100, (goal.targetValue / goal.progress) * 100) : 0;
		}
		return Math.min(100, (goal.progress / goal.targetValue) * 100);
	}

	function valueLabel(value: number, goalMetric: string) {
		if (goalMetric !== 'time') return Math.round(value).toLocaleString('en-US');
		const seconds = Math.floor(value / 1000);
		return `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
	}

	function date(value: string) {
		return new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(value));
	}
</script>

<div class="layout">
	<section class="panel">
		<header>
			<div>
				<span>Targets</span>
				<h2>Active goals</h2>
			</div>
		</header>
		{#if goals.length}
			<div class="goal-list">
				{#each goals as goal (goal.id)}
					<article>
						<div>
							<strong>{goal.title}</strong><small
								>{goal.board
									? `${goal.board.game.name} · ${goal.board.map.name} · ${goal.board.category.name} · ${goal.playerCount}P`
									: goal.metric.replace('_', ' ')}</small
							>
						</div>
						<b>{Math.round(percent(goal))}%</b>
						<div class="progress"><i style={`width: ${percent(goal)}%`}></i></div>
						<small
							>{valueLabel(goal.progress, goal.metric)} / {valueLabel(
								goal.targetValue,
								goal.metric
							)}{goal.dueAt ? ` · due ${date(goal.dueAt)}` : ''}</small
						>
						<form method="POST" action="?/goalStatus">
							<input type="hidden" name="id" value={goal.id} />
							{#if goal.status === 'active'}<button name="status" value="abandoned">Abandon</button>
							{:else if goal.status === 'abandoned'}<button name="status" value="active"
									>Reactivate</button
								>
							{:else}<span>Completed</span>{/if}
						</form>
					</article>
				{/each}
			</div>
		{:else}<p class="empty">Set a target to make your next milestone visible.</p>{/if}
	</section>

	<section class="panel create">
		<header>
			<div>
				<span>New milestone</span>
				<h2>Create a goal</h2>
			</div>
		</header>
		<form method="POST" action="?/goal">
			<label
				>Goal name<input
					name="title"
					required
					maxlength="120"
					placeholder="Reach 40,000 PP"
				/></label
			>
			<label
				>Metric<select name="metric" bind:value={metric}
					><option value="performance_points">Performance points</option><option
						value="verified_submissions">Verified submissions</option
					><option value="round">Target round</option><option value="time">Target time</option
					><option value="rank">Target rank</option></select
				></label
			>
			{#if ['round', 'time', 'rank'].includes(metric)}
				<label
					>Game<select
						name="gameId"
						bind:value={gameId}
						onchange={(event) => selectGame(event.currentTarget.value)}
						required
						><option value="">Choose a game</option>{#each games as entry (entry.id)}<option
								value={entry.id}>{entry.name}</option
							>{/each}</select
					></label
				>
				<label
					>Map<select
						name="mapId"
						bind:value={mapId}
						onchange={(event) => selectMap(event.currentTarget.value)}
						disabled={!gameId || loading}
						required
						><option value="">Choose a map</option>{#each maps as map (map.id)}<option
								value={map.id}>{map.name}</option
							>{/each}</select
					></label
				>
				<label
					>Category<select
						name="categoryAssignmentId"
						bind:value={assignmentId}
						disabled={!mapId || loading}
						required
						><option value="">Choose a category</option
						>{#each categories.filter((category) => metric === 'rank' || category.scoreType === metric) as category (category.assignmentId)}<option
								value={category.assignmentId}>{category.name}</option
							>{/each}</select
					></label
				>
				<label
					>Players<select name="playerCount"
						><option value="1">1P</option><option value="2">2P</option><option value="3">3P</option
						><option value="4">4P</option></select
					></label
				>
			{/if}
			{#if metric === 'time'}<label
					>Target time<input
						name="targetTime"
						inputmode="decimal"
						placeholder="01:23:45"
						required
					/></label
				>
			{:else}<label>Target<input name="targetValue" type="number" min="1" required /></label>{/if}
			<label>Due date <small>Optional</small><input name="dueAt" type="date" /></label>
			<button class="primary-action">Create goal →</button>
		</form>
	</section>

	{#if challenges.length}
		<section class="panel challenges">
			<header>
				<div>
					<span>Live events</span>
					<h2>Challenges</h2>
				</div>
			</header>
			<div class="goal-list">
				{#each challenges as challenge (challenge.id)}
					<article>
						<div><strong>{challenge.name}</strong><small>{challenge.description}</small></div>
						<b
							>{Math.min(
								100,
								Math.round(((challenge.progress ?? 0) / challenge.targetValue) * 100)
							)}%</b
						>
						<div class="progress">
							<i
								style={`width: ${Math.min(100, ((challenge.progress ?? 0) / challenge.targetValue) * 100)}%`}
							></i>
						</div>
						<small>{date(challenge.startsAt)} - {date(challenge.endsAt)}</small>
					</article>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 0.8fr);
		gap: 1rem;
	}
	.panel {
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 1.25rem;
	}
	header {
		margin-bottom: 1rem;
	}
	header span {
		color: var(--signal);
		font: 900 0.58rem monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0.2rem 0 0;
		font-family: var(--font-display);
	}
	.create form {
		display: grid;
		gap: 0.8rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	input,
	select {
		width: 100%;
		border: 1px solid var(--line);
		background: var(--field);
		color: var(--text);
		padding: 0.75rem;
	}
	.goal-list {
		display: grid;
		gap: 0.75rem;
	}
	.goal-list article {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem 1rem;
		padding: 1rem;
		border: 1px solid var(--line);
	}
	.goal-list article div:first-child,
	.goal-list article > small {
		display: grid;
		gap: 0.2rem;
	}
	.progress {
		grid-column: 1 / -1;
		height: 0.3rem;
		background: var(--line);
		overflow: hidden;
	}
	.progress i {
		display: block;
		height: 100%;
		background: var(--signal);
	}
	small {
		color: var(--muted);
	}
	.challenges {
		grid-column: 1 / -1;
	}
	button {
		border: 1px solid var(--line);
		background: transparent;
		color: var(--text);
		padding: 0.55rem 0.75rem;
		cursor: pointer;
	}
	.primary-action {
		background: var(--signal);
		color: #101311;
		font-weight: 900;
	}
	.empty {
		color: var(--muted);
	}
	@media (max-width: 850px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
