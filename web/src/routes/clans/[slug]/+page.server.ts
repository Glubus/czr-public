import { safeApiGet } from '$lib/server/api';
import type { ClanLeaderboard, Player } from '$lib/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type ClanDetail = {
	id: number;
	slug: string;
	name: string;
	logoImage: string | null;
	backgroundImage: string | null;
	createdAt: string;
	members: Array<{
		id: number;
		role: 'owner' | 'admin' | 'member';
		joinedAt: string;
		user: Pick<Player, 'id' | 'name' | 'image' | 'performancePoints'>;
	}>;
};

export const load: PageServerLoad = async ({ fetch, params }) => {
	const [result, leaderboard] = await Promise.all([
		safeApiGet<ClanDetail>(fetch, `/clans/${encodeURIComponent(params.slug)}`),
		safeApiGet<ClanLeaderboard>(fetch, '/clans/leaderboard?page=0')
	]);
	if (result.status === 404) error(404, 'Clan not found');
	const ranking = result.data
		? leaderboard.data?.entries.find((entry) => entry.clan.id === result.data?.id)
		: undefined;
	return {
		clan: result.data,
		stats: result.data
			? {
					rank: ranking?.rank ?? null,
					score: ranking?.score ?? 0,
					eligibleRunCount: ranking?.eligibleRunCount ?? 0,
					countedRunCount: ranking?.countedRunCount ?? 0,
					memberPoints: result.data.members.reduce(
						(total, member) => total + member.user.performancePoints,
						0
					)
				}
			: null,
		apiUnavailable: result.unavailable || leaderboard.unavailable
	};
};
