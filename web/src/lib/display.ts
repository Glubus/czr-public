export function playerInitials(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}

export function categoryVariantLabel(rules: Record<string, unknown>): string | null {
	const value = rules.zwrSubrecord;
	if (typeof value !== 'string' || !value.trim()) return null;
	if (['all', 'default'].includes(value.trim().toLowerCase())) return null;
	if (
		/^(custom|official|uem)-.*-(bo1|bo2|bo3|bo4|bocw|bo6|bo7|waw|aw|iw|wwii|ghosts)-all$/i.test(
			value.trim()
		)
	)
		return null;
	return value
		.split('-')
		.filter(Boolean)
		.map((part) => {
			const normalized = part.toLowerCase();
			if (normalized === 'gobblegum') return 'GobbleGum';
			return normalized.charAt(0).toUpperCase() + normalized.slice(1);
		})
		.join(' ');
}

export function formatDuration(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
		: `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatRecordScore(
	scoreValue: number,
	scoreType: string,
	runDurationMs: number | null = null
): string {
	if (scoreType === 'time') return formatDuration(runDurationMs ?? scoreValue);
	const value = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(scoreValue);
	return scoreType === 'round' ? `Round ${value}` : value;
}
