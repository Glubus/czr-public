import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const other = url.searchParams.get('with');
	const target = `/compare?player1=${encodeURIComponent(params.id)}${other ? `&player2=${encodeURIComponent(other)}` : ''}`;
	redirect(308, target);
};
