export type VerifiedRecordHistoryEntry = {
	submissionId: number;
	scoreValue: number;
	runDurationMs: number | null;
	verifiedAt: string | null;
	isBestRecord: boolean;
	points: number | null;
	game: { name: string };
	map: { id: number; name: string };
	category: { id: number; name: string; scoreType: string };
};

export type PersonalRunEntry = {
	id: number;
	scoreValue: number;
	runDurationMs: number | null;
	proofUrl: string | null;
	createdAt: string;
	map: { id: number; name: string };
	game: { name: string };
	category: { id: number; name: string; scoreType: string };
};

export type PlayerAchievement = {
	id: number;
	slug: string;
	name: string;
	description: string;
	metric:
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
	threshold: number;
	direction: 'higher_is_better' | 'lower_is_better';
	category: string;
	series: string;
	tier: number;
	points: number;
	achievementPoints: number;
	progress: number | null;
	unlockedAt: string | null;
};

export type ScopedPlayerRank = {
	id: number;
	slug: string;
	name: string;
	rank: number;
	totalPlayers: number;
	performancePoints: number;
	recordCount: number;
};

export type ScopedPlayerRanks = {
	games: ScopedPlayerRank[];
	categories: ScopedPlayerRank[];
};

export type PlayerSocialContext = {
	clan: null | { id: number; slug: string; name: string; role: string };
	frequentTeams: Array<{
		competitorKey: string;
		playerCount: number;
		recordCount: number;
		performancePoints: number;
		participants: Array<{ id: string; name: string; image: string | null }>;
	}>;
};

export type PlayerFollow = { targetType: string; targetId: string };

export type PlayerProfileTab = 'top' | 'history' | 'played' | 'runs' | 'ranks' | 'achievements';
