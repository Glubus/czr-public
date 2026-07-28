import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { cleanupE2eFixtures, executeDatabaseSql } from './database';

const password = 'E2e-test-password-123';
const browserOrigin = process.env.E2E_BASE_URL ?? 'http://localhost:8888';

type User = { id: string; email: string; name: string };
type Catalog = {
	game: { id: number; slug: string; name: string };
	map: { id: number; name: string };
	category: { id: number; slug: string; name: string };
	assignment: { id: number };
};

async function json<T>(response: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
	expect(response.ok(), await response.text()).toBeTruthy();
	return (await response.json()) as T;
}

async function createUser(
	request: APIRequestContext,
	name: string,
	email: string,
	roles: string[]
): Promise<User> {
	const result = await json<{ user: { id: string } }>(
		await request.post('/v1/auth/sign-up', {
			data: { name, email, password },
			headers: { origin: browserOrigin }
		})
	);
	const roleJson = JSON.stringify(roles).replaceAll("'", "''");
	const safeEmail = email.replaceAll("'", "''");
	executeDatabaseSql(
		`UPDATE users SET email_verified = true, roles = '${roleJson}'::jsonb WHERE email = '${safeEmail}'`
	);
	return { id: result.user.id, email, name };
}

async function signInToken(request: APIRequestContext, user: User): Promise<string> {
	const response = await request.post('/v1/auth/sign-in', {
		data: { email: user.email, password },
		headers: { origin: browserOrigin }
	});
	expect(response.ok(), await response.text()).toBeTruthy();
	const token = response.headers()['set-auth-token'];
	expect(token).toBeTruthy();
	return token;
}

async function apiPost<T>(
	request: APIRequestContext,
	path: string,
	token: string,
	data: Record<string, unknown>
): Promise<T> {
	return json<T>(await request.post(path, { data, headers: { authorization: `Bearer ${token}` } }));
}

async function createCatalog(
	request: APIRequestContext,
	token: string,
	suffix: string
): Promise<Catalog> {
	const game = await apiPost<Catalog['game']>(request, '/v1/admin/games', token, {
		slug: `e2e-game-${suffix}`,
		name: `E2E Game ${suffix}`,
		shortName: 'E2E',
		releaseYear: 2026
	});
	const map = await apiPost<Catalog['map']>(request, '/v1/admin/maps', token, {
		gameId: game.id,
		slug: `e2e-map-${suffix}`,
		name: `E2E Map ${suffix}`,
		type: 'custom',
		status: 'published'
	});
	const category = await apiPost<Catalog['category']>(request, '/v1/admin/categories', token, {
		slug: `e2e-round-${suffix}`,
		name: `E2E High Round ${suffix}`,
		scoreType: 'round',
		rankingDirection: 'higher_is_better'
	});
	const assignment = await apiPost<Catalog['assignment']>(
		request,
		'/v1/admin/category-assignments',
		token,
		{
			categoryId: category.id,
			gameId: game.id,
			mapId: map.id,
			specificRules: { gobblegum: 'classic' }
		}
	);
	return { game, map, category, assignment };
}

async function signInThroughUi(page: Page, user: User) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(user.email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('.account-menu summary')).toContainText(user.name);
}

async function selectSearchOption(page: Page, testId: string, option: string) {
	const trigger = searchSelectTrigger(page, testId);
	await trigger.click();
	const choice = page.getByRole('option').filter({ hasText: option });
	await expect(choice).toBeVisible();
	await choice.getByRole('button').click();
	await expect(trigger).toContainText(option);
}

function searchSelectTrigger(page: Page, testId: string) {
	return page.getByTestId(testId).locator(':scope > button');
}

test.beforeEach(() => cleanupE2eFixtures());
test.afterEach(() => cleanupE2eFixtures());

test('login → submit → moderation → exact and global leaderboards', async ({
	page,
	request,
	context
}) => {
	test.setTimeout(90_000);
	const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const admin = await createUser(request, `E2E Admin ${suffix}`, `admin-${suffix}@example.test`, [
		'ROLE_ADMIN'
	]);
	const player = await createUser(
		request,
		`E2E Player ${suffix}`,
		`player-${suffix}@example.test`,
		['ROLE_USER']
	);
	const adminToken = await signInToken(request, admin);
	const catalog = await createCatalog(request, adminToken, suffix);

	await signInThroughUi(page, player);
	await page.goto('/submit');
	await selectSearchOption(page, 'submit-game-select', catalog.game.name);
	await expect(searchSelectTrigger(page, 'submit-map-select')).toBeEnabled();
	await selectSearchOption(page, 'submit-map-select', catalog.map.name);
	await page.getByText(catalog.category.name, { exact: false }).click();
	await page.getByRole('button', { name: 'Continue' }).click();
	await page.getByLabel('Score').fill('75');
	await page.getByLabel('Duration').fill('01:23:45');
	await page.getByLabel('Video proof').fill('https://www.youtube.com/watch?v=e2e-launch-journey');
	await page.getByRole('button', { name: 'Review' }).click();
	await expect(page.getByRole('heading', { name: 'Review submission' })).toBeVisible();
	await page.getByRole('button', { name: 'Submit record' }).click();
	await expect(page.getByRole('heading', { name: 'Your run is in the queue.' })).toBeVisible();
	await page.getByRole('link', { name: 'Track submission' }).click();
	await expect(page.getByText(catalog.map.name, { exact: true })).toBeVisible();
	await expect(page.getByText('pending', { exact: true })).toBeVisible();

	const cookies = await context.cookies();
	const playerToken = cookies.find((cookie) => cookie.name === 'zr_session')?.value;
	expect(playerToken).toBeTruthy();
	const ownSubmissions = await request.get('/v1/me/submissions?page=0', {
		headers: { authorization: `Bearer ${playerToken}` }
	});
	const ownBody = await json<{
		entries: Array<{ submission: { id: number }; map: { id: number } }>;
	}>(ownSubmissions);
	const submission = ownBody.entries.find((entry) => entry.map.id === catalog.map.id)?.submission;
	expect(submission).toBeTruthy();
	const submissionId = submission!.id;

	await context.clearCookies();
	await signInThroughUi(page, admin);
	await page.goto(`/admin/submissions/${submissionId}`);
	await expect(page.getByRole('heading', { name: catalog.map.name })).toBeVisible();
	await expect(page.getByText('Current board')).toBeVisible();
	await page.getByRole('button', { name: 'Approve record' }).click();
	await expect(page).toHaveURL(/\/admin\?status=pending/);
	await page.goto(`/admin/submissions/${submissionId}`);
	await expect(page.getByText('verified', { exact: true })).toBeVisible();

	await page.goto(
		`/maps/${catalog.map.id}/categories/${catalog.category.id}?assignment_id=${catalog.assignment.id}&player_count=1`
	);
	await expect(page).toHaveURL(
		new RegExp(`/maps/${catalog.map.id}/categories/${catalog.category.id}`)
	);
	await expect(page.getByText(player.name, { exact: true })).toBeVisible();
	await expect(page.getByText('Round 75', { exact: true })).toBeVisible();

	await page.goto(
		`/leaderboard?view=records&game=${catalog.game.slug}&categories=${catalog.category.slug}`
	);
	await expect(page.getByText(catalog.map.name, { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: player.name, exact: true })).toBeVisible();
});
