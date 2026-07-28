import type { CategoryForMap } from '$lib/types';

export type EntryDraft = {
	assignmentId: number;
	score: string;
	duration: string;
};

export type SelectedEntry = EntryDraft & {
	category: CategoryForMap | undefined;
};
