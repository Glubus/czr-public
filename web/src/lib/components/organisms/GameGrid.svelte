<script lang="ts">
	import { resolve } from '$app/paths';
	import CollapsiblePanel from '$lib/components/molecules/CollapsiblePanel.svelte';
	import CollapsibleSubsection from '$lib/components/molecules/CollapsibleSubsection.svelte';
	import type { Game } from '$lib/types';

	let { games }: { games: Game[] } = $props();

	function studioGroups(source: Game[]) {
		return ['Treyarch', 'Non-Treyarch']
			.map((studio) => ({
				studio,
				games: source
					.filter((game) => (game.studio === 'Treyarch') === (studio === 'Treyarch'))
					.sort(
						(left, right) =>
							(left.releaseYear ?? Number.MAX_SAFE_INTEGER) -
								(right.releaseYear ?? Number.MAX_SAFE_INTEGER) ||
							left.name.localeCompare(right.name)
					)
			}))
			.filter((group) => group.games.length > 0);
	}

	let groups = $derived(
		[
			{
				id: 'zombies-games',
				title: 'ZOMBIES GAMES',
				eyebrow: 'Round-based and Zombies modes',
				games: games.filter((game) => game.gameType === 'zombies')
			},
			{
				id: 'non-zombies-games',
				title: 'NON-ZOMBIES GAMES',
				eyebrow: 'Extinction, survival and other modes',
				games: games.filter((game) => game.gameType === 'non_zombies')
			}
		].map((group) => ({ ...group, studios: studioGroups(group.games) }))
	);

	function subsectionId(groupId: string, studio: string) {
		return `${groupId}-${studio.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
	}
</script>

<div class="groups">
	{#each groups as group (group.id)}
		{#if group.games.length}
			<CollapsiblePanel
				id={group.id}
				title={group.title}
				eyebrow={group.eyebrow}
				count={group.games.length}
			>
				{#each group.studios as studioGroup (studioGroup.studio)}
					<CollapsibleSubsection
						id={subsectionId(group.id, studioGroup.studio)}
						title={studioGroup.studio}
						count={studioGroup.games.length}
					>
						<ul>
							{#each studioGroup.games as game, index (game.id)}
								<li>
									<a href={resolve('/games/[slug]', { slug: game.slug })}>
										<span>{String(index + 1).padStart(2, '0')}</span>
										<div>
											<small>{game.shortName}</small><strong>{game.name}</strong>
											<em>{studioGroup.studio}</em>
										</div>
										<time>{game.releaseYear ?? '-'}</time><b>→</b>
									</a>
								</li>
							{/each}
						</ul>
					</CollapsibleSubsection>
				{/each}
			</CollapsiblePanel>
		{/if}
	{/each}
	{#if !games.length}<p>No games available.</p>{/if}
</div>

<style>
	.groups {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}
	ul {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		border-bottom: 1px solid var(--line);
		border-right: 1px solid var(--line);
	}
	li:nth-child(3n) {
		border-right: 0;
	}
	li a {
		display: grid;
		min-height: 7rem;
		grid-template-columns: 3rem 1fr auto 2rem;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.4rem;
		color: var(--ink);
		text-decoration: none;
	}
	li a:hover {
		background: var(--panel-hover);
	}
	li > a > span,
	li small,
	time {
		color: var(--muted);
		font-family: monospace;
		font-size: 0.6rem;
	}
	li div {
		display: grid;
		min-width: 0;
		gap: 0.3rem;
	}
	li small {
		color: var(--signal);
		font-weight: 900;
		letter-spacing: 0.1em;
	}
	li strong {
		font-family: var(--font-display);
		font-size: clamp(1.1rem, 2vw, 1.65rem);
	}
	li em {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.62rem;
		font-style: normal;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	li b {
		color: var(--signal);
	}
	.groups > p {
		margin: 0;
		padding: 5rem;
		border: 1px solid var(--line);
		color: var(--muted);
		text-align: center;
	}
	@media (max-width: 1050px) {
		ul {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		li:nth-child(3n) {
			border-right: 1px solid var(--line);
		}
		li:nth-child(2n) {
			border-right: 0;
		}
	}
	@media (max-width: 650px) {
		ul {
			grid-template-columns: 1fr;
		}
		li,
		li:nth-child(3n) {
			border-right: 0;
		}
	}
</style>
