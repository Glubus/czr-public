import { cleanupE2eFixtures } from './database';

export default function globalTeardown() {
	cleanupE2eFixtures();
}
