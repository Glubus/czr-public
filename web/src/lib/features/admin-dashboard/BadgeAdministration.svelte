<script lang="ts">
	import ActionButton from '$lib/components/atoms/ActionButton.svelte';
	import Badge from '$lib/components/atoms/Badge.svelte';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import PlayerSearchSelect from '$lib/components/PlayerSearchSelect.svelte';
	import SearchSelect from '$lib/components/SearchSelect.svelte';
	import type { PlayerBadge } from '$lib/types';

	let { badges }: { badges: PlayerBadge[] } = $props();
	let selectedBadge = $state('');
	const badgeOptions = $derived(
		badges.map((badge) => ({
			value: String(badge.id),
			label: badge.name,
			meta: badge.system ? 'System badge' : 'Community badge'
		}))
	);
</script>

<details class="badge-tools">
	<summary>
		<div>
			<Eyebrow>Identity & trust</Eyebrow>
			<h2>Badge administration</h2>
		</div>
		<span><Badge>{badges.length} badges</Badge><b>Open tools</b><i>⌄</i></span>
	</summary>
	<div class="workspace">
		<section>
			<header>
				<span>01</span>
				<div>
					<strong>Assign a badge</strong><small>Search the complete player directory</small>
				</div>
			</header>
			<form method="POST" action="?/setBadge">
				<PlayerSearchSelect
					label="Player"
					name="userId"
					placeholder="Search any player profile…"
					hint="Results come from the live player directory."
					resultSuffix="Player profile"
					selectedSuffix="Managing player"
				/>
				<SearchSelect
					label="Badge"
					items={badgeOptions}
					value={selectedBadge}
					name="badgeId"
					placeholder={badges.length ? 'Choose a badge' : 'Create a badge first'}
					searchPlaceholder="Badge name…"
					disabled={!badges.length}
					required
					onselect={(value) => (selectedBadge = value)}
				/>
				<div class="actions">
					<ActionButton name="operation" value="assign" size="compact" full={false} arrow={false}
						>Assign</ActionButton
					>
					<ActionButton
						name="operation"
						value="remove"
						variant="secondary"
						size="compact"
						full={false}
						arrow={false}>Remove</ActionButton
					>
				</div>
			</form>
		</section>

		<section>
			<header>
				<span>02</span>
				<div>
					<strong>Create a badge</strong><small>Add a reusable community distinction</small>
				</div>
			</header>
			<form method="POST" action="?/createBadge" class="create-form">
				<label>Name<input name="name" required maxlength="60" placeholder="Map Nominator" /></label>
				<label
					>Slug<input
						name="slug"
						required
						pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
						placeholder="map-nominator"
					/></label
				>
				<label class="wide"
					>Description<input
						name="description"
						maxlength="240"
						placeholder="Why this badge is awarded"
					/></label
				>
				<label class="color">Color<input name="color" type="color" value="#e45735" /></label>
				<div class="create-action"><ActionButton>Create badge</ActionButton></div>
			</form>
		</section>
	</div>
</details>

<style>
	.badge-tools {
		border: 1px solid var(--line);
		background: var(--panel);
	}
	summary {
		display: flex;
		min-height: 5rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.2rem;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		background: var(--panel-hover);
	}
	h2 {
		margin: 0.25rem 0 0;
		font: italic 1.35rem var(--font-display);
		text-transform: uppercase;
	}
	summary > span {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	summary > span > b {
		color: var(--muted);
		font-size: 0.58rem;
		text-transform: uppercase;
	}
	summary i {
		color: var(--signal);
		font-style: normal;
		transition: transform 160ms ease;
	}
	details[open] summary {
		border-bottom: 1px solid var(--line);
	}
	details[open] summary i {
		transform: rotate(180deg);
	}
	.workspace {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.workspace > section + section {
		border-left: 1px solid var(--line);
	}
	section > header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--line);
		background: var(--canvas-soft);
	}
	section > header > span {
		color: var(--signal);
		font: 0.6rem monospace;
	}
	section > header > div {
		display: grid;
		gap: 0.1rem;
	}
	section > header strong {
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	section > header small {
		color: var(--muted);
		font-size: 0.56rem;
	}
	form {
		display: grid;
		gap: 0.8rem;
		padding: 1rem;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.create-form {
		grid-template-columns: 1fr 1fr;
	}
	label {
		display: grid;
		gap: 0.4rem;
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	input {
		width: 100%;
		min-width: 0;
		height: 3.35rem;
		padding: 0 0.8rem;
		border: 1px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--ink);
	}
	input:focus {
		border-color: var(--signal);
		outline: 0;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.color input {
		padding: 0.45rem;
	}
	.create-action {
		align-self: end;
	}
	@media (max-width: 850px) {
		.workspace {
			grid-template-columns: 1fr;
		}
		.workspace > section + section {
			border-top: 1px solid var(--line);
			border-left: 0;
		}
	}
	@media (max-width: 550px) {
		summary > span > b {
			display: none;
		}
		.create-form {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
	}
</style>
