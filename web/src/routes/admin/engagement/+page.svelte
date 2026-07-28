<script lang="ts">
	import { resolve } from '$app/paths';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const date = (value: string) =>
		new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
			new Date(value)
		);
</script>

<svelte:head><title>Engagement administration - Zombies Records</title></svelte:head>
<div class="page">
	<a class="back" href={resolve('/admin')}>← Moderation</a>
	<header>
		<span>Community systems</span>
		<h1>ENGAGEMENT.</h1>
		<p>Define persistent milestones and time-limited competitive events.</p>
	</header>
	{#if data.apiUnavailable}<FormAlert
			message="Engagement data is temporarily unavailable."
		/>{/if}{#if form?.message}<FormAlert message={form.message} />{/if}
	<div class="grid">
		<section>
			<header>
				<span>01</span>
				<h2>New achievement</h2>
			</header>
			<form method="POST" action="?/achievement">
				<label>Name<input name="name" maxlength="100" required /></label><label
					>Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label
				><label>Description<textarea name="description" maxlength="500" required></textarea></label>
				<div>
					<label
						>Metric<select name="metric"
							><option value="performance_points">Performance points</option><option
								value="verified_submissions">Verified submissions</option
							><option value="world_records">World records</option><option value="games_played"
								>Games played</option
							><option value="team_records">Team records</option><option value="record_points"
								>Best single-record PP</option
							><option value="classic_high_round">BO1-BO3 High Round</option><option
								value="bo3_high_round">BO3 High Round</option
							><option value="waw_high_round">WAW High Round</option><option value="speedrun_30"
								>30 Speedrun time</option
							><option value="speedrun_50">50 Speedrun time</option><option value="speedrun_100"
								>100 Speedrun time</option
							><option value="other_speedrun_30">Other games 30 Speedrun time</option><option
								value="other_speedrun_50">Other games 50 Speedrun time</option
							><option value="other_speedrun_100">Other games 100 Speedrun time</option><option
								value="no_power_round">No Power round</option
							><option value="maps_played">Maps played</option><option value="team_best_rank"
								>Best multiplayer rank</option
							><option value="map_top15_categories">Top-15 categories on one map</option><option
								value="map_all_categories_top15">All map categories in top 15</option
							><option value="world_records_2p">2P world records</option><option
								value="world_records_3p">3P world records</option
							><option value="world_records_4p">4P world records</option><option
								value="team_formats_played">Co-op formats played</option
							><option value="categories_played">Categories played</option><option
								value="game_high_round_top15_complete">All game maps High Round top 15</option
							><option value="game_ee_top20_records">EE top-20 records on one game</option><option
								value="community_records">Community records</option
							><option value="community_best_rank">Best community board rank</option><option
								value="bo3_gum_trio_best_rank">BO3 Gum trio best rank</option
							><option value="game_all_ee_top20">All game EEs in top 20</option><option
								value="back_from_the_dead">World records reclaimed</option
							><option value="podium_records">Current podium records</option><option
								value="jack_of_all_trades_top3">Core categories in top 3</option
							><option value="game_specialist_records">Specialist records on one game</option
							><option value="map_domination_best_rank">Best complete map rank</option><option
								value="dynamic_duo_records">Records with the same 2P partner</option
							><option value="dynamic_duo_world_records">WRs with the same 2P partner</option
							><option value="distinct_top3_duo_partners">Distinct top-3 2P partners</option><option
								value="distinct_top1_duo_partners">Distinct #1 2P partners</option
							><option value="duo_self_snipe">Own 2P world records beaten with a new duo</option
							><option value="self_wr_improvement">Own world records improved while #1</option
							><option value="wr_weekend">World-record weekends</option><option value="wr_games"
								>Games with a current world record</option
							><option value="longest_wr_reign_days">Longest world-record reign</option><option
								value="record_breaker_days">Oldest world record beaten</option
							><option value="format_sweep_best_rank">Best 1P-4P format sweep rank</option><option
								value="speedrun_ladder_best_rank">Best speedrun ladder rank</option
							><option value="no_crutches_best_rank">Best restricted-category sweep rank</option
							><option value="clean_extraction_best_rank">Best BO6 exfil sweep rank</option><option
								value="double_agent_best_rank">Best BO2 EE sides sweep rank</option
							><option value="restricted_arsenal_best_rank">Best MW3 survival sweep rank</option
							><option value="hardcore_credentials_best_rank">Best BO4 hardcore sweep rank</option
							><option value="first_room_official_round">Best official First Room round</option
							><option value="flawless_official_round">Best official Flawless round</option><option
								value="extinction_protocol_best_rank">Best Extinction mode sweep rank</option
							><option value="endurance_best_rank">Best 200/255 speedrun rank</option><option
								value="bo3_reset_maps">BO3 maps reset reached</option
							></select
						></label
					><label
						>Direction<select name="direction"
							><option value="higher_is_better">Higher is better</option><option
								value="lower_is_better">Lower is better</option
							></select
						></label
					><label
						>Threshold<input
							name="threshold"
							type="number"
							min="0.001"
							step="any"
							required
						/></label
					>
				</div>
				<div>
					<label>Category<input name="category" maxlength="80" required /></label>
					<label>Series<input name="series" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
					<label>Tier<input name="tier" type="number" min="1" value="1" required /></label>
					<label>AP reward<input name="points" type="number" min="1" value="10" required /></label>
				</div>
				<button>Create achievement →</button>
			</form>
		</section>
		<section>
			<header>
				<span>02</span>
				<h2>New challenge</h2>
			</header>
			<form method="POST" action="?/challenge">
				<label>Name<input name="name" maxlength="100" required /></label><label
					>Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label
				><label>Description<textarea name="description" maxlength="500" required></textarea></label>
				<div>
					<label
						>Metric<select name="metric"
							><option value="performance_points">Performance points</option><option
								value="verified_submissions">Verified submissions</option
							></select
						></label
					><label>Target<input name="targetValue" type="number" min="1" required /></label>
				</div>
				<div>
					<label>Starts<input name="startsAt" type="datetime-local" required /></label><label
						>Ends<input name="endsAt" type="datetime-local" required /></label
					>
				</div>
				<button>Create challenge →</button>
			</form>
		</section>
	</div>
	<div class="definitions">
		<section>
			<header>
				<span>Configured</span>
				<h2>Achievements</h2>
			</header>
			{#if data.achievements.length}<div>
					{#each data.achievements as item (item.id)}<article>
							<div><strong>{item.name}</strong><small>{item.description}</small></div>
							<b
								>{Math.round(item.threshold).toLocaleString('en-US')} · {item.metric.replace(
									'_',
									' '
								)}</b
							>
						</article>{/each}
				</div>{:else}<p>No achievements configured.</p>{/if}
		</section>
		<section>
			<header>
				<span>Scheduled</span>
				<h2>Challenges</h2>
			</header>
			{#if data.challenges.length}<div>
					{#each data.challenges as item (item.id)}<article>
							<div><strong>{item.name}</strong><small>{item.description}</small></div>
							<b>{date(item.startsAt)} - {date(item.endsAt)}</b>
						</article>{/each}
				</div>{:else}<p>No challenges configured.</p>{/if}
		</section>
	</div>
</div>

<style>
	.page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.back {
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 900;
		text-decoration: none;
		text-transform: uppercase;
	}
	.page > header {
		padding: 3rem 0 2rem;
	}
	.page > header span,
	section > header span {
		color: var(--signal);
		font-size: 0.57rem;
		font-weight: 900;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.55rem 0;
		font-family: var(--font-display);
		font-size: clamp(3rem, 7vw, 6rem);
		font-style: italic;
		line-height: 0.85;
	}
	.page > header p {
		color: var(--muted);
	}
	.grid,
	.definitions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		max-width: 80rem;
	}
	.definitions {
		margin-top: 1rem;
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
	form > div {
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
		background: var(--canvas-soft);
		color: var(--ink);
	}
	textarea {
		min-height: 5rem;
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
	.definitions article {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	.definitions article > div {
		display: grid;
		gap: 0.25rem;
	}
	.definitions strong {
		font-size: 0.68rem;
	}
	.definitions small,
	.definitions b,
	.definitions p {
		color: var(--muted);
		font-size: 0.54rem;
	}
	.definitions b {
		text-align: right;
		text-transform: uppercase;
	}
	.definitions p {
		padding: 1rem;
	}
	@media (max-width: 800px) {
		.grid,
		.definitions {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 550px) {
		.page {
			padding-bottom: 6rem;
		}
		form > div {
			grid-template-columns: 1fr;
		}
	}
</style>
