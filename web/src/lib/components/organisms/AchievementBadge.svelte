<script lang="ts">
	type Metric =
		| 'performance_points'
		| 'verified_submissions'
		| 'world_records'
		| 'games_played'
		| 'team_records'
		| 'record_points'
		| 'classic_high_round'
		| 'bo3_high_round'
		| 'waw_high_round'
		| 'speedrun_30'
		| 'speedrun_50'
		| 'speedrun_100'
		| 'other_speedrun_30'
		| 'other_speedrun_50'
		| 'other_speedrun_100'
		| 'no_power_round'
		| 'maps_played'
		| 'team_best_rank'
		| 'map_top15_categories'
		| 'map_all_categories_top15'
		| 'world_records_2p'
		| 'world_records_3p'
		| 'world_records_4p'
		| 'team_formats_played'
		| 'categories_played'
		| 'game_high_round_top15_complete'
		| 'game_ee_top20_records'
		| 'game_all_ee_top20'
		| 'community_records'
		| 'community_best_rank'
		| 'bo3_gum_trio_best_rank'
		| 'back_from_the_dead'
		| 'podium_records'
		| 'jack_of_all_trades_top3'
		| 'game_specialist_records'
		| 'map_domination_best_rank'
		| 'dynamic_duo_records'
		| 'dynamic_duo_world_records'
		| 'distinct_top3_duo_partners'
		| 'distinct_top1_duo_partners'
		| 'duo_self_snipe'
		| 'self_wr_improvement'
		| 'wr_weekend'
		| 'wr_games'
		| 'longest_wr_reign_days'
		| 'record_breaker_days'
		| 'format_sweep_best_rank'
		| 'speedrun_ladder_best_rank'
		| 'no_crutches_best_rank'
		| 'clean_extraction_best_rank'
		| 'double_agent_best_rank'
		| 'restricted_arsenal_best_rank'
		| 'hardcore_credentials_best_rank'
		| 'first_room_official_round'
		| 'flawless_official_round'
		| 'extinction_protocol_best_rank'
		| 'endurance_best_rank'
		| 'bo3_reset_maps';

	let {
		name,
		metric,
		threshold,
		progress = 0,
		unlocked = false,
		tier: explicitTier,
		maxTier = 1,
		percentage: explicitPercentage
	}: {
		name: string;
		metric: Metric;
		threshold: number;
		progress?: number | null;
		unlocked?: boolean;
		tier?: number;
		maxTier?: number;
		percentage?: number;
	} = $props();

	let percentage = $derived(
		explicitPercentage ??
			(unlocked ? 100 : Math.max(0, Math.min(100, ((progress ?? 0) / threshold) * 100)))
	);
	let tier = $derived(explicitTier ?? badgeTier(metric, threshold));

	function badgeTier(kind: Metric, target: number) {
		const thresholds: Partial<Record<Metric, number[]>> = {
			performance_points: [100, 1000, 5000, 10000],
			verified_submissions: [1, 10, 50, 100],
			world_records: [1, 5, 10, 25],
			games_played: [3, 5, 8, 12],
			team_records: [1, 5, 20, 50]
		};
		const index = (thresholds[kind] ?? [target]).findIndex((value) => target <= value);
		return index < 0 ? 4 : index + 1;
	}

	function tierLabel(value: number) {
		return ['I', 'II', 'III', 'IV', 'V'][value - 1] ?? String(value);
	}
</script>

<div
	class={`badge metric-${metric} tier-${tier}`}
	class:unlocked
	class:max-level={unlocked && tier >= maxTier}
	aria-label={`${name}: ${Math.round(percentage)}% complete`}
	role="img"
>
	<svg viewBox="0 0 96 96" aria-hidden="true">
		<path class="shadow" d="M48 3 84 24v48L48 93 12 72V24z" />
		<path class="frame" d="M48 7 80 26v44L48 89 16 70V26z" />
		<path class="face" d="M48 14 74 29v38L48 82 22 67V29z" />
		<circle class="track" cx="48" cy="48" r="37" pathLength="100" />
		<circle
			class="progress"
			cx="48"
			cy="48"
			r="37"
			pathLength="100"
			stroke-dasharray={`${percentage} ${100 - percentage}`}
			transform="rotate(-90 48 48)"
		/>

		{#if metric === 'performance_points' || metric === 'record_points' || metric === 'no_power_round'}
			<path class="icon" d="M53 24 34 51h12l-4 21 20-30H50z" />
		{:else if metric === 'verified_submissions'}
			<path class="icon-line" d="M34 69V27m2 3h27l-7 9 7 9H36" />
			<path class="icon-line check" d="m40 54 6 6 13-14" />
		{:else if metric === 'world_records' || metric === 'world_records_2p' || metric === 'world_records_3p' || metric === 'world_records_4p' || metric === 'back_from_the_dead' || metric === 'self_wr_improvement' || metric === 'wr_weekend' || metric === 'wr_games' || metric === 'longest_wr_reign_days' || metric === 'record_breaker_days'}
			<circle class="icon-line" cx="48" cy="51" r="17" />
			<path class="icon-line" d="M31 51h34M48 34c7 8 7 26 0 34M48 34c-7 8-7 26 0 34" />
			<path class="icon crown" d="m33 31 6-9 9 8 9-8 6 9-4 7H37z" />
		{:else if metric === 'games_played' || metric === 'maps_played'}
			<path class="icon-line" d="M48 25v46M25 48h46" />
			<circle class="icon-line" cx="48" cy="48" r="22" />
			<path class="icon" d="m53 43 10-8-8 11-12 8-10 8 8-11z" />
		{:else if metric === 'team_records' || metric === 'team_best_rank' || metric === 'team_formats_played' || metric === 'dynamic_duo_records' || metric === 'dynamic_duo_world_records' || metric === 'distinct_top3_duo_partners' || metric === 'distinct_top1_duo_partners' || metric === 'duo_self_snipe'}
			<circle class="icon" cx="48" cy="35" r="9" />
			<circle class="icon" cx="30" cy="43" r="7" />
			<circle class="icon" cx="66" cy="43" r="7" />
			<path
				class="icon"
				d="M30 66c1-12 8-19 18-19s17 7 18 19H55c-1-5-3-8-7-8s-6 3-7 8zm-16-1c1-10 6-16 14-16 4 0 7 1 9 4-3 3-5 7-6 12zm68 0H65c-1-5-3-9-6-12 2-3 5-4 9-4 8 0 13 6 14 16"
			/>
		{:else if metric === 'speedrun_30' || metric === 'speedrun_50' || metric === 'speedrun_100'}
			<circle class="icon-line" cx="48" cy="49" r="20" />
			<path class="icon-line" d="M48 37v13l10 6M40 23h16" />
		{:else}
			<path class="icon-line" d="M27 62c8-8 12-18 13-32h16c1 14 5 24 13 32" />
			<path class="icon-line" d="M25 63h46M36 48h24" />
		{/if}

		{#if unlocked}<path class="unlock-mark" d="m67 71 4 4 8-10" />{/if}
	</svg>
	<span>{tierLabel(tier)}</span>
</div>

<style>
	.badge {
		--badge: #778078;
		--badge-bright: #b6beb7;
		position: relative;
		width: 4.6rem;
		height: 5.2rem;
		flex: 0 0 auto;
		filter: grayscale(0.7);
		opacity: 0.7;
	}
	.badge.unlocked {
		filter: drop-shadow(0 0 0.18rem color-mix(in srgb, var(--badge-bright) 28%, transparent));
		opacity: 1;
	}
	.badge.unlocked.tier-2 {
		filter: drop-shadow(0 0 0.28rem color-mix(in srgb, var(--badge-bright) 38%, transparent));
	}
	.badge.unlocked.tier-3 {
		filter: drop-shadow(0 0 0.4rem color-mix(in srgb, var(--badge-bright) 48%, transparent));
	}
	.badge.unlocked.tier-4 {
		filter: drop-shadow(0 0 0.55rem color-mix(in srgb, var(--badge-bright) 58%, transparent));
	}
	.badge.unlocked.tier-5,
	.badge.unlocked.max-level {
		filter: drop-shadow(0 0 0.42rem color-mix(in srgb, var(--badge-bright) 75%, transparent))
			drop-shadow(0 0 0.9rem color-mix(in srgb, var(--badge) 42%, transparent));
	}
	.badge.unlocked.max-level .frame {
		stroke: var(--badge-bright);
		stroke-width: 3;
	}
	svg {
		display: block;
		width: 100%;
		overflow: visible;
		filter: drop-shadow(0 0.65rem 0.8rem rgba(0, 0, 0, 0.42));
	}
	.shadow {
		fill: #080a09;
		stroke: #080a09;
		stroke-width: 4;
	}
	.frame {
		fill: color-mix(in srgb, var(--badge) 35%, #151916);
		stroke: var(--badge);
		stroke-width: 2;
	}
	.face {
		fill: #121613;
		stroke: color-mix(in srgb, var(--badge) 60%, transparent);
		stroke-width: 1;
	}
	.track,
	.progress {
		fill: none;
		stroke-width: 2.5;
	}
	.track {
		stroke: rgba(255, 255, 255, 0.08);
	}
	.progress {
		stroke: var(--badge-bright);
		stroke-linecap: round;
	}
	.icon,
	.icon-line {
		fill: var(--badge-bright);
	}
	.icon-line {
		fill: none;
		stroke: var(--badge-bright);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 4;
	}
	.icon-line.check {
		stroke-width: 3;
	}
	.icon.crown {
		stroke: #121613;
		stroke-width: 1.5;
	}
	.unlock-mark {
		fill: none;
		stroke: #f7f4e8;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 3;
	}
	.badge > span {
		position: absolute;
		right: 0.18rem;
		bottom: 0.15rem;
		display: grid;
		width: 1.25rem;
		height: 1.25rem;
		place-items: center;
		border: 1px solid var(--badge);
		border-radius: 50%;
		background: #101311;
		color: var(--badge-bright);
		font-family: monospace;
		font-size: 0.48rem;
		font-weight: 900;
	}
	.metric-performance_points {
		--badge: #d69a3a;
		--badge-bright: #ffd875;
	}
	.metric-record_points {
		--badge: #d69a3a;
		--badge-bright: #ffe39a;
	}
	.metric-verified_submissions {
		--badge: #4aa877;
		--badge-bright: #8fe0ae;
	}
	.metric-world_records {
		--badge: #d04e38;
		--badge-bright: #ff8b6d;
	}
	.metric-world_records_2p,
	.metric-world_records_3p,
	.metric-world_records_4p {
		--badge: #c94c38;
		--badge-bright: #ff9b7d;
	}
	.metric-games_played {
		--badge: #4e87bd;
		--badge-bright: #8bc6ef;
	}
	.metric-maps_played {
		--badge: #487fad;
		--badge-bright: #9dd7ff;
	}
	.metric-team_records {
		--badge: #9968c5;
		--badge-bright: #d2a8f5;
	}
	.metric-team_best_rank {
		--badge: #8658b0;
		--badge-bright: #dfb8ff;
	}
	.metric-team_formats_played {
		--badge: #8658b0;
		--badge-bright: #dfb8ff;
	}
	.metric-classic_high_round,
	.metric-bo3_high_round,
	.metric-waw_high_round {
		--badge: #3f9a74;
		--badge-bright: #83e3b3;
	}
	.metric-speedrun_30,
	.metric-speedrun_50,
	.metric-speedrun_100,
	.metric-other_speedrun_30,
	.metric-other_speedrun_50,
	.metric-other_speedrun_100 {
		--badge: #3c8eb8;
		--badge-bright: #91dafa;
	}
	.metric-no_power_round {
		--badge: #898f3d;
		--badge-bright: #e4ea75;
	}
	.metric-map_top15_categories,
	.metric-map_all_categories_top15,
	.metric-categories_played,
	.metric-game_high_round_top15_complete,
	.metric-game_ee_top20_records,
	.metric-game_all_ee_top20,
	.metric-community_records,
	.metric-community_best_rank,
	.metric-bo3_gum_trio_best_rank,
	.metric-podium_records,
	.metric-jack_of_all_trades_top3,
	.metric-game_specialist_records,
	.metric-map_domination_best_rank {
		--badge: #b06a42;
		--badge-bright: #ffc08c;
	}
	.tier-4 .frame {
		stroke-width: 3;
	}
</style>
