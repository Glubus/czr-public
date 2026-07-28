export type SelectItem = {
	value: string;
	label: string;
	meta?: string;
	keywords?: string;
	group?: string;
	tags?: string[];
};

const TAG_ALIASES: Record<string, string> = {
	offical: 'official',
	zombies: 'zombie',
	nonzombie: 'non-zombie',
	'non-zombies': 'non-zombie',
	custom: 'community'
};

function normalizeTag(value: string): string {
	const normalized = value.toLocaleLowerCase().replaceAll('_', '-');
	return TAG_ALIASES[normalized] ?? normalized;
}

export function filterSelectItems(items: SelectItem[], query: string): SelectItem[] {
	const requiredTags = [...query.matchAll(/(?:^|\s)is:([^\s]+)/gi)].map((match) =>
		normalizeTag(match[1] ?? '')
	);
	const text = query
		.replace(/(?:^|\s)is:[^\s]+/gi, ' ')
		.trim()
		.toLocaleLowerCase();

	return items.filter((item) => {
		const tags = new Set((item.tags ?? []).map(normalizeTag));
		if (!requiredTags.every((tag) => tags.has(tag))) return false;
		if (!text) return true;
		return `${item.label} ${item.meta ?? ''} ${item.keywords ?? ''} ${item.group ?? ''}`
			.toLocaleLowerCase()
			.includes(text);
	});
}
