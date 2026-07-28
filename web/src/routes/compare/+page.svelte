<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import PlayerComparePicker from '$lib/components/organisms/PlayerComparePicker.svelte';
	import type { PageData } from './$types';
	import { formatRecordScore } from '$lib/display';

	let { data }: { data: PageData } = $props();

	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	function score(value: { scoreValue: number; runDurationMs: number | null }, type: string) {
		return formatRecordScore(value.scoreValue, type, value.runDurationMs);
	}
</script>

<svelte:head><title>Player comparison - Zombies Records</title></svelte:head>
<div class="compare-page">
	<a class="back" href={resolve('/leaderboard')}>← Leaderboards</a>
	<header>
		<span>Head to head</span>
		<h1>COMPARE PLAYERS</h1>
		<p>See exact shared boards, wins, records, and PP side by side.</p>
	</header>
	{#if data.apiUnavailable}<FormAlert message="Comparison data is temporarily unavailable." />{/if}
	<section class="pickers">
		<PlayerComparePicker
			label="Player one"
			param="player1"
			selected={data.leftPlayer}
			otherId={data.player2}
		/><b>VS</b><PlayerComparePicker
			label="Player two"
			param="player2"
			selected={data.rightPlayer}
			otherId={data.player1}
		/>
	</section>
	{#if data.comparison}<div class="versus">
			<a href={resolve('/players/[id]', { id: data.comparison.left.user.id })}
				><PlayerAvatar
					name={data.comparison.left.user.name}
					image={data.comparison.left.user.image}
					size="large"
				/>
				<div>
					<strong>{data.comparison.left.user.name}</strong><span
						>#{number.format(data.comparison.left.globalRank)} · {number.format(
							data.comparison.left.user.performancePoints
						)} PP</span
					>
				</div></a
			><b>VS</b><a
				class="right"
				href={resolve('/players/[id]', { id: data.comparison.right.user.id })}
				><div>
					<strong>{data.comparison.right.user.name}</strong><span
						>#{number.format(data.comparison.right.globalRank)} · {number.format(
							data.comparison.right.user.performancePoints
						)} PP</span
					>
				</div>
				<PlayerAvatar
					name={data.comparison.right.user.name}
					image={data.comparison.right.user.image}
					size="large"
				/></a
			>
		</div>
		<div class="metrics">
			<div>
				<span>{data.comparison.left.user.name}</span><strong
					>{data.comparison.headToHead.leftWins}</strong
				><small>board wins</small>
			</div>
			<div>
				<span>Shared boards</span><strong>{data.comparison.commonBoards.length}</strong><small
					>{data.comparison.headToHead.ties} ties</small
				>
			</div>
			<div>
				<span>{data.comparison.right.user.name}</span><strong
					>{data.comparison.headToHead.rightWins}</strong
				><small>board wins</small>
			</div>
		</div>
		<section class="boards">
			<header>
				<div>
					<span>Exact overlap</span>
					<h2>COMMON BOARDS</h2>
				</div>
				<a href={resolve('/compare')}>New comparison</a>
			</header>
			{#if data.comparison.commonBoards.length}<div>
					{#each data.comparison.commonBoards as board (board.boardKey)}<article>
							<div>
								<strong>{board.map.name}</strong><small
									>{board.game.name} · {board.category.name} · {board.playerCount}P</small
								>
							</div>
							<span class:winner={board.winnerUserId === data.comparison.left.user.id}
								>{score(board.left, board.category.scoreType)}<small
									>{number.format(board.left.points)} PP</small
								></span
							><b>{board.winnerUserId ? '-' : 'TIE'}</b><span
								class:winner={board.winnerUserId === data.comparison.right.user.id}
								>{score(board.right, board.category.scoreType)}<small
									>{number.format(board.right.points)} PP</small
								></span
							><!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
								href={resolve('/maps/[id]/categories/[categoryId]', {
									id: String(board.map.id),
									categoryId: String(board.category.id)
								}) +
									`?assignment_id=${board.categoryAssignmentId}&player_count=${board.playerCount}`}
								>Board →</a
							>
						</article>{/each}
				</div>{:else}<p class="empty">These players do not share any ranked boards yet.</p>{/if}
		</section>
	{/if}
</div>

<style>
	.compare-page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.back {
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.compare-page > header {
		padding: 4rem 0 2rem;
		border-bottom: 1px solid var(--line-strong);
	}
	.compare-page > header span,
	.boards header span {
		color: var(--signal);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.compare-page h1 {
		margin: 0.5rem 0;
		font-family: var(--font-display);
		font-size: clamp(3rem, 8vw, 8rem);
		font-style: italic;
		line-height: 0.8;
	}
	.compare-page > header p {
		color: var(--muted);
	}
	.pickers {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: end;
		gap: 1rem;
		margin-top: 1rem;
		padding: 1.5rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.pickers > b {
		padding-bottom: 1.2rem;
		color: var(--signal);
		font-family: var(--font-display);
	}
	.versus {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		padding: 2.5rem 0;
	}
	.versus > a {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--ink);
		text-decoration: none;
	}
	.versus .right {
		justify-content: flex-end;
		text-align: right;
	}
	.versus a > div {
		display: grid;
		gap: 0.3rem;
	}
	.versus strong {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 3vw, 3rem);
		font-style: italic;
	}
	.versus span {
		color: var(--muted);
		font-size: 0.62rem;
	}
	.versus > b {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 2rem;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border: 1px solid var(--line);
	}
	.metrics > div {
		display: grid;
		justify-items: center;
		padding: 1.2rem;
		border-right: 1px solid var(--line);
	}
	.metrics span,
	.metrics small {
		color: var(--muted);
		font-size: 0.54rem;
		text-transform: uppercase;
	}
	.metrics strong {
		font-family: var(--font-display);
		font-size: 2.3rem;
		font-style: italic;
	}
	.boards {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.boards > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--line);
	}
	.boards h2 {
		margin: 0.25rem 0 0;
		font-family: var(--font-display);
		font-style: italic;
	}
	.boards header a,
	.boards article > a {
		color: var(--signal);
		font-size: 0.56rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.boards article {
		display: grid;
		grid-template-columns: minmax(15rem, 1fr) 8rem 2rem 8rem auto;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	.boards article > div {
		display: grid;
		gap: 0.2rem;
	}
	.boards article small {
		display: block;
		color: var(--muted);
		font-size: 0.53rem;
	}
	.boards article > span {
		text-align: center;
		font-family: monospace;
		font-weight: 900;
	}
	.boards article > span.winner {
		color: var(--signal);
	}
	.boards article > b {
		text-align: center;
		color: var(--muted);
		font-size: 0.5rem;
	}
	.empty {
		padding: 2rem;
		color: var(--muted);
	}
	@media (max-width: 700px) {
		.pickers {
			grid-template-columns: 1fr;
		}
		.pickers > b {
			padding: 0;
			text-align: center;
		}
		.versus {
			grid-template-columns: 1fr;
		}
		.versus > b {
			text-align: center;
		}
		.versus .right {
			justify-content: flex-start;
			text-align: left;
		}
		.versus .right > div {
			order: 2;
		}
		.metrics {
			grid-template-columns: 1fr;
		}
		.boards article {
			grid-template-columns: 1fr 1fr;
		}
		.boards article > div,
		.boards article > a {
			grid-column: 1/-1;
		}
		.boards article > b {
			display: none;
		}
	}
</style>
