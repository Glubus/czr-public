const INTERNAL_ORIGIN = 'https://internal.invalid';

function containsControlCharacter(value: string) {
	return Array.from(value).some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint <= 0x1f || codePoint === 0x7f;
	});
}

/**
 * Returns a same-origin application path or the supplied fallback.
 *
 * URL parsing is required here because browsers treat backslashes as path
 * separators in special URLs. Prefix checks alone can therefore allow an
 * external redirect such as `/\example.com`.
 */
export function safeRedirectPath(value: string | null, fallback = '/') {
	if (
		!value?.startsWith('/') ||
		value.includes('\\') ||
		value.toLowerCase().includes('%5c') ||
		containsControlCharacter(value)
	) {
		return fallback;
	}
	try {
		const destination = new URL(value, INTERNAL_ORIGIN);
		if (destination.origin !== INTERNAL_ORIGIN) return fallback;
		return `${destination.pathname}${destination.search}${destination.hash}`;
	} catch {
		return fallback;
	}
}
