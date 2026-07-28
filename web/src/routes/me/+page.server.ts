import { ApiError, apiFetch, apiRequest } from '$lib/server/api';
import type {
	ActiveChallenge,
	ActivityFeedPage,
	ClanAuditEvent,
	ClanInvitation,
	ClanPreferences,
	ManagedClanInvitation,
	NotificationPage,
	OwnClan,
	ParticipationInvitation,
	PersonalRunPage,
	PlayerGoal,
	ProfileClaim
} from '$lib/features/player-dashboard/contracts';
import {
	mutateDashboardResource as mutate,
	positiveFormInteger as positiveInteger,
	requireDashboardToken as requireToken
} from '$lib/features/player-dashboard/server-actions';
import { personalActions } from '$lib/features/player-dashboard/personal-actions';
import type { GameCollection, SubmissionCollection } from '$lib/types';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
	const token = cookies.get('zr_session');
	if (!token) redirect(303, '/login?next=/me');
	const { user } = await parent();
	if (!user) redirect(303, '/login?next=/me');
	const [
		submissions,
		invitations,
		notifications,
		feed,
		runs,
		goals,
		claims,
		clan,
		clanInvitations,
		games,
		challenges
	] = await Promise.all([
		optional<SubmissionCollection>(fetch, '/me/submissions?page=0', token),
		optional<ParticipationInvitation[]>(fetch, '/me/participation-invitations', token),
		optional<NotificationPage>(fetch, '/me/notifications', token),
		optional<ActivityFeedPage>(fetch, '/me/feed', token),
		optional<PersonalRunPage>(fetch, '/me/personal-runs', token),
		optional<PlayerGoal[]>(fetch, '/me/goals', token),
		optional<ProfileClaim[]>(fetch, '/me/profile-claims', token),
		optional<OwnClan>(fetch, '/me/clan', token),
		optional<ClanInvitation[]>(fetch, '/me/clan-invitations', token),
		optional<GameCollection>(fetch, '/games?page=0', token),
		optional<ActiveChallenge[]>(fetch, '/challenges', token)
	]);
	const ownClan = clan.data?.clan ?? null;
	const ownRole = ownClan?.members.find((member) => member.user.id === user.id)?.role ?? null;
	const canManageClan = ownRole === 'owner' || ownRole === 'admin';
	const [managedInvitations, clanAudit, clanPreferences] = await Promise.all([
		canManageClan && ownClan
			? optional<ManagedClanInvitation[]>(fetch, `/clans/${ownClan.id}/invitations`, token)
			: Promise.resolve({ data: [], unavailable: false }),
		canManageClan && ownClan
			? optional<ClanAuditEvent[]>(fetch, `/clans/${ownClan.id}/audit-events`, token)
			: Promise.resolve({ data: [], unavailable: false }),
		optional<ClanPreferences>(fetch, '/me/clan-preferences', token)
	]);
	return {
		submissions: submissions.data?.entries ?? [],
		invitations: invitations.data ?? [],
		notifications: notifications.data?.entries ?? [],
		feed: feed.data?.entries ?? [],
		runs: runs.data?.entries ?? [],
		goals: goals.data ?? [],
		claims: claims.data ?? [],
		clan: ownClan,
		ownClanRole: ownRole,
		clanInvitations: clanInvitations.data ?? [],
		managedClanInvitations: managedInvitations.data ?? [],
		clanAudit: clanAudit.data ?? [],
		clanPreferences: clanPreferences.data ?? { autoAcceptClanRuns: false },
		games: games.data?.entries ?? [],
		challenges: challenges.data ?? [],
		apiUnavailable:
			[
				submissions,
				invitations,
				notifications,
				feed,
				runs,
				goals,
				claims,
				clan,
				clanInvitations,
				games,
				challenges
			].some((result) => result.unavailable) ||
			managedInvitations.unavailable ||
			clanAudit.unavailable ||
			clanPreferences.unavailable
	};
};

export const actions: Actions = {
	...personalActions,
	createClan: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (name.length < 2) {
			return fail(400, { message: 'Enter a clan name.' });
		}
		return mutate(fetch, '/clans', 'POST', { name }, token);
	},
	clanInvitation: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = String(form.get('status'));
		if (!Number.isInteger(id) || !['accepted', 'rejected'].includes(status)) {
			return fail(400, { message: 'Invalid clan invitation response.' });
		}
		return mutate(fetch, `/me/clan-invitations/${id}`, 'PATCH', { status }, token);
	},
	inviteClanMember: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const clanId = positiveInteger(form.get('clanId'));
		const userId = String(form.get('userId') ?? '').trim();
		if (!clanId || !userId) return fail(400, { message: 'Choose a player to invite.' });
		return mutate(fetch, `/clans/${clanId}/invitations`, 'POST', { userId }, token);
	},
	clanMemberRole: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const clanId = positiveInteger(form.get('clanId'));
		const userId = String(form.get('userId') ?? '').trim();
		const role = String(form.get('role') ?? '');
		if (!clanId || !userId || !['admin', 'member'].includes(role)) {
			return fail(400, { message: 'Invalid clan role update.' });
		}
		return mutate(
			fetch,
			`/clans/${clanId}/members/${encodeURIComponent(userId)}/role`,
			'PATCH',
			{ role },
			token
		);
	},
	removeClanMember: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const clanId = positiveInteger(form.get('clanId'));
		const userId = String(form.get('userId') ?? '').trim();
		if (!clanId || !userId) return fail(400, { message: 'Invalid clan member.' });
		return mutate(
			fetch,
			`/clans/${clanId}/members/${encodeURIComponent(userId)}`,
			'DELETE',
			undefined,
			token
		);
	},
	revokeClanInvitation: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const clanId = positiveInteger(form.get('clanId'));
		const invitationId = positiveInteger(form.get('invitationId'));
		if (!clanId || !invitationId) return fail(400, { message: 'Invalid clan invitation.' });
		return mutate(
			fetch,
			`/clans/${clanId}/invitations/${invitationId}`,
			'DELETE',
			undefined,
			token
		);
	},
	clanPreferences: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		return mutate(
			fetch,
			'/me/clan-preferences',
			'PATCH',
			{ autoAcceptClanRuns: form.get('autoAcceptClanRuns') === 'on' },
			token
		);
	},
	profileSettings: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const countryCode = String(form.get('countryCode') ?? '')
			.trim()
			.toUpperCase();
		if (!name) {
			return fail(400, { message: 'Display name is required.', section: 'settings' });
		}
		const profileColor = profileHex(form.get('profileColor'));
		const gradientEnabled = form.get('profileGradientEnabled') === 'true';
		const profileGradientColor = gradientEnabled
			? profileHex(form.get('profileGradientColor'))
			: null;
		const profileGradientAngle = Number(form.get('profileGradientAngle') ?? 135);
		if (
			!profileColor ||
			(gradientEnabled && !profileGradientColor) ||
			!Number.isInteger(profileGradientAngle) ||
			profileGradientAngle < 0 ||
			profileGradientAngle > 360
		) {
			return fail(400, { message: 'Choose a valid profile color.', section: 'settings' });
		}

		const avatar = optionalMediaFile(form.get('avatar'), 'avatar');
		if ('error' in avatar) return fail(400, { message: avatar.error, section: 'settings' });
		const background = optionalMediaFile(form.get('background'), 'profile-background');
		if ('error' in background) return fail(400, { message: background.error, section: 'settings' });

		try {
			await Promise.all([
				apiFetch(
					fetch,
					'/me/profile',
					{
						method: 'PATCH',
						body: JSON.stringify({
							name,
							profileColor,
							profileGradientColor,
							profileGradientAngle,
							countryCode: countryCode || null
						})
					},
					token
				),
				...(avatar.file
					? [uploadProfileMedia(fetch, token, 'avatar', avatar.file, avatar.type)]
					: []),
				...(background.file
					? [
							uploadProfileMedia(
								fetch,
								token,
								'profile-background',
								background.file,
								background.type
							)
						]
					: [])
			]);
			return { success: true, message: 'Profile settings saved.', section: 'settings' };
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message: error instanceof ApiError ? error.message : 'Profile settings could not be saved.',
				section: 'settings'
			});
		}
	},
	uploadMedia: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const kind = String(form.get('kind') ?? '');
		const file = form.get('file');
		if (!(file instanceof File) || !file.size) return fail(400, { message: 'Choose an image.' });
		const maximum = kind === 'avatar' || kind === 'clan-logo' ? 4 * 1024 * 1024 : 10 * 1024 * 1024;
		if (file.size > maximum) {
			return fail(400, { message: `Image exceeds the ${maximum / 1024 / 1024} MB limit.` });
		}
		try {
			await apiFetch(
				fetch,
				`/me/media/${encodeURIComponent(kind)}`,
				{
					method: 'POST',
					headers: { 'content-type': file.type },
					body: await file.arrayBuffer()
				},
				token
			);
			return { success: true, message: 'Image uploaded.' };
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message: error instanceof ApiError ? error.message : 'Image upload failed.'
			});
		}
	},
	password: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const currentPassword = String(form.get('currentPassword') ?? '');
		const newPassword = String(form.get('newPassword') ?? '');
		const confirmation = String(form.get('confirmation') ?? '');
		if (!currentPassword || newPassword.length < 8) {
			return fail(400, {
				message: 'Enter your current password and a new password of at least 8 characters.'
			});
		}
		if (newPassword !== confirmation) return fail(400, { message: 'New passwords do not match.' });
		return mutate(
			fetch,
			'/auth/change-password',
			'POST',
			{ currentPassword, newPassword, revokeOtherSessions: true },
			token
		);
	},
	claim: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const profileUserId = String(form.get('profileUserId') ?? '').trim();
		const proofUrl = String(form.get('proofUrl') ?? '').trim();
		const message = String(form.get('message') ?? '').trim();
		if (!profileUserId || !proofUrl) {
			return fail(400, { message: 'Select a player profile and provide a proof URL.' });
		}
		return mutate(fetch, '/profile-claims', 'POST', { profileUserId, proofUrl, message }, token);
	},
	deleteAccount: async ({ request, cookies, fetch }) => {
		const token = requireToken(cookies.get('zr_session'));
		const form = await request.formData();
		const confirmation = String(form.get('confirmation') ?? '');
		const password = String(form.get('password') ?? '');
		if (confirmation !== 'DELETE' || !password) {
			return fail(400, { message: 'Type DELETE and enter your password to remove the account.' });
		}
		try {
			await apiRequest(
				fetch,
				'/me/account',
				{ method: 'DELETE', body: JSON.stringify({ confirmation, password }) },
				token
			);
		} catch (error) {
			return fail(error instanceof ApiError ? error.status : 502, {
				message: error instanceof ApiError ? error.message : 'The account could not be deleted.'
			});
		}
		cookies.delete('zr_session', { path: '/' });
		redirect(303, '/');
	}
};

function optionalMediaFile(
	value: FormDataEntryValue | null,
	kind: 'avatar' | 'profile-background'
): { file: File | null; type: string } | { error: string } {
	if (!(value instanceof File) || value.size === 0) return { file: null, type: '' };
	const maximum = kind === 'avatar' ? 4 * 1024 * 1024 : 10 * 1024 * 1024;
	if (value.size > maximum) {
		return {
			error: `${kind === 'avatar' ? 'Profile picture' : 'Profile background'} exceeds the ${
				maximum / 1024 / 1024
			} MB limit.`
		};
	}
	const type = mediaType(value);
	if (!type) return { error: 'Images must be JPEG, PNG, WebP, or GIF files.' };
	return { file: value, type };
}

function mediaType(file: File): string | null {
	const type = file.type.toLowerCase() === 'image/x-gif' ? 'image/gif' : file.type.toLowerCase();
	if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return type;
	const extension = file.name.toLowerCase().split('.').pop();
	return extension === 'jpg' || extension === 'jpeg'
		? 'image/jpeg'
		: extension === 'png'
			? 'image/png'
			: extension === 'webp'
				? 'image/webp'
				: extension === 'gif'
					? 'image/gif'
					: null;
}

function profileHex(value: FormDataEntryValue | null): string | null {
	const color = String(value ?? '')
		.trim()
		.toLowerCase();
	return /^#[0-9a-f]{6}$/.test(color) ? color : null;
}

async function uploadProfileMedia(
	fetcher: typeof fetch,
	token: string,
	kind: 'avatar' | 'profile-background',
	file: File,
	type: string
) {
	await apiFetch(
		fetcher,
		`/me/media/${encodeURIComponent(kind)}`,
		{ method: 'POST', headers: { 'content-type': type }, body: await file.arrayBuffer() },
		token
	);
}

async function optional<T>(fetcher: typeof fetch, path: string, token: string) {
	try {
		return { data: await apiRequest<T>(fetcher, path, {}, token), unavailable: false };
	} catch {
		return { data: null, unavailable: true };
	}
}
