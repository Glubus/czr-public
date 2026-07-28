import { safeApiGet } from '$lib/server/api';
import type { UserRecords } from '$lib/types';
import type { PageServerLoad } from './$types';

type RecordSide = {
	submissionId: number;
	scoreValue: number;
	runDurationMs: number | null;
	points: number;
	verifiedAt: string | null;
};
type Comparison = {
	left: {
		user: { id: string; name: string; image: string | null; performancePoints: number };
		globalRank: number;
		recordCount: number;
	};
	right: {
		user: { id: string; name: string; image: string | null; performancePoints: number };
		globalRank: number;
		recordCount: number;
	};
	friendship: { mutual: boolean; leftFollowsRight: boolean; rightFollowsLeft: boolean };
	headToHead: {
		leftWins: number;
		rightWins: number;
		ties: number;
		commonMapCount: number;
		commonCategoryCount: number;
	};
	commonBoards: Array<{
		boardKey: string;
		game: { name: string };
		map: { id: number; name: string };
		category: { id: number; name: string; scoreType: string };
		categoryAssignmentId: number;
		playerCount: number;
		winnerUserId: string | null;
		left: RecordSide;
		right: RecordSide;
	}>;
	sharedTeams: string[];
};

export const load: PageServerLoad = async ({ fetch, url }) => {
	const player1 = url.searchParams.get('player1')?.trim() ?? '';
	const player2 = url.searchParams.get('player2')?.trim() ?? '';
	const [leftPlayer, rightPlayer] = await Promise.all([
		player1
			? safeApiGet<UserRecords>(fetch, `/users/${encodeURIComponent(player1)}/records?page=0`)
			: Promise.resolve({ data: null, unavailable: false }),
		player2
			? safeApiGet<UserRecords>(fetch, `/users/${encodeURIComponent(player2)}/records?page=0`)
			: Promise.resolve({ data: null, unavailable: false })
	]);
	const comparison =
		player1 && player2 && player1 !== player2
			? await safeApiGet<Comparison>(
					fetch,
					`/users/${encodeURIComponent(player1)}/compare/${encodeURIComponent(player2)}`
				)
			: { data: null, unavailable: false };
	return {
		leftPlayer: leftPlayer.data?.user ?? null,
		rightPlayer: rightPlayer.data?.user ?? null,
		comparison: comparison.data,
		player1,
		player2,
		apiUnavailable: leftPlayer.unavailable || rightPlayer.unavailable || comparison.unavailable
	};
};
