export type ParticipationInvitation = {
	invitation: { id: number; submissionGroupId: string; expiresAt: string; status: string };
	submitter: { id: string; name: string; image: string | null } | null;
	group: { submissions: Array<{ id: number; status: string }> };
};

export type NotificationPage = {
	entries: Array<{
		id: number;
		type: string;
		payload: Record<string, unknown>;
		readAt: string | null;
		createdAt: string;
	}>;
	hasMore: boolean;
};

export type ActivityFeedPage = {
	entries: Array<{
		id: number;
		type: string;
		actorUserId: string | null;
		payload: Record<string, unknown>;
		createdAt: string;
	}>;
};

export type PersonalRunPage = {
	entries: Array<{
		id: number;
		scoreValue: number;
		runDurationMs: number | null;
		proofUrl: string | null;
		visibility: string;
		promotedSubmissionId: number | null;
		createdAt: string;
		game: { name: string };
		map: { name: string };
		category: { name: string; scoreType: string };
	}>;
};

export type PlayerGoal = {
	id: number;
	title: string;
	metric: string;
	targetValue: number;
	progress: number;
	status: string;
	dueAt: string | null;
	direction: 'higher_is_better' | 'lower_is_better';
	gameId: number | null;
	mapId: number | null;
	categoryAssignmentId: number | null;
	playerCount: number | null;
	board: null | {
		game: { id: number; slug: string; name: string };
		map: { id: number; slug: string; name: string };
		assignmentId: number;
		category: { id: number; slug: string; name: string; scoreType: string };
	};
};

export type ActiveChallenge = {
	id: number;
	name: string;
	description: string;
	metric: string;
	targetValue: number;
	progress: number | null;
	startsAt: string;
	endsAt: string;
};

export type ProfileClaim = {
	id: number;
	profileExternalId: string;
	status: string;
	createdAt: string;
};

export type OwnClan = {
	clan: null | {
		id: number;
		slug: string;
		name: string;
		logoImage: string | null;
		backgroundImage: string | null;
		members: Array<{
			id: number;
			role: string;
			joinedAt: string;
			user: { id: string; name: string; image: string | null };
		}>;
	};
};

export type ClanInvitation = {
	invitation: { id: number; expiresAt: string };
	clan: { id: number; slug: string; name: string };
	inviter: { id: string; name: string } | null;
};

export type ManagedClanInvitation = {
	invitation: { id: number; status: string; expiresAt: string };
	invitee: { id: string; name: string; image: string | null };
};

export type ClanAuditEvent = {
	id: number;
	type: string;
	targetUserId: string | null;
	createdAt: string;
};

export type ClanPreferences = { autoAcceptClanRuns: boolean };

export type DashboardSection = 'overview' | 'runs' | 'goals' | 'clan' | 'settings';
