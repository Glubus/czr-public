<script lang="ts">
	import { resolve } from '$app/paths';
	import type {
		CategoryAssignmentCollection,
		CategoryDefinition,
		Game,
		MapResult
	} from '$lib/types';
	import { untrack } from 'svelte';

	let {
		games,
		maps,
		categories,
		assignments
	}: {
		games: Game[];
		maps: MapResult[];
		categories: CategoryDefinition[];
		assignments: CategoryAssignmentCollection;
	} = $props();

	let gameId = $state(untrack(() => (games[0]?.id ? String(games[0].id) : '')));
	let mapId = $state(untrack(() => (maps[0]?.id ? String(maps[0].id) : '')));
	let categoryId = $state(untrack(() => (categories[0]?.id ? String(categories[0].id) : '')));
	let assignmentId = $state(
		untrack(() => (assignments.entries[0]?.id ? String(assignments.entries[0].id) : ''))
	);
	let game = $derived(games.find((entry) => entry.id === Number(gameId)));
	let map = $derived(maps.find((entry) => entry.id === Number(mapId)));
	let category = $derived(categories.find((entry) => entry.id === Number(categoryId)));
	let assignment = $derived(assignments.entries.find((entry) => entry.id === Number(assignmentId)));
</script>

<div class="catalog-grid">
	<section>
		<header>
			<span>05</span>
			<div>
				<small>Manage existing</small>
				<h2>Game</h2>
			</div>
		</header>
		<label class="picker"
			>Game<select bind:value={gameId}
				>{#each games as entry (entry.id)}<option value={entry.id}>{entry.name}</option
					>{/each}</select
			></label
		>
		{#if game}{#key gameId}<form method="POST" action="?/updateGame">
					<input type="hidden" name="id" value={game.id} />
					<label>Name<input name="name" value={game.name} required /></label>
					<div class="split">
						<label>Studio<input name="studio" value={game.studio} required /></label>
						<label
							>Type<select name="gameType" value={game.gameType}
								><option value="zombies">Zombies</option><option value="non_zombies"
									>Non-Zombies</option
								></select
							></label
						>
					</div>
					<div class="split">
						<label>Short name<input name="shortName" value={game.shortName} required /></label
						><label
							>Release year<input
								name="releaseYear"
								type="number"
								min="1980"
								max="2100"
								value={game.releaseYear ?? ''}
							/></label
						>
					</div>
					<label class="check"
						><input name="isActive" type="checkbox" checked={game.isActive} /> Available in the public
						catalogue</label
					>
					<button>Save game →</button>
				</form>{/key}{:else}<p class="empty">No game available.</p>{/if}
	</section>

	<section>
		<header>
			<span>06</span>
			<div>
				<small>Manage existing</small>
				<h2>Map</h2>
			</div>
		</header>
		<label class="picker"
			>Map<select bind:value={mapId}
				>{#each maps as entry (entry.id)}<option value={entry.id}
						>{entry.game.name} / {entry.name}</option
					>{/each}</select
			></label
		>
		{#if map}{#key mapId}<form method="POST" action="?/updateMap">
					<input type="hidden" name="id" value={map.id} />
					<label>Name<input name="name" value={map.name} required /></label>
					<label
						>Status<select name="status" value={map.status}
							><option value="draft">Draft</option><option value="published">Published</option
							><option value="archived">Archived</option></select
						></label
					>
					<button>Save map →</button>
				</form>
				<form class="compact" method="POST" action="?/mapStatus">
					<input type="hidden" name="id" value={map.id} />
					<input
						type="hidden"
						name="status"
						value={map.status === 'archived' ? 'published' : 'archived'}
					/>
					<button class:danger={map.status !== 'archived'}
						>{map.status === 'archived' ? 'Restore map' : 'Archive map'}</button
					>
				</form>{/key}{:else}<p class="empty">No map available.</p>{/if}
	</section>

	<section>
		<header>
			<span>07</span>
			<div>
				<small>Manage existing</small>
				<h2>Category</h2>
			</div>
		</header>
		<label class="picker"
			>Category<select bind:value={categoryId}
				>{#each categories as entry (entry.id)}<option value={entry.id}
						>{entry.name} · {entry.scoreType}</option
					>{/each}</select
			></label
		>
		{#if category}{#key categoryId}<form method="POST" action="?/updateCategory">
					<input type="hidden" name="id" value={category.id} />
					<label>Name<input name="name" value={category.name} required /></label>
					<label
						>Global rules JSON<textarea name="rules"
							>{JSON.stringify(category.rules, null, 2)}</textarea
						></label
					>
					<button>Save category →</button>
				</form>
				<form class="danger-zone" method="POST" action="?/deleteCategory">
					<input type="hidden" name="id" value={category.id} />
					<label>Type DELETE to confirm<input name="confirmation" autocomplete="off" /></label>
					<button class="danger">Delete unused category</button>
				</form>{/key}{:else}<p class="empty">No category available.</p>{/if}
	</section>

	<section>
		<header>
			<span>08</span>
			<div>
				<small>Manage existing</small>
				<h2>Ruleset</h2>
			</div>
		</header>
		<label class="picker"
			>Assignment<select bind:value={assignmentId}
				>{#each assignments.entries as entry (entry.id)}<option value={entry.id}
						>{entry.game.name} / {entry.map?.name ?? 'All maps'} / {entry.category.name} · #{entry.id}</option
					>{/each}</select
			></label
		>
		{#if assignment}{#key assignmentId}<form method="POST" action="?/updateAssignment">
					<input type="hidden" name="id" value={assignment.id} />
					<div class="context">
						<strong>{assignment.category.name}</strong><span
							>{assignment.game.name} · {assignment.map?.name ?? 'Every map'}</span
						>
					</div>
					<label
						>Specific rules JSON<textarea name="specificRules"
							>{JSON.stringify(assignment.specificRules, null, 2)}</textarea
						></label
					>
					<button>Save ruleset →</button>
				</form>
				<form class="danger-zone" method="POST" action="?/deleteAssignment">
					<input type="hidden" name="id" value={assignment.id} />
					<label>Type DELETE to confirm<input name="confirmation" autocomplete="off" /></label>
					<button class="danger">Delete unused assignment</button>
				</form>{/key}{:else}<p class="empty">No assignment on this page.</p>{/if}
		{#if assignments.page > 0 || assignments.hasMore}<nav
				class="pager"
				aria-label="Assignment pages"
			>
				{#if assignments.page > 0}<a
						href={resolve(`/admin/catalog?assignmentPage=${assignments.page - 1}`)}>← Previous</a
					>{/if}
				<span>Page {assignments.page + 1}</span>
				{#if assignments.hasMore}<a
						href={resolve(`/admin/catalog?assignmentPage=${assignments.page + 1}`)}>Next →</a
					>{/if}
			</nav>{/if}
	</section>
</div>

<style>
	.catalog-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		max-width: 76rem;
	}
	section {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	section > header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 1rem;
		border-bottom: 1px solid var(--line);
	}
	header span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	header div {
		display: grid;
		gap: 0.15rem;
	}
	header small {
		color: var(--muted);
		font-size: 0.48rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-style: italic;
		text-transform: uppercase;
	}
	form {
		display: grid;
		gap: 1rem;
		padding: 1.2rem;
	}
	.picker {
		padding: 1.2rem 1.2rem 0;
	}
	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}
	label {
		display: grid;
		gap: 0.45rem;
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	input,
	select,
	textarea {
		width: 100%;
		min-height: 3rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--line-strong);
		border-radius: 0;
		background: var(--canvas-soft);
		color: var(--ink);
	}
	textarea {
		min-height: 7rem;
		font-family: monospace;
		resize: vertical;
	}
	.check {
		display: flex;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.65rem;
	}
	.check input {
		width: 1rem;
		min-height: 1rem;
		accent-color: var(--signal);
	}
	button {
		min-height: 3rem;
		padding: 0.65rem 1rem;
		border: 0;
		background: var(--signal);
		color: white;
		font-size: 0.6rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	button.danger {
		background: #8e2929;
	}
	.compact {
		padding-top: 0;
	}
	.danger-zone {
		margin: 0 1.2rem 1.2rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, #d94141 45%, var(--line));
		background: color-mix(in srgb, #d94141 5%, transparent);
	}
	.context {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem;
		border: 1px solid var(--line);
		background: var(--canvas-soft);
	}
	.context strong {
		font-size: 0.72rem;
	}
	.context span {
		color: var(--muted);
		font-size: 0.58rem;
		text-align: right;
	}
	.empty {
		padding: 1.2rem;
		color: var(--muted);
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 1rem 1.2rem;
		border-top: 1px solid var(--line);
		font-size: 0.58rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.pager a {
		color: var(--signal);
		text-decoration: none;
	}
	.pager span {
		color: var(--muted);
	}
	@media (max-width: 800px) {
		.catalog-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 550px) {
		.split {
			grid-template-columns: 1fr;
		}
		.context {
			flex-direction: column;
		}
		.context span {
			text-align: left;
		}
	}
</style>
