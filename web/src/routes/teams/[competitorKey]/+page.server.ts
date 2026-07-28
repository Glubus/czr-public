import { safeApiGet } from '$lib/server/api';
import type { Player } from '$lib/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type TeamDetail = {
	competitorKey: string;
	playerCount: number;
	members: Array<Pick<Player, 'id' | 'name' | 'image'>>;
	performancePoints: number;
	recordCount: number;
	firstPlaces: number;
	podiums: number;
	lastVerifiedAt: string | null;
};
type TeamRecords = {
	entries: Array<{
		submissionId: number;
		points: number;
		isWorldRecord: boolean;
		scoreValue: number;
		runDurationMs: number | null;
		scoreType: string;
		playerCount: number;
		verifiedAt: string | null;
		game: { name: string };
		map: { id: number; name: string };
		category: { id: number; name: string };
	}>;
};

export const load: PageServerLoad = async ({ fetch, params }) => {
	const key = encodeURIComponent(params.competitorKey);
	const [detail, records] = await Promise.all([
		safeApiGet<TeamDetail>(fetch, `/teams/${key}`),
		safeApiGet<TeamRecords>(fetch, `/teams/${key}/records?page=0`)
	]);
	if (detail.status === 404) error(404, 'Team not found');
	return {
		detail: detail.data,
		records: records.data?.entries ?? [],
		apiUnavailable: detail.unavailable || records.unavailable
	};
};
