<script lang="ts">
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import SearchSelect from '$lib/components/SearchSelect.svelte';
	import type { SelectItem } from '$lib/components/search-select';
	import type { Player } from '$lib/types';
	import type { SelectedEntry } from './contracts';

	let {
		entries,
		playerCount,
		teammateQuery = $bindable(),
		teammateResults,
		teammates,
		loadingPlayers,
		proofUrl = $bindable(),
		platform = $bindable(),
		gameVersion = $bindable(),
		mapVersion = $bindable(),
		modId,
		modVersion = $bindable(),
		modOptions,
		runReady,
		categoryLabel,
		updateEntry,
		setPlayerCount,
		addTeammate,
		removeTeammate,
		selectMod,
		back,
		advance
	}: {
		entries: SelectedEntry[];
		playerCount: number;
		teammateQuery: string;
		teammateResults: Player[];
		teammates: Player[];
		loadingPlayers: boolean;
		proofUrl: string;
		platform: string;
		gameVersion: string;
		mapVersion: string;
		modId: string;
		modVersion: string;
		modOptions: SelectItem[];
		runReady: boolean;
		categoryLabel: (entry: NonNullable<SelectedEntry['category']>) => string;
		updateEntry: (assignmentId: number, field: 'score' | 'duration', value: string) => void;
		setPlayerCount: (count: number) => void;
		addTeammate: (player: Player) => void;
		removeTeammate: (id: string) => void;
		selectMod: (value: string) => void;
		back: () => void;
		advance: () => void;
	} = $props();
</script>

<section class="panel">
	<header>
		<span>02</span>
		<div>
			<h2>Describe the run</h2>
			<p>Scores are stored separately for every selected category.</p>
		</div>
	</header>
	<div class="scores">
		{#each entries as entry (entry.assignmentId)}
			<div class="score">
				<div>
					<strong>{entry.category ? categoryLabel(entry.category) : 'Category'}</strong><small
						>{entry.category?.scoreType === 'time' ? 'Fastest time' : 'Final score'}</small
					>
				</div>
				{#if entry.category?.scoreType !== 'time'}<label
						>Score<input
							type="number"
							min="1"
							inputmode="numeric"
							value={entry.score}
							oninput={(event) =>
								updateEntry(entry.assignmentId, 'score', event.currentTarget.value)}
							placeholder={entry.category?.scoreType === 'round' ? 'Round' : 'Score'}
						/></label
					>{/if}
				<label
					>Duration<input
						type="text"
						inputmode="numeric"
						value={entry.duration}
						oninput={(event) =>
							updateEntry(entry.assignmentId, 'duration', event.currentTarget.value)}
						placeholder="HH:MM:SS"
					/></label
				>
			</div>
		{/each}
	</div>
	<div class="players">
		<span>Player count</span>
		<div>
			{#each [1, 2, 3, 4] as count (count)}<button
					type="button"
					class:active={playerCount === count}
					onclick={() => setPlayerCount(count)}>{count}P</button
				>{/each}
		</div>
	</div>
	{#if playerCount > 1}
		<div class="teammates">
			<label
				>Teammates <small>{teammates.length}/{playerCount - 1} selected</small><input
					type="search"
					bind:value={teammateQuery}
					placeholder="Search registered players…"
					autocomplete="off"
					disabled={teammates.length >= playerCount - 1}
				/></label
			>
			{#if teammateResults.length}<div class="results">
					{#each teammateResults as player (player.id)}<button
							type="button"
							onclick={() => addTeammate(player)}
							><PlayerAvatar name={player.name} image={player.image} size="small" /><span
								>{player.name}</span
							><b>+</b></button
						>{/each}
				</div>{:else if loadingPlayers}<p>Searching…</p>{/if}
			{#if teammates.length}<div class="selected">
					{#each teammates as player (player.id)}<div>
							<PlayerAvatar name={player.name} image={player.image} size="small" /><strong
								>{player.name}</strong
							><button
								type="button"
								aria-label={`Remove ${player.name}`}
								onclick={() => removeTeammate(player.id)}>×</button
							>
						</div>{/each}
				</div>{/if}
		</div>
	{/if}
	<div class="fields">
		<label class="wide"
			>Video proof<input
				type="url"
				bind:value={proofUrl}
				placeholder="https://youtube.com/watch?v=…"
				required
			/></label
		>
		<label>Platform<input bind:value={platform} placeholder="PC, PlayStation, Xbox…" /></label
		><label>Game version<input bind:value={gameVersion} placeholder="Optional" /></label><label
			>Map version<input bind:value={mapVersion} placeholder="Optional" /></label
		>
		<SearchSelect
			testId="submit-mod-select"
			label="Mod"
			items={modOptions}
			value={modId}
			placeholder="No mod"
			searchPlaceholder="Search mods…"
			emptyText="No mods found"
			onselect={selectMod}
		/>
		{#if modId}<label>Mod version<input bind:value={modVersion} placeholder="Optional" /></label
			>{/if}
	</div>
	<footer>
		<button type="button" onclick={back}>← Back</button><button
			type="button"
			class="primary"
			disabled={!runReady}
			onclick={advance}>Review →</button
		>
	</footer>
</section>

<style>
	.panel {
		padding: clamp(1.25rem, 3vw, 2.5rem);
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		gap: 1rem;
		padding-bottom: 1.6rem;
		border-bottom: 1px solid var(--line);
	}
	header > span {
		color: var(--signal);
		font: 0.65rem monospace;
	}
	h2 {
		margin: 0;
		font: italic 2rem var(--font-display);
		text-transform: uppercase;
	}
	header p,
	.teammates p {
		color: var(--muted);
		font-size: 0.7rem;
	}
	.scores,
	.teammates,
	.selected {
		display: grid;
		gap: 0.6rem;
		margin-top: 1.5rem;
	}
	.score {
		display: grid;
		grid-template-columns: 1fr repeat(2, minmax(9rem, 0.35fr));
		align-items: end;
		gap: 0.8rem;
		padding: 0.8rem;
		border: 1px solid var(--line);
	}
	.score > div {
		display: grid;
	}
	label {
		display: grid;
		gap: 0.5rem;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	input {
		width: 100%;
		height: 3.35rem;
		padding: 0 1rem;
		border: 1px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--ink);
	}
	.players {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1rem;
	}
	.players button.active {
		border-color: var(--signal);
		color: var(--signal);
	}
	.results {
		display: grid;
		border: 1px solid var(--line);
	}
	.results button {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		text-align: left;
	}
	.selected {
		grid-template-columns: repeat(3, 1fr);
	}
	.selected > div {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid var(--line);
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1.5rem;
	}
	.wide {
		grid-column: 1 / -1;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.8rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--line);
	}
	button {
		border: 1px solid var(--line);
		background: transparent;
		color: var(--ink);
		padding: 0.75rem 1rem;
		cursor: pointer;
	}
	.primary {
		background: var(--signal);
		color: #101311;
		font-weight: 900;
	}
	button:disabled {
		opacity: 0.35;
	}
	@media (max-width: 760px) {
		.score,
		.fields,
		.selected {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
	}
</style>
