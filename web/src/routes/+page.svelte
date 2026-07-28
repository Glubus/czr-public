<script lang="ts">
	import { resolve } from '$app/paths';
	import HighestPointRecordsPanel from '$lib/components/organisms/HighestPointRecordsPanel.svelte';
	import MetricStrip from '$lib/components/organisms/MetricStrip.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	let games = $derived(data.games?.entries ?? []);
	let windowLabel = $derived(
		data.weekly
			? `${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(data.weekly.startsAt))} - ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(data.weekly.endsAt))}`
			: 'Resets Tuesday'
	);
</script>

<svelte:head><title>Zombies Records - Leaderboards and records</title></svelte:head>

<div class="dashboard-page">
	{#if data.apiUnavailable}
		<div class="service-alert" role="alert">
			<div>
				<strong>Live data is temporarily unavailable</strong>
				<span
					>The site is still accessible. Rankings and counters will return when the API reconnects.</span
				>
			</div>
			<a href={resolve('/')}>Retry now ↻</a>
		</div>
	{/if}
	<section class="hero">
		<div class="hero-copy">
			<p class="eyebrow"><span></span> Zombies records</p>
			<h1>ALL RECORDS.<br /><em>ONE LEADERBOARD.</em></h1>
			<p class="intro">
				Find the best performances, leaderboards for every game and map, and the proof behind each
				record.
			</p>
			<div class="hero-actions">
				<a class="primary-action" href={resolve('/leaderboard')}>View leaderboards <span>↗</span></a
				><a class="secondary-action" href={resolve('/search')}>Search records</a>
			</div>
		</div>
		<div class="hero-visual" aria-hidden="true">
			<div class="scan-lines"></div>
			<span class="visual-index">ROUND / 01</span>
			<div class="ring ring-one"></div>
			<div class="ring ring-two"></div>
			<div class="crosshair">+</div>
			<p>WORLD<br />RECORDS</p>
		</div>
	</section>

	{#if data.stats}
		<MetricStrip
			variant="platform"
			label="Platform statistics"
			items={[
				{ index: '01', label: 'Players', value: number.format(data.stats.playerCount) },
				{ index: '02', label: 'Submissions', value: number.format(data.stats.submissionCount) },
				{ index: '03', label: 'Games', value: number.format(data.stats.gameCount) },
				{ index: '04', label: 'Maps', value: number.format(data.stats.mapCount) },
				{
					index: '05',
					label: 'Categories',
					value: number.format(data.stats.categoryCount),
					highlight: true
				}
			]}
		/>
	{/if}

	<div class="content-grid">
		<div class="record-columns">
			<HighestPointRecordsPanel
				records={data.latest}
				eyebrow="Recently verified"
				title="LATEST WORLD RECORDS"
				status="Current WRs"
				compact
				limit={5}
			/>
			<HighestPointRecordsPanel
				records={data.weekly}
				eyebrow="Tuesday reset"
				title="HIGHEST PP OF THE WEEK"
				status={windowLabel}
				compact
				limit={5}
			/>
		</div>

		<aside class="side-stack">
			<section class="panel protocol-card">
				<span class="card-number">VERIFIED RECORDS</span>
				<h2>EVERY RECORD<br />NEEDS<br /><em>PROOF.</em></h2>
				<p>Every performance is reviewed before it appears on the leaderboards.</p>
				<a href={resolve('/leaderboard')}>View records <span>→</span></a>
			</section>

			<section class="panel games-card">
				<header>
					<div>
						<p class="eyebrow"><span></span> Games</p>
						<h2>AVAILABLE GAMES</h2>
					</div>
					<span>{games.length.toString().padStart(2, '0')}</span>
				</header>
				{#if games.length}
					<ul>
						{#each games.slice(0, 5) as game (game.id)}<li>
								<span>{game.shortName}</span><strong>{game.name}</strong><small
									>{game.releaseYear ?? '-'}</small
								>
							</li>{/each}
					</ul>
				{:else}<p class="no-games">No games available.</p>{/if}
				<a class="text-link" href={resolve('/games')}>View all games →</a>
			</section>
		</aside>
	</div>
</div>

<style>
	.dashboard-page {
		padding: 2.25rem;
	}
	.service-alert {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		padding: 0.9rem 1rem;
		border: 1px solid #783322;
		background: #28140f;
		color: #f3a58f;
	}
	.service-alert div {
		display: grid;
		gap: 0.2rem;
	}
	.service-alert strong {
		font-size: 0.75rem;
		text-transform: uppercase;
	}
	.service-alert span {
		font-size: 0.7rem;
		line-height: 1.5;
	}
	.service-alert a {
		flex: none;
		color: inherit;
		font-size: 0.68rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.hero {
		position: relative;
		display: grid;
		min-height: 31rem;
		grid-template-columns: minmax(0, 1.12fr) minmax(21rem, 0.88fr);
		overflow: hidden;
		border: 1px solid var(--line);
		background:
			radial-gradient(circle at 75% 35%, #30201b 0, transparent 28%),
			linear-gradient(135deg, #171b18, #0e100f 70%);
	}
	.hero::before {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			115deg,
			transparent 49.8%,
			rgba(228, 87, 53, 0.14) 50%,
			transparent 50.2%
		);
		content: '';
		pointer-events: none;
	}
	.hero-copy {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(2rem, 5vw, 5.5rem);
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0;
		color: var(--muted);
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.eyebrow span {
		width: 1.6rem;
		height: 2px;
		background: var(--signal);
	}
	h1 {
		margin: 1.4rem 0 1.2rem;
		font-family: var(--font-display);
		font-size: clamp(3.4rem, 6.2vw, 7.6rem);
		font-style: italic;
		font-weight: 900;
		letter-spacing: -0.035em;
		line-height: 0.83;
	}
	h1 em {
		color: transparent;
		font-style: inherit;
		-webkit-text-stroke: 1px var(--signal);
	}
	.intro {
		max-width: 36rem;
		margin: 0;
		color: #a7aea7;
		font-size: clamp(0.9rem, 1.15vw, 1.05rem);
		line-height: 1.7;
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 2rem;
	}
	.hero-visual {
		position: relative;
		min-height: 25rem;
		overflow: hidden;
		border-left: 1px solid var(--line);
		background: linear-gradient(155deg, rgba(214, 255, 63, 0.07), transparent 45%);
	}
	.scan-lines {
		position: absolute;
		inset: 0;
		opacity: 0.12;
		background: repeating-linear-gradient(0deg, transparent, transparent 3px, #fff 4px);
	}
	.visual-index {
		position: absolute;
		top: 1.5rem;
		right: 1.5rem;
		color: var(--signal);
		font-family: monospace;
		font-size: 0.68rem;
	}
	.ring {
		position: absolute;
		border: 1px solid #4c5840;
		border-radius: 50%;
	}
	.ring-one {
		width: 23rem;
		height: 23rem;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		box-shadow: inset 0 0 70px rgba(214, 255, 63, 0.05);
	}
	.ring-two {
		width: 14rem;
		height: 14rem;
		top: 50%;
		left: 50%;
		border-style: dashed;
		transform: translate(-50%, -50%) rotate(15deg);
	}
	.crosshair {
		position: absolute;
		top: 50%;
		left: 50%;
		color: var(--signal);
		font-family: monospace;
		font-size: 3rem;
		transform: translate(-50%, -50%);
	}
	.hero-visual p {
		position: absolute;
		right: 1.5rem;
		bottom: 1.3rem;
		margin: 0;
		color: rgba(242, 241, 233, 0.14);
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 4vw, 5rem);
		font-style: italic;
		font-weight: 900;
		line-height: 0.82;
		text-align: right;
	}
	.content-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.7fr) minmax(18rem, 0.7fr);
		gap: 1rem;
		margin-top: 1rem;
	}
	.record-columns {
		display: grid;
		min-width: 0;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		align-content: start;
	}
	.panel {
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--panel) 87%, transparent);
	}
	h2 {
		margin: 0.6rem 0 0;
		font-family: var(--font-display);
		font-size: 1.65rem;
		font-style: italic;
		letter-spacing: 0.02em;
	}
	.text-link {
		color: var(--signal);
		font-size: 0.68rem;
		font-weight: 800;
		text-decoration: none;
		text-transform: uppercase;
	}
	.side-stack {
		display: grid;
		align-content: start;
		gap: 1rem;
	}
	.protocol-card {
		position: relative;
		min-height: 22rem;
		overflow: hidden;
		padding: 1.6rem;
		background: var(--signal);
		color: #11140d;
	}
	.protocol-card::after {
		position: absolute;
		right: -2rem;
		bottom: -4.5rem;
		color: rgba(17, 20, 13, 0.1);
		content: 'R';
		font-family: var(--font-display);
		font-size: 18rem;
		font-style: italic;
		font-weight: 900;
		line-height: 1;
	}
	.card-number {
		font-family: monospace;
		font-size: 0.63rem;
		font-weight: 800;
	}
	.protocol-card h2 {
		position: relative;
		z-index: 1;
		margin-top: 3.5rem;
		font-size: clamp(2.2rem, 3.2vw, 3.8rem);
		line-height: 0.84;
	}
	.protocol-card h2 em {
		color: transparent;
		-webkit-text-stroke: 1px #11140d;
	}
	.protocol-card p {
		position: relative;
		z-index: 1;
		max-width: 25rem;
		font-size: 0.78rem;
		font-weight: 650;
		line-height: 1.55;
	}
	.protocol-card a {
		position: absolute;
		bottom: 1.5rem;
		z-index: 1;
		display: flex;
		width: calc(100% - 3rem);
		justify-content: space-between;
		padding-top: 1rem;
		border-top: 1px solid rgba(17, 20, 13, 0.3);
		color: inherit;
		font-size: 0.68rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.games-card {
		padding: 1.5rem;
	}
	.games-card header {
		display: flex;
		justify-content: space-between;
	}
	.games-card header > span {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.6rem;
	}
	.games-card ul {
		margin: 1.5rem 0;
		padding: 0;
		list-style: none;
	}
	.games-card li {
		display: grid;
		grid-template-columns: 3.2rem 1fr auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.8rem 0;
		border-top: 1px solid var(--line);
	}
	.games-card li > span {
		color: var(--signal);
		font-family: monospace;
		font-size: 0.62rem;
	}
	.games-card li strong {
		overflow: hidden;
		font-size: 0.75rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.games-card li small,
	.no-games {
		color: var(--muted);
		font-size: 0.65rem;
	}
	@media (max-width: 1180px) {
		.content-grid {
			grid-template-columns: 1fr;
		}
		.side-stack {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 800px) {
		.dashboard-page {
			padding: 1rem;
		}
		.record-columns {
			grid-template-columns: 1fr;
		}
		.hero {
			grid-template-columns: 1fr;
		}
		.hero-visual {
			display: none;
		}
		.side-stack {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 500px) {
		.service-alert {
			align-items: flex-start;
			flex-direction: column;
		}
		.hero-copy {
			padding: 2rem 1.35rem;
		}
		h1 {
			font-size: 3.25rem;
		}
	}
</style>
