export type Player = {
	id: string;
	name: string;
	image: string | null;
	backgroundImage?: string | null;
	profileColor?: string;
	profileGradientColor?: string | null;
	profileGradientAngle?: number;
	countryCode?: string | null;
	countryChangedAt?: string | null;
	performancePoints: number;
	isClaimable?: boolean;
};

export type AccountUser = Player & {
	email: string;
	roles: string[];
};

export type AuthSession = {
	user: AccountUser;
	session: {
		id: string;
		expiresAt: string;
	};
};

export type LeaderboardEntry = { rank: number; user: Player; recordCount: number };

export type AchievementLeaderboardEntry = {
	rank: number;
	user: Player;
	achievementPoints: number;
	unlockedCount: number;
};

export type Leaderboard = {
	filters: {
		categories: string[];
		game?: string;
		mapsStatus?: 'official' | 'community';
		scope: 'world' | 'following' | 'friends';
		country?: string;
	};
	page: number;
	pageSize: number;
	totalEntries: number;
	totalPages: number;
	hasMore: boolean;
	entries: LeaderboardEntry[];
};

export type AchievementLeaderboard = {
	filters: { country: string | null };
	page: number;
	pageSize: number;
	totalEntries: number;
	totalPages: number;
	hasMore: boolean;
	entries: AchievementLeaderboardEntry[];
};

export type Game = {
	id: number;
	slug: string;
	name: string;
	shortName: string;
	releaseYear: number | null;
	gameType: 'zombies' | 'non_zombies';
	studio: string;
	isActive: boolean;
};

export type GameCollection = {
	search: string | null;
	page: number;
	pageSize: number;
	hasMore: boolean;
	entries: Game[];
};

export type MapResult = {
	id: number;
	gameId: number;
	slug: string;
	name: string;
	type: 'official' | 'custom' | 'uem';
	status: 'draft' | 'published' | 'archived';
	game: Pick<Game, 'id' | 'slug' | 'name'>;
};

export type MapCollection = {
	search: string | null;
	game: string | null;
	page: number;
	pageSize: number;
	hasMore: boolean;
	entries: MapResult[];
};

export type UserCollection = {
	search: string | null;
	page: number;
	pageSize: number;
	hasMore: boolean;
	entries: Player[];
};

export type SearchResults = {
	players: UserCollection | null;
	maps: MapCollection | null;
	games: GameCollection | null;
};

export type CategorySummary = {
	id: number;
	slug: string;
	name: string;
	scoreType: 'round' | 'time' | 'kills' | 'points' | 'custom';
	rankingDirection: 'higher_is_better' | 'lower_is_better';
};

export type CategoryDefinition = CategorySummary & {
	rules: Record<string, unknown>;
};

export type HighestPointRecords = {
	limit: 50;
	entries: Array<{
		rank: number;
		submissionId: number;
		isWorldRecord: boolean;
		points: number;
		scoreValue: number;
		runDurationMs: number | null;
		playerCount: number;
		verifiedAt: string | null;
		game: Pick<Game, 'id' | 'slug' | 'name'>;
		map: { id: number; slug: string; name: string };
		category: Pick<CategorySummary, 'id' | 'slug' | 'name' | 'scoreType'>;
		participants: Array<{
			role: string;
			user: Pick<Player, 'id' | 'name' | 'image'>;
		}>;
	}>;
};

export type WeeklyPointRecords = HighestPointRecords & {
	startsAt: string;
	endsAt: string;
};

export type HighestAverageLeaderboard = {
	limit: 50;
	entries: Array<{
		rank: number;
		user: Pick<Player, 'id' | 'name' | 'image'>;
		recordCount: number;
		averagePoints: number;
	}>;
};

export type TeamLeaderboard = {
	page: number;
	hasMore: boolean;
	entries: Array<{
		rank: number;
		competitorKey: string;
		playerCount: number;
		members: Array<Pick<Player, 'id' | 'name' | 'image'>>;
		performancePoints: number;
		recordCount: number;
		firstPlaces: number;
		podiums: number;
		lastVerifiedAt: string | null;
	}>;
};

export type ClanLeaderboard = {
	entries: Array<{
		rank: number;
		clan: { id: number; slug: string; name: string; memberCount: number };
		score: number;
		eligibleRunCount: number;
		countedRunCount: number;
	}>;
};

export type PlatformStats = {
	playerCount: number;
	submissionCount: number;
	gameCount: number;
	mapCount: number;
	categoryCount: number;
};

export type UserRecords = {
	user: Player;
	globalRank: number;
	countryRank: number | null;
	countryPlayerCount: number | null;
	recordCount: number;
	averageRecordPoints: number;
	page: number;
	pageSize: number;
	hasMore: boolean;
	pinnedSubmissionIds: number[];
	pinnedEntries: UserRecord[];
	worldRecordEntries: UserRecord[];
	entries: UserRecord[];
	mostPlayed: {
		totalPlayCount: number;
		playHistory: Array<{ month: string; playCount: number }>;
		games: Array<{ id: number; slug: string; name: string; playCount: number }>;
		maps: Array<{ id: number; slug: string; name: string; gameName: string; playCount: number }>;
		categories: Array<{ id: number; slug: string; name: string; playCount: number }>;
	};
};

export type PlayerBadge = {
	id: number;
	slug: string;
	name: string;
	description: string;
	color: string;
	icon: string | null;
	system: boolean;
	awardedAt: string;
};

export type UserRecord = {
	submissionId: number;
	isWorldRecord: boolean;
	points: number;
	awardedPoints: number;
	awardPercentage: number;
	scoreValue: number;
	runDurationMs: number | null;
	categoryAssignmentId: number | null;
	playerCount: number;
	proofLevel: string;
	verifiedAt: string | null;
	game: Pick<Game, 'id' | 'slug' | 'name'>;
	map: { id: number; slug: string; name: string };
	category: {
		id: number;
		slug: string;
		name: string;
		scoreType: 'round' | 'time' | 'kills' | 'points' | 'custom';
		rankingDirection: 'higher_is_better' | 'lower_is_better';
		specificRules: Record<string, unknown>;
	};
};

export type MapDetail = Omit<MapResult, 'game'> & {
	thumbnailUrl: string | null;
	description: string | null;
	authors: string[];
	createdAt: string;
	sources: Array<{ source: string; sourceUrl: string }>;
};

export type CategoryForMap = {
	id: number;
	slug: string;
	name: string;
	scoreType: 'round' | 'time' | 'kills' | 'points' | 'custom';
	rankingDirection: 'higher_is_better' | 'lower_is_better';
	assignmentId: number;
	globalRules: Record<string, unknown>;
	specificRules: Record<string, unknown>;
};

export type CategoryAssignmentCollection = {
	page: number;
	pageSize: 50;
	hasMore: boolean;
	entries: Array<{
		id: number;
		categoryId: number;
		gameId: number;
		mapId: number | null;
		specificRules: Record<string, unknown>;
		createdAt: string;
		category: CategorySummary & { rules: Record<string, unknown> };
		game: Pick<Game, 'id' | 'slug' | 'name'>;
		map: { id: number; slug: string; name: string } | null;
	}>;
};

export type GameMod = {
	id: number;
	gameId: number;
	slug: string;
	name: string;
};

export type SubmissionCollection = {
	page: number;
	pageSize: number;
	hasMore: boolean;
	entries: SubmissionDetail[];
};

export type SubmissionGroupResult = {
	submissionGroupId: string;
	submissions: Array<{ id: number; status: string }>;
};

export type PerformanceHistory = {
	userId: string;
	currentPoints: number;
	entries: Array<{
		id: number;
		points: number;
		delta: number;
		source: 'baseline' | 'submission' | 'daily' | 'formula_change';
		sourceSubmissionId: number | null;
		formulaVersion: number;
		recordedAt: string;
	}>;
};

export type MapLeaderboard = {
	category: CategoryForMap;
	pool: number;
	page: number;
	pageSize: number;
	totalEntries: number;
	totalPages: number;
	hasMore: boolean;
	entries: Array<{
		rank: number;
		userId: string;
		user: Pick<Player, 'id' | 'name' | 'image'>;
		scoreValue: number;
		proofLevel: string;
		points: number;
		participants: Array<{
			user: Pick<Player, 'id' | 'name' | 'image'>;
			points: number;
		}>;
		submission: {
			id: number;
			runDurationMs: number | null;
			proofUrl: string | null;
			submittedAt: string;
		};
	}>;
};

export type SubmissionDetail = {
	submission: {
		id: number;
		submissionGroupId: string | null;
		userId: string;
		competitorKey: string;
		gameId: number;
		mapId: number;
		categoryId: number;
		categoryAssignmentId: number | null;
		playerCount: number;
		scoreValue: number;
		runDurationMs: number | null;
		platform: string | null;
		gameVersion: string | null;
		mapVersion: string | null;
		modId: number | null;
		modVersion: string | null;
		status: string;
		proofLevel: string;
		proofUrl: string | null;
		rulesSnapshot: Record<string, unknown>;
		metadata: Record<string, unknown>;
		submittedAt: string;
		verifiedAt: string | null;
	};
	game: Pick<Game, 'id' | 'slug' | 'name'>;
	map: { id: number; slug: string; name: string; type: string };
	category: {
		id: number;
		slug: string;
		name: string;
		scoreType: 'round' | 'time' | 'kills' | 'points' | 'custom';
		rankingDirection: 'higher_is_better' | 'lower_is_better';
	};
	submitter: Pick<Player, 'id' | 'name' | 'image'>;
	points: number | null;
	participants: Array<{
		submissionId: number;
		role: string;
		status: string;
		acceptanceSource: string;
		acceptanceClanId: number | null;
		respondedAt: string | null;
		user: Pick<Player, 'id' | 'name' | 'image'>;
	}>;
	proofs: Array<{
		id: number;
		submissionId: number;
		type: string;
		sourceUrl: string | null;
		storageKey: string | null;
		sha256: string | null;
		mimeType: string | null;
		formatVersion: number;
		provider: 'youtube' | 'twitch' | 'steam' | 'direct' | 'other';
		metadata: Record<string, unknown>;
	}>;
};
