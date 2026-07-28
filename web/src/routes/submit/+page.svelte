<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import { categoryVariantLabel } from '$lib/display';
	import {
		loadGameMaps,
		loadGameMods,
		loadMapCategories,
		searchCatalogPlayers,
		type SubmissionMap
	} from '$lib/features/record-submission/catalog-client';
	import type { EntryDraft } from '$lib/features/record-submission/contracts';
	import { isHttpProofUrl, parseRunDuration } from '$lib/features/record-submission/form-values';
	import SubmissionBoardStep from '$lib/features/record-submission/SubmissionBoardStep.svelte';
	import SubmissionReviewStep from '$lib/features/record-submission/SubmissionReviewStep.svelte';
	import SubmissionRunStep from '$lib/features/record-submission/SubmissionRunStep.svelte';
	import type { CategoryForMap, GameMod, Player } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let step = $state(1);
	let gameId = $state('');
	let mapId = $state('');
	let maps = $state<SubmissionMap[]>([]);
	let categories = $state<CategoryForMap[]>([]);
	let mods = $state<GameMod[]>([]);
	let modId = $state('');
	let playerCount = $state(1);
	let entries = $state<EntryDraft[]>([]);
	let proofUrl = $state('');
	let platform = $state('');
	let gameVersion = $state('');
	let mapVersion = $state('');
	let modVersion = $state('');
	let teammateQuery = $state('');
	let teammateResults = $state<Player[]>([]);
	let teammates = $state<Player[]>([]);
	let loadingMaps = $state(false);
	let loadingCategories = $state(false);
	let loadingPlayers = $state(false);
	let catalogError = $state('');

	let game = $derived(data.games.find((entry) => String(entry.id) === gameId));
	let map = $derived(maps.find((entry) => String(entry.id) === mapId));
	let gameOptions = $derived(
		data.games.map((entry) => ({
			value: String(entry.id),
			label: entry.name,
			meta: [entry.shortName, entry.studio, entry.releaseYear].filter(Boolean).join(' · '),
			keywords: `${entry.slug} ${entry.gameType}`
		}))
	);
	let mapOptions = $derived(
		maps
			.map((entry) => {
				const mapType =
					entry.type === 'uem' ? 'UEM' : entry.type === 'custom' ? 'Community' : 'Official';
				const contentType = entry.contentType === 'zombies' ? 'Zombies' : 'Non-Zombies';
				const group = entry.mode ?? `${contentType} · ${mapType}`;
				return {
					value: String(entry.id),
					label: entry.name,
					meta: group,
					group,
					keywords: `${entry.slug} ${entry.type} ${entry.mode ?? ''}`,
					tags: [
						entry.type === 'custom' ? 'community' : entry.type,
						entry.contentType === 'zombies' ? 'zombie' : 'non-zombie',
						...(entry.mode ? [entry.mode.toLocaleLowerCase().replaceAll(' ', '-')] : [])
					]
				};
			})
			.sort(
				(left, right) =>
					left.group.localeCompare(right.group) || left.label.localeCompare(right.label)
			)
	);
	let modOptions = $derived([
		{ value: '', label: 'No mod', meta: 'Base game' },
		...mods.map((entry) => ({
			value: String(entry.id),
			label: entry.name,
			meta: 'Game mod',
			keywords: entry.slug
		}))
	]);
	let selectedEntries = $derived(
		entries.map((entry) => ({
			...entry,
			category: categories.find((category) => category.assignmentId === entry.assignmentId)
		}))
	);
	let entryPayload = $derived(
		JSON.stringify(
			selectedEntries.map(({ assignmentId, score, duration, category }) => {
				const durationMs = parseRunDuration(duration);
				return {
					categoryAssignmentId: assignmentId,
					scoreValue: category?.scoreType === 'time' ? (durationMs ?? 0) : Number(score),
					runDurationMs: durationMs
				};
			})
		)
	);
	let teammatePayload = $derived(JSON.stringify(teammates.map((entry) => entry.id)));
	let boardReady = $derived(Boolean(game && map && entries.length > 0 && entries.length <= 5));
	let runReady = $derived(
		selectedEntries.every(({ score, duration, category }) =>
			category?.scoreType === 'time' ? parseRunDuration(duration) !== null : Number(score) > 0
		) &&
			isHttpProofUrl(proofUrl) &&
			teammates.length === playerCount - 1
	);

	$effect(() => {
		const query = teammateQuery.trim();
		if (query.length < 2) {
			teammateResults = [];
			loadingPlayers = false;
			return;
		}
		loadingPlayers = true;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const result = await searchCatalogPlayers(fetch, query, controller.signal);
				teammateResults = result.entries.filter(
					(candidate) =>
						candidate.id !== data.user?.id && !teammates.some((entry) => entry.id === candidate.id)
				);
			} catch (error) {
				if ((error as Error).name !== 'AbortError') teammateResults = [];
			} finally {
				if (!controller.signal.aborted) loadingPlayers = false;
			}
		}, 220);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	async function chooseGame(value: string) {
		gameId = value;
		mapId = '';
		maps = [];
		categories = [];
		entries = [];
		mods = [];
		modId = '';
		if (!game) return;
		loadingMaps = true;
		catalogError = '';
		try {
			const [mapResult, modResult] = await Promise.all([
				loadGameMaps(fetch, game.slug),
				loadGameMods(fetch, game.slug)
			]);
			maps = mapResult.entries;
			mods = modResult.entries;
			if (mapResult.unavailable) catalogError = 'Maps are temporarily unavailable.';
		} catch {
			catalogError = 'Maps are temporarily unavailable.';
		} finally {
			loadingMaps = false;
		}
	}

	async function chooseMap(value: string) {
		mapId = value;
		categories = [];
		entries = [];
		if (!value) return;
		loadingCategories = true;
		catalogError = '';
		try {
			const result = await loadMapCategories(fetch, value);
			categories = result.entries;
			if (result.unavailable) catalogError = 'Categories are temporarily unavailable.';
		} catch {
			catalogError = 'Categories are temporarily unavailable.';
		} finally {
			loadingCategories = false;
		}
	}

	function toggleCategory(category: CategoryForMap) {
		if (entries.some((entry) => entry.assignmentId === category.assignmentId)) {
			entries = entries.filter((entry) => entry.assignmentId !== category.assignmentId);
		} else if (entries.length < 5) {
			entries = [...entries, { assignmentId: category.assignmentId, score: '', duration: '' }];
		}
	}
	function updateEntry(assignmentId: number, field: 'score' | 'duration', value: string) {
		entries = entries.map((entry) =>
			entry.assignmentId === assignmentId ? { ...entry, [field]: value } : entry
		);
	}
	function setPlayerCount(count: number) {
		playerCount = count;
		teammates = teammates.slice(0, count - 1);
	}
	function addTeammate(player: Player) {
		if (teammates.length >= playerCount - 1) return;
		teammates = [...teammates, player];
		teammateQuery = '';
		teammateResults = [];
	}
	function categoryLabel(category: CategoryForMap) {
		const ruleset = categoryVariantLabel(category.specificRules);
		return ruleset ? `${category.name} - ${ruleset}` : category.name;
	}
</script>

<svelte:head
	><title>Submit a record - Zombies Records</title><meta
		name="description"
		content="Submit a Zombies record with its category, score, teammates, and video proof."
	/></svelte:head
>

<main>
	<header class="hero">
		<div>
			<span>Verified competition</span>
			<h1>SUBMIT A RECORD.</h1>
			<p>One run, up to five categories. Your teammates confirm before moderation begins.</p>
		</div>
		<ol aria-label="Submission progress">
			{#each ['Board', 'Run', 'Review'] as label, index (label)}<li
					class:active={step === index + 1}
					class:done={step > index + 1}
				>
					<span>{String(index + 1).padStart(2, '0')}</span>{label}
				</li>{/each}
		</ol>
	</header>
	{#if form?.success}
		<section class="success">
			<b>✓</b><span>Submission received</span>
			<h2>Your run is in the queue.</h2>
			<p>
				{form.result.submissions.length}
				{form.result.submissions.length === 1 ? 'record' : 'records'} created. Teammates must accept before
				the run can be reviewed.
			</p>
			<div>
				<a class="primary" href={resolve('/me')}>Track submission</a><a href={resolve('/submit')}
					>Submit another run</a
				>
			</div>
		</section>
	{:else}
		{#if data.apiUnavailable}<FormAlert message="Games are temporarily unavailable." />{/if}
		{#if form?.message}<FormAlert message={form.message} />{/if}
		{#if catalogError}<FormAlert message={catalogError} />{/if}
		<form method="POST">
			<input type="hidden" name="gameId" value={gameId} /><input
				type="hidden"
				name="mapId"
				value={mapId}
			/><input type="hidden" name="entries" value={entryPayload} /><input
				type="hidden"
				name="teammateIds"
				value={teammatePayload}
			/><input type="hidden" name="proofUrl" value={proofUrl} /><input
				type="hidden"
				name="platform"
				value={platform}
			/><input type="hidden" name="gameVersion" value={gameVersion} /><input
				type="hidden"
				name="mapVersion"
				value={mapVersion}
			/><input type="hidden" name="modId" value={modId} /><input
				type="hidden"
				name="modVersion"
				value={modVersion}
			/>
			{#if step === 1}<SubmissionBoardStep
					{gameOptions}
					{mapOptions}
					{gameId}
					{mapId}
					{categories}
					{entries}
					{loadingMaps}
					{loadingCategories}
					{boardReady}
					{chooseGame}
					{chooseMap}
					{toggleCategory}
					advance={() => (step = 2)}
				/>
			{:else if step === 2}<SubmissionRunStep
					entries={selectedEntries}
					{playerCount}
					bind:teammateQuery
					{teammateResults}
					{teammates}
					{loadingPlayers}
					bind:proofUrl
					bind:platform
					bind:gameVersion
					bind:mapVersion
					{modId}
					bind:modVersion
					{modOptions}
					{runReady}
					{categoryLabel}
					{updateEntry}
					{setPlayerCount}
					{addTeammate}
					removeTeammate={(id) => (teammates = teammates.filter((entry) => entry.id !== id))}
					selectMod={(value) => (modId = value)}
					back={() => (step = 1)}
					advance={() => (step = 3)}
				/>
			{:else}<SubmissionReviewStep
					gameName={game?.name}
					mapName={map?.name}
					{playerCount}
					{proofUrl}
					entries={selectedEntries}
					{teammates}
					{categoryLabel}
					back={() => (step = 2)}
				/>{/if}
		</form>
	{/if}
</main>

<style>
	main {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 3rem;
		align-items: end;
		max-width: 76rem;
		margin-bottom: 2rem;
	}
	.hero > div > span,
	.success > span {
		color: var(--signal);
		font: 900 0.62rem monospace;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.65rem 0 0.4rem;
		font: italic clamp(3rem, 7vw, 6.5rem)/0.86 var(--font-display);
	}
	.hero p {
		max-width: 40rem;
		color: var(--muted);
	}
	ol {
		display: flex;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		min-width: 6.2rem;
		gap: 0.35rem;
		padding: 0.8rem 1rem;
		border: 1px solid var(--line);
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	li + li {
		border-left: 0;
	}
	li.active {
		border-color: var(--signal);
		color: var(--ink);
	}
	li.done,
	li.active span {
		color: var(--signal);
	}
	form,
	.success {
		max-width: 76rem;
	}
	form > input[type='hidden'] {
		display: none;
	}
	.success {
		padding: 2rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.success > b {
		font-size: 2rem;
		color: var(--signal);
	}
	.success h2 {
		font-family: var(--font-display);
	}
	.success div {
		display: flex;
		gap: 0.7rem;
	}
	.success a {
		border: 1px solid var(--line);
		color: inherit;
		padding: 0.8rem;
		text-decoration: none;
	}
	.success a.primary {
		background: var(--signal);
		color: #101311;
	}
	@media (max-width: 760px) {
		.hero {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		ol {
			overflow-x: auto;
		}
	}
</style>
