import { apiRequest } from '$lib/server/api';
import type { AuthSession } from '$lib/types';
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
	const legal = {
		legalOperatorName: env.LEGAL_OPERATOR_NAME?.trim() || null,
		legalContactEmail: env.LEGAL_CONTACT_EMAIL?.trim() || null,
		legalHostName: env.LEGAL_HOST_NAME?.trim() || null
	};
	const token = cookies.get('zr_session');
	if (!token) return { user: null, unreadNotifications: 0, ...legal };

	try {
		const auth = await apiRequest<AuthSession | null>(fetch, '/auth/session', {}, token);
		if (!auth?.user) {
			cookies.delete('zr_session', { path: '/' });
			return { user: null, unreadNotifications: 0, ...legal };
		}
		let unreadNotifications = 0;
		try {
			const unread = await apiRequest<{ count: number }>(
				fetch,
				'/me/notifications/unread-count',
				{},
				token
			);
			unreadNotifications = unread.count;
		} catch {
			// Authentication remains usable if the notification projection is unavailable.
		}
		return { user: auth.user, unreadNotifications, ...legal };
	} catch {
		return { user: null, unreadNotifications: 0, ...legal };
	}
};
