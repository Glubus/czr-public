<script lang="ts">
	import { resolve } from '$app/paths';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import AchievementBadge from '$lib/components/organisms/AchievementBadge.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { PlayerAchievement, PlayerSocialContext } from './contracts';

	let {
		achievements,
		socialContext
	}: { achievements: PlayerAchievement[]; socialContext: PlayerSocialContext } = $props();

	type AchievementSeries = {
		id: string;
		levels: PlayerAchievement[];
		current: PlayerAchievement | null;
		next: PlayerAchievement | null;
		display: PlayerAchievement;
	};

	const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	const metricOrder: Partial<Record<PlayerAchievement['metric'], number>> = {
		speedrun_30: 30,
		speedrun_50: 50,
		speedrun_100: 100,
		other_speedrun_30: 130,
		other_speedrun_50: 150,
		other_speedrun_100: 200
	};
	const formatDate = (value: string) =>
		new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
			new Date(value)
		);
	const roundChallengeMetrics = new Set<PlayerAchievement['metric']>([
		'classic_high_round',
		'bo3_high_round',
		'waw_high_round',
		'no_power_round',
		'bo3_reset_maps',
		'first_room_official_round',
		'flawless_official_round'
	]);
	const restrictionMetrics = new Set<PlayerAchievement['metric']>([
		'no_crutches_best_rank',
		'restricted_arsenal_best_rank',
		'hardcore_credentials_best_rank'
	]);
	const specializedModeMetrics = new Set<PlayerAchievement['metric']>([
		'bo3_gum_trio_best_rank',
		'clean_extraction_best_rank',
		'double_agent_best_rank',
		'extinction_protocol_best_rank'
	]);

	function gameMasteryGroup(metric: PlayerAchievement['metric']) {
		if (roundChallengeMetrics.has(metric)) return 'Round challenges';
		if (restrictionMetrics.has(metric)) return 'Restricted survival';
		if (specializedModeMetrics.has(metric)) return 'Specialized modes';
		return 'Completion & versatility';
	}

	let unlockedCount = $derived(achievements.filter((entry) => entry.unlockedAt).length);
	let achievementPoints = $derived(achievements[0]?.achievementPoints ?? 0);
	let achievementCategories = $derived.by(() => {
		const categories = new SvelteMap<string, SvelteMap<string, PlayerAchievement[]>>();
		for (const achievement of achievements) {
			const series = categories.get(achievement.category) ?? new SvelteMap();
			const levels = series.get(achievement.series) ?? [];
			levels.push(achievement);
			series.set(achievement.series, levels);
			categories.set(achievement.category, series);
		}
		return [...categories.entries()].map(([name, series]) => {
			const sortedSeries = [...series.entries()]
				.map(([id, unsortedLevels]) => {
					const levels = unsortedLevels.toSorted((left, right) => left.tier - right.tier);
					const current = [...levels].reverse().find((level) => level.unlockedAt) ?? null;
					const next = levels.find((level) => !level.unlockedAt) ?? null;
					return { id, levels, current, next, display: current ?? next ?? levels[0] };
				})
				.toSorted((left, right) => {
					const leftOrder = metricOrder[left.levels[0]?.metric] ?? Number.MAX_SAFE_INTEGER;
					const rightOrder = metricOrder[right.levels[0]?.metric] ?? Number.MAX_SAFE_INTEGER;
					return leftOrder - rightOrder || left.id.localeCompare(right.id);
				});
			if (name !== 'Game Mastery') return { name, series: sortedSeries, groups: [] };

			const groupOrder = [
				'Round challenges',
				'Restricted survival',
				'Specialized modes',
				'Completion & versatility'
			];
			return {
				name,
				series: sortedSeries,
				groups: groupOrder
					.map((groupName) => ({
						name: groupName,
						series: sortedSeries.filter(
							(entry) => gameMasteryGroup(entry.levels[0].metric) === groupName
						)
					}))
					.filter((group) => group.series.length > 0)
			};
		});
	});

	function percentage(achievement: PlayerAchievement) {
		const progress = achievement.progress;
		if (progress === null || progress <= 0) return 0;
		const ratio =
			achievement.direction === 'lower_is_better'
				? achievement.threshold / progress
				: progress / achievement.threshold;
		return Math.max(0, Math.min(100, ratio * 100));
	}

	function duration(milliseconds: number) {
		const totalSeconds = Math.floor(milliseconds / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return hours
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
			: `${minutes}:${String(seconds).padStart(2, '0')}`;
	}

	function progressLabel(achievement: PlayerAchievement) {
		if (
			achievement.metric.startsWith('speedrun_') ||
			achievement.metric.startsWith('other_speedrun_')
		) {
			return achievement.progress === null
				? `No qualifying record · target ${duration(achievement.threshold)} or faster`
				: `${duration(achievement.progress)} / ${duration(achievement.threshold)} or faster`;
		}
		if (achievement.metric === 'team_best_rank') {
			return achievement.progress === null
				? `No global team rank · target top ${achievement.threshold}`
				: `#${number.format(achievement.progress)} / top ${number.format(achievement.threshold)}`;
		}
		if (
			achievement.metric === 'community_best_rank' ||
			achievement.metric === 'bo3_gum_trio_best_rank' ||
			achievement.metric === 'map_domination_best_rank' ||
			achievement.metric.endsWith('_best_rank')
		) {
			return achievement.progress === null
				? `No qualifying rank · target top ${number.format(achievement.threshold)}`
				: `#${number.format(achievement.progress)} / top ${number.format(achievement.threshold)}`;
		}
		if (
			achievement.metric === 'longest_wr_reign_days' ||
			achievement.metric === 'record_breaker_days'
		) {
			return `${number.format(Math.floor(achievement.progress ?? 0))} / ${number.format(
				Math.ceil(achievement.threshold)
			)} days`;
		}
		const progress = Math.floor(achievement.progress ?? 0);
		const threshold = Math.ceil(achievement.threshold);
		return `${number.format(progress)} / ${number.format(threshold)}`;
	}

	function seriesPoints(levels: PlayerAchievement[], level: PlayerAchievement) {
		return levels
			.filter((candidate) => candidate.tier <= level.tier)
			.reduce((total, candidate) => total + candidate.points, 0);
	}
</script>

{#snippet achievementGrid(seriesList: AchievementSeries[])}
	<div class="achievement-grid">
		{#each seriesList as series (series.id)}
			{@const achievement = series.display}
			<article
				class:unlocked={Boolean(series.current)}
				aria-label={`${achievement.name}: ${progressLabel(achievement)}`}
			>
				<AchievementBadge
					name={achievement.name}
					metric={achievement.metric}
					threshold={achievement.threshold}
					progress={achievement.progress}
					unlocked={Boolean(series.current)}
					tier={series.current?.tier ?? achievement.tier}
					maxTier={series.levels.at(-1)?.tier ?? achievement.tier}
					percentage={percentage(achievement)}
				/>
				<div class="achievement-copy">
					<div class="achievement-name">
						<strong>{achievement.name}</strong>
						<b>{seriesPoints(series.levels, achievement)} AP</b>
					</div>
					<p>{achievement.description}</p>
					<small>
						{series.current
							? `${series.next ? 'Unlocked' : 'Completed'} · ${formatDate(series.current.unlockedAt!)} · Level ${series.current.tier}/${series.levels.length}`
							: `Locked · ${progressLabel(achievement)}`}
					</small>
				</div>
				<div class="progress-tooltip" role="tooltip">
					<strong>{series.next ? `Next: ${series.next.name}` : 'Series complete'}</strong>
					<span
						>{series.next
							? progressLabel(series.next)
							: `${series.levels.length}/${series.levels.length} levels`}</span
					>
					<small
						>{series.next
							? `${series.current?.tier ?? 0}/${series.levels.length} levels · ${seriesPoints(series.levels, series.next)} AP total`
							: `${seriesPoints(series.levels, series.current!)} AP total`}</small
					>
				</div>
			</article>
		{/each}
	</div>
{/snippet}

<div class="layout">
	<section class="achievements">
		<header>
			<div>
				<Eyebrow>Milestones</Eyebrow>
				<h2>ACHIEVEMENTS</h2>
			</div>
			<div class="achievement-total">
				<strong>{number.format(achievementPoints)} AP</strong>
				<span>{unlockedCount}/{achievements.length} levels unlocked</span>
			</div>
		</header>
		{#if achievements.length}
			<div class="achievement-categories">
				{#each achievementCategories as category (category.name)}
					<section class="achievement-category">
						<header>
							<h3>{category.name}</h3>
							<span>{category.series.length} series</span>
						</header>
						{#if category.groups.length}
							<div class="mastery-groups">
								{#each category.groups as group (group.name)}
									<details open>
										<summary>
											<strong>{group.name}</strong>
											<span>{group.series.length} series</span>
										</summary>
										{@render achievementGrid(group.series)}
									</details>
								{/each}
							</div>
						{:else}
							{@render achievementGrid(category.series)}
						{/if}
					</section>
				{/each}
			</div>
		{:else}
			<p class="empty">Achievements are not configured yet.</p>
		{/if}
	</section>
	<section class="teams">
		<header>
			<div>
				<Eyebrow>Played together</Eyebrow>
				<h2>FREQUENT TEAMS</h2>
			</div>
			<a href={resolve('/teams')}>Team leaderboard →</a>
		</header>
		{#if socialContext.frequentTeams.length}
			<div class="team-rows">
				{#each socialContext.frequentTeams as team (team.competitorKey)}
					<a href={resolve('/teams/[competitorKey]', { competitorKey: team.competitorKey })}>
						<div class="avatar-stack">
							{#each team.participants as player (player.id)}
								<PlayerAvatar name={player.name} image={player.image} size="small" />
							{/each}
						</div>
						<div>
							<strong>{team.participants.map((player) => player.name).join(' / ')}</strong>
							<small>{team.playerCount} players · {team.recordCount} records</small>
						</div>
						<b>{number.format(team.performancePoints)} <small>PP</small></b>
						<span aria-hidden="true">→</span>
					</a>
				{/each}
			</div>
		{:else}
			<p class="empty">No ranked team records yet.</p>
		{/if}
	</section>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(22rem, 0.65fr);
		gap: 1rem;
	}
	section {
		margin-top: 1rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	header {
		display: flex;
		min-height: 5rem;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 1.55rem;
		font-style: italic;
	}
	.achievement-total {
		display: grid;
		justify-items: end;
		gap: 0.25rem;
	}
	.achievement-total strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-style: italic;
	}
	.achievement-total span {
		color: var(--muted);
		font-size: 0.55rem;
		font-weight: 900;
		text-transform: uppercase;
	}
	.achievement-categories {
		display: grid;
	}
	.achievement-category {
		margin: 0;
		border: 0;
		border-bottom: 1px solid var(--line);
		background: transparent;
	}
	.achievement-category:last-child {
		border-bottom: 0;
	}
	.achievement-category > header {
		min-height: 3.25rem;
		padding: 0.75rem 1rem;
		background: var(--canvas-soft);
	}
	.achievement-category h3 {
		margin: 0;
		color: var(--ink);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.achievement-category > header span {
		color: var(--muted);
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.mastery-groups {
		display: grid;
	}
	.mastery-groups details {
		border-bottom: 1px solid var(--line);
	}
	.mastery-groups details:last-child {
		border-bottom: 0;
	}
	.mastery-groups summary {
		display: flex;
		min-height: 2.8rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 1rem;
		background: color-mix(in srgb, var(--canvas-soft) 60%, var(--panel));
		cursor: pointer;
		list-style: none;
	}
	.mastery-groups summary::-webkit-details-marker {
		display: none;
	}
	.mastery-groups summary::before {
		width: 0.45rem;
		height: 0.45rem;
		border-right: 1px solid var(--signal);
		border-bottom: 1px solid var(--signal);
		content: '';
		transform: rotate(-45deg);
		transition: transform 120ms ease;
	}
	.mastery-groups details[open] > summary::before {
		transform: rotate(45deg) translate(-0.1rem, -0.1rem);
	}
	.mastery-groups summary strong {
		flex: 1;
		color: var(--ink);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.mastery-groups summary span {
		color: var(--muted);
		font-size: 0.5rem;
		text-transform: uppercase;
	}
	.mastery-groups summary:hover {
		background: var(--panel-hover);
	}
	.achievement-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
	}
	.achievements article {
		position: relative;
		display: grid;
		grid-template-columns: 4.6rem 1fr;
		align-items: center;
		gap: 1rem;
		min-height: 8.2rem;
		padding: 1.1rem;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		opacity: 0.72;
		outline: 0;
	}
	.achievements article.unlocked {
		opacity: 1;
	}
	.achievements article:hover {
		z-index: 5;
		background: var(--panel-hover);
		opacity: 1;
	}
	.achievement-copy {
		min-width: 0;
	}
	.achievement-name {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.achievement-name b {
		color: var(--signal);
		font: 800 0.52rem monospace;
		white-space: nowrap;
	}
	.achievements strong {
		font-size: 0.75rem;
	}
	.achievements p {
		margin: 0.4rem 0;
		color: var(--muted);
		font-size: 0.58rem;
		line-height: 1.5;
	}
	.achievements small {
		color: var(--signal);
		font-size: 0.52rem;
		text-transform: uppercase;
	}
	.progress-tooltip {
		position: absolute;
		right: 0.75rem;
		bottom: calc(100% - 0.35rem);
		left: 0.75rem;
		display: none;
		padding: 0.8rem;
		border: 1px solid var(--line-strong);
		background: #0d100e;
		box-shadow: 0 0.8rem 1.8rem rgb(0 0 0 / 48%);
	}
	.achievements article:hover .progress-tooltip {
		display: grid;
		gap: 0.3rem;
	}
	.progress-tooltip strong {
		color: var(--ink);
		font-size: 0.65rem;
	}
	.progress-tooltip span {
		color: var(--signal);
		font: 800 0.62rem monospace;
	}
	.progress-tooltip small {
		color: var(--muted);
	}
	.teams header > a {
		color: var(--signal);
		font-size: 0.54rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.team-rows > a {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.8rem;
		min-height: 4.8rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.team-rows > a:hover {
		background: var(--panel-hover);
	}
	.team-rows > a > div:nth-child(2) {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}
	.team-rows strong {
		overflow: hidden;
		font-size: 0.68rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.team-rows small {
		color: var(--muted);
		font-size: 0.52rem;
	}
	.team-rows > a > b {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1rem;
		font-style: italic;
		white-space: nowrap;
	}
	.team-rows > a > span {
		color: var(--muted);
	}
	.avatar-stack {
		display: flex;
		grid-row: 1 / 3;
	}
	.avatar-stack :global(*) {
		margin-left: -0.35rem;
	}
	.avatar-stack :global(*:first-child) {
		margin-left: 0;
	}
	.empty {
		margin: 0;
		padding: 3rem 1rem;
		color: var(--muted);
		font-size: 0.68rem;
		text-align: center;
	}
	@media (max-width: 850px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.achievement-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 600px) {
		.achievement-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
