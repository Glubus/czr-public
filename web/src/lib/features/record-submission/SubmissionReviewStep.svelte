<script lang="ts">
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import type { Player } from '$lib/types';
	import type { SelectedEntry } from './contracts';

	let {
		gameName,
		mapName,
		playerCount,
		proofUrl,
		entries,
		teammates,
		categoryLabel,
		back
	}: {
		gameName?: string;
		mapName?: string;
		playerCount: number;
		proofUrl: string;
		entries: SelectedEntry[];
		teammates: Player[];
		categoryLabel: (entry: NonNullable<SelectedEntry['category']>) => string;
		back: () => void;
	} = $props();
</script>

<section class="panel">
	<header>
		<span>03</span>
		<div>
			<h2>Review submission</h2>
			<p>Confirm the exact board and evidence before sending.</p>
		</div>
	</header>
	<div class="board">
		<div><small>Game</small><strong>{gameName}</strong></div>
		<div><small>Map</small><strong>{mapName}</strong></div>
		<div><small>Team</small><strong>{playerCount}P</strong></div>
		<div>
			<small>Proof</small><!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
				href={proofUrl}
				target="_blank"
				rel="noreferrer">Open video ↗</a
			>
		</div>
	</div>
	<div class="records">
		{#each entries as entry (entry.assignmentId)}<article>
				<div>
					<small>Category</small>
					<h3>{entry.category ? categoryLabel(entry.category) : 'Category'}</h3>
				</div>
				<div>
					<small>{entry.category?.scoreType === 'time' ? 'Time' : 'Score'}</small><strong
						>{entry.category?.scoreType === 'time' ? entry.duration : entry.score}</strong
					>
				</div>
				{#if entry.duration && entry.category?.scoreType !== 'time'}<div>
						<small>Duration</small><strong>{entry.duration}</strong>
					</div>{/if}
			</article>{/each}
	</div>
	{#if teammates.length}<div class="team">
			<small>Teammates</small>{#each teammates as player (player.id)}<div>
					<PlayerAvatar name={player.name} image={player.image} size="small" /><strong
						>{player.name}</strong
					><span>Confirmation required</span>
				</div>{/each}
		</div>{/if}
	<p class="note">
		By submitting, you confirm that the score, team, ruleset, and proof are accurate. A moderator
		may reject incomplete or misleading evidence.
	</p>
	<footer>
		<button type="button" onclick={back}>← Edit run</button><button type="submit" class="primary"
			>Submit record →</button
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
	small,
	.note {
		color: var(--muted);
		font-size: 0.7rem;
	}
	.board {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-top: 1.5rem;
		border: 1px solid var(--line);
	}
	.board > div {
		display: grid;
		gap: 0.3rem;
		padding: 1rem;
		border-right: 1px solid var(--line);
	}
	a {
		color: var(--signal);
	}
	.records,
	.team {
		display: grid;
		gap: 0.6rem;
		margin-top: 1rem;
	}
	article {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--line);
	}
	article > div {
		display: grid;
	}
	h3 {
		margin: 0.2rem 0;
	}
	.team > div {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem;
		border: 1px solid var(--line);
	}
	.note {
		padding: 1rem;
		border-left: 2px solid var(--signal);
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
	@media (max-width: 700px) {
		.board {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
