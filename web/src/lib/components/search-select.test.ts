import { describe, expect, it } from 'vitest';
import { filterSelectItems, type SelectItem } from './search-select';

const maps: SelectItem[] = [
	{ value: '1', label: 'Origins', tags: ['official', 'zombie'] },
	{ value: '2', label: 'Demon Within', tags: ['official', 'non-zombie'] },
	{ value: '3', label: 'Rainy Death', tags: ['community', 'zombie'] }
];

describe('filterSelectItems', () => {
	it('combines is: filters', () => {
		expect(filterSelectItems(maps, 'is:official is:zombie').map((item) => item.label)).toEqual([
			'Origins'
		]);
	});

	it('supports text together with aliases', () => {
		expect(filterSelectItems(maps, 'rainy is:custom').map((item) => item.label)).toEqual([
			'Rainy Death'
		]);
		expect(filterSelectItems(maps, 'is:offical is:zombies')).toHaveLength(1);
	});
});
