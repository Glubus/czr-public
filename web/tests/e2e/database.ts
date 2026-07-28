import { execFileSync } from 'node:child_process';

export function executeDatabaseSql(sql: string) {
	const databaseService = process.env.E2E_DATABASE_SERVICE ?? 'postgres';
	const databaseUser = process.env.POSTGRES_USER ?? 'zwr';
	const databaseName = process.env.POSTGRES_DB ?? 'zwr';
	const composeArgs = process.env.E2E_COMPOSE_PROJECT
		? ['compose', '--project-name', process.env.E2E_COMPOSE_PROJECT]
		: ['compose'];
	execFileSync(
		'docker',
		[
			...composeArgs,
			'exec',
			'-T',
			databaseService,
			'psql',
			'-v',
			'ON_ERROR_STOP=1',
			'-U',
			databaseUser,
			'-d',
			databaseName,
			'-c',
			sql
		],
		{ stdio: 'pipe' }
	);
}

export function cleanupE2eFixtures() {
	executeDatabaseSql(`
		BEGIN;
		DELETE FROM best_records WHERE submission_id IN (
			SELECT submissions.id FROM submissions JOIN games ON games.id = submissions.game_id
			WHERE games.slug LIKE 'e2e-%'
		);
		DELETE FROM performance_point_snapshots WHERE source_submission_id IN (
			SELECT submissions.id FROM submissions JOIN games ON games.id = submissions.game_id
			WHERE games.slug LIKE 'e2e-%'
		);
		DELETE FROM submissions WHERE game_id IN (SELECT id FROM games WHERE slug LIKE 'e2e-%');
		DELETE FROM outbox_events WHERE actor_user_id IN (
			SELECT id FROM users WHERE email LIKE '%@example.test' OR name LIKE 'E2E %'
		);
		DELETE FROM maps WHERE game_id IN (SELECT id FROM games WHERE slug LIKE 'e2e-%');
		DELETE FROM games WHERE slug LIKE 'e2e-%';
		DELETE FROM categories WHERE slug LIKE 'e2e-%';
		DELETE FROM users WHERE email LIKE '%@example.test' OR name LIKE 'E2E %';
		DELETE FROM badge_definitions WHERE slug LIKE 'e2e-%';
		COMMIT;
	`);
}
