<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import { formatRecordScore } from '$lib/display';
	import { loadGameMaps, loadMapCategories } from '$lib/features/record-submission/catalog-client';
	import type { CategoryForMap, Game, MapResult } from '$lib/types';
	import type { PersonalRunPage } from './contracts';

	let { runs, games }: { runs: PersonalRunPage['entries']; games: Game[] } = $props();
	let gameId = $state('');
	let mapId = $state('');
	let assignmentId = $state('');
	let maps = $state<MapResult[]>([]);
	let categories = $state<CategoryForMap[]>([]);
	let loading = $state(false);
	let error = $state('');
	let selectedGame = $derived(games.find((entry) => String(entry.id) === gameId));
	let selectedCategory = $derived(
		categories.find((entry) => String(entry.assignmentId) === assignmentId)
	);

	const date = (value: string) =>
		new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
			new Date(value)
		);

	async function chooseGame(value: string) {
		gameId = value;
		mapId = '';
		assignmentId = '';
		maps = [];
		categories = [];
		if (!selectedGame) return;
		loading = true;
		error = '';
		try {
			const result = await loadGameMaps(fetch, selectedGame.slug);
			maps = result.entries;
			if (result.unavailable) error = 'Maps are temporarily unavailable.';
		} catch {
			error = 'Maps are temporarily unavailable.';
		} finally {
			loading = false;
		}
	}

	async function chooseMap(value: string) {
		mapId = value;
		assignmentId = '';
		categories = [];
		if (!value) return;
		loading = true;
		error = '';
		try {
			const result = await loadMapCategories(fetch, value);
			categories = result.entries;
			if (result.unavailable) error = 'Categories are temporarily unavailable.';
		} catch {
			error = 'Categories are temporarily unavailable.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="layout">
	<section>
		<header>
			<div>
				<span>Private progression</span>
				<h2>Personal runs</h2>
			</div>
		</header>
		{#if runs.length}
			<div class="run-list">
				{#each runs as run (run.id)}
					<article>
						<span>{run.visibility}</span>
						<div>
							<strong>{run.map.name}</strong><small>{run.game.name} · {run.category.name}</small>
						</div>
						<div class="value">
							<strong
								>{formatRecordScore(
									run.scoreValue,
									run.category.scoreType,
									run.runDurationMs
								)}</strong
							>
							<small>{date(run.createdAt)}</small>
						</div>
						<div class="actions">
							{#if run.promotedSubmissionId}
								<a href={resolve('/submissions/[id]', { id: String(run.promotedSubmissionId) })}
									>Submission →</a
								>
							{:else}
								<form method="POST" action="?/deleteRun">
									<input type="hidden" name="id" value={run.id} /><button>Delete</button>
								</form>
								{#if run.proofUrl}
									<form method="POST" action="?/promoteRun">
										<input type="hidden" name="id" value={run.id} /><button>Promote →</button>
									</form>
								{/if}
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<p class="empty">No personal attempts saved yet.</p>
		{/if}
	</section>
	<section class="create">
		<header>
			<div>
				<span>New attempt</span>
				<h2>Save a run</h2>
			</div>
		</header>
		<form method="POST" action="?/createRun">
			<label>
				Game
				<select
					name="gameId"
					bind:value={gameId}
					onchange={(event) => chooseGame(event.currentTarget.value)}
					required
				>
					<option value="">Choose a game</option>
					{#each games as game (game.id)}<option value={game.id}>{game.name}</option>{/each}
				</select>
			</label>
			<label>
				Map
				<select
					name="mapId"
					bind:value={mapId}
					onchange={(event) => chooseMap(event.currentTarget.value)}
					disabled={!gameId || loading}
					required
				>
					<option value="">Choose a map</option>
					{#each maps as map (map.id)}<option value={map.id}>{map.name}</option>{/each}
				</select>
			</label>
			<label>
				Category
				<select
					name="categoryAssignmentId"
					bind:value={assignmentId}
					disabled={!mapId || loading}
					required
				>
					<option value="">Choose a category</option>
					{#each categories as category (category.assignmentId)}
						<option value={category.assignmentId}>{category.name}</option>
					{/each}
				</select>
			</label>
			<input type="hidden" name="scoreType" value={selectedCategory?.scoreType ?? ''} />
			{#if selectedCategory?.scoreType === 'time'}
				<label>Time (HH:MM:SS)<input name="duration" placeholder="01:23:45" required /></label>
			{:else}
				<label>
					{selectedCategory?.scoreType === 'round' ? 'Round' : 'Score'}
					<input name="scoreValue" type="number" min="1" step="1" required />
				</label>
			{/if}
			<label
				>Proof URL <small>Optional until promotion</small><input
					name="proofUrl"
					type="url"
				/></label
			>
			<label>
				Visibility
				<select name="visibility">
					<option value="private">Private</option>
					<option value="followers">Followers</option>
					<option value="public">Public</option>
				</select>
			</label>
			<label>Notes<textarea name="notes" maxlength="5000" rows="3"></textarea></label>
			{#if error}<FormAlert message={error} />{/if}
			<button class="primary-action" disabled={!selectedCategory || loading}>Save run →</button>
		</form>
	</section>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(20rem, 0.8fr);
		gap: 1rem;
		max-width: 86rem;
	}
	section {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	section > header {
		display: flex;
		min-height: 4.7rem;
		align-items: center;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--line);
	}
	header span {
		color: var(--signal);
		font-size: 0.55rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	h2 {
		margin: 0.25rem 0 0;
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-style: italic;
		text-transform: uppercase;
	}
	.run-list article {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	.run-list article > span {
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--line-strong);
		color: var(--muted);
		font-size: 0.5rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.run-list article > div:not(.actions) {
		display: grid;
		gap: 0.2rem;
	}
	small {
		color: var(--muted);
		font-size: 0.54rem;
	}
	.value {
		justify-items: end;
	}
	.actions {
		display: flex;
		gap: 0.4rem;
	}
	.actions form {
		display: contents;
	}
	.actions a,
	.actions button {
		border: 0;
		background: transparent;
		color: var(--signal);
		font-size: 0.55rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
		cursor: pointer;
	}
	.create > form {
		display: grid;
		gap: 0.8rem;
		padding: 1rem;
	}
	label {
		display: grid;
		gap: 0.4rem;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	input,
	select,
	textarea {
		min-height: 2.8rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--ink);
		font: inherit;
	}
	.empty {
		margin: 0;
		padding: 2rem 1.2rem;
		color: var(--muted);
		font-size: 0.68rem;
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 650px) {
		.run-list article {
			grid-template-columns: 1fr auto;
		}
		.run-list article > span {
			grid-column: 1 / -1;
		}
	}
</style>
