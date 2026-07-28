export function parseRunDuration(value: string): number | null {
	const parts = value.trim().split(':').map(Number);
	if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
	if (parts.length > 3 || parts.some((part, index) => index > 0 && part >= 60)) return null;
	const seconds = parts.reduce((total, part) => total * 60 + part, 0);
	return seconds > 0 ? Math.round(seconds * 1000) : null;
}

export function isHttpProofUrl(value: string): boolean {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}
