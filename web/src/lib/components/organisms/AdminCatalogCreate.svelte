<script lang="ts">
	import type { CategoryDefinition, Game, MapResult } from '$lib/types';

	let {
		games,
		maps,
		categories
	}: { games: Game[]; maps: MapResult[]; categories: CategoryDefinition[] } = $props();
	let assignmentGameId = $state('');
	let assignmentMaps = $derived(
		maps.filter((map) => assignmentGameId === '' || map.gameId === Number(assignmentGameId))
	);
</script>

<div class="catalog-grid">
	<section>
		<header>
			<span>01</span>
			<h2>New game</h2>
		</header>
		<form method="POST" action="?/game">
			<label>Name<input name="name" required /></label>
			<div class="split">
				<label>Studio<input name="studio" required /></label>
				<label
					>Type<select name="gameType"
						><option value="zombies">Zombies</option><option value="non_zombies">Non-Zombies</option
						></select
					></label
				>
			</div>
			<div class="split">
				<label>Short name<input name="shortName" required /></label>
				<label>Release year<input name="releaseYear" type="number" min="1980" max="2100" /></label>
			</div>
			<label>Slug<input name="slug" pattern="[a-z0-9-]+" required /></label>
			<button>Create game →</button>
		</form>
	</section>

	<section>
		<header>
			<span>02</span>
			<h2>New map</h2>
		</header>
		<form method="POST" action="?/map">
			<label
				>Game<select name="gameId" required
					><option value="">Choose game</option>{#each games as game (game.id)}<option
							value={game.id}>{game.name}</option
						>{/each}</select
				></label
			>
			<label>Name<input name="name" required /></label>
			<label>Slug<input name="slug" pattern="[a-z0-9-]+" required /></label>
			<label>Authors <small>Comma separated</small><input name="authors" /></label>
			<div class="split">
				<label
					>Type<select name="type"
						><option value="official">Official</option><option value="custom">Community</option
						><option value="uem">UEM</option></select
					></label
				>
				<label
					>Status<select name="status"
						><option value="draft">Draft</option><option value="published">Published</option
						></select
					></label
				>
			</div>
			<button>Create map →</button>
		</form>
	</section>

	<section>
		<header>
			<span>03</span>
			<h2>New category</h2>
		</header>
		<form method="POST" action="?/category">
			<label>Name<input name="name" required /></label>
			<label>Slug<input name="slug" pattern="[a-z0-9-]+" required /></label>
			<div class="split">
				<label
					>Score type<select name="scoreType"
						><option value="round">Round</option><option value="time">Time</option><option
							value="kills">Kills</option
						><option value="points">Points</option><option value="custom">Custom</option></select
					></label
				>
				<label
					>Direction<select name="rankingDirection"
						><option value="higher_is_better">Higher is better</option><option
							value="lower_is_better">Lower is better</option
						></select
					></label
				>
			</div>
			<label>Global rules JSON<textarea name="rules">{`{}`}</textarea></label>
			<button>Create category →</button>
		</form>
	</section>

	<section>
		<header>
			<span>04</span>
			<h2>Assign ruleset</h2>
		</header>
		<form method="POST" action="?/assignment">
			<label
				>Category<select name="categoryId" required
					><option value="">Choose category</option
					>{#each categories as category (category.id)}<option value={category.id}
							>{category.name}</option
						>{/each}</select
				></label
			>
			<label
				>Game<select name="gameId" bind:value={assignmentGameId} required
					><option value="">Choose game</option>{#each games as game (game.id)}<option
							value={game.id}>{game.name}</option
						>{/each}</select
				></label
			>
			<label
				>Map <small>Leave empty to apply to every map</small><select
					name="mapId"
					disabled={!assignmentGameId}
					><option value="">Every map in this game</option
					>{#each assignmentMaps as map (map.id)}<option value={map.id}>{map.name}</option
						>{/each}</select
				></label
			>
			<label>Specific rules JSON<textarea name="specificRules">{`{}`}</textarea></label>
			<button>Create assignment →</button>
		</form>
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
	label small {
		font-size: 0.5rem;
		font-weight: 500;
		text-transform: none;
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
		min-height: 6rem;
		font-family: monospace;
		resize: vertical;
	}
	button {
		min-height: 3rem;
		border: 0;
		background: var(--signal);
		color: white;
		font-size: 0.6rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	select:disabled {
		opacity: 0.55;
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
	}
</style>
