<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { filterSelectItems, type SelectItem } from './search-select';

	let {
		label,
		items,
		value = '',
		placeholder,
		searchPlaceholder = 'Search…',
		emptyText = 'No matches',
		disabled = false,
		required = false,
		name,
		testId,
		onselect,
		selection,
		option
	}: {
		label: string;
		items: SelectItem[];
		value?: string;
		placeholder: string;
		searchPlaceholder?: string;
		emptyText?: string;
		disabled?: boolean;
		required?: boolean;
		name?: string;
		testId?: string;
		onselect: (value: string) => void;
		selection?: Snippet<[item: SelectItem]>;
		option?: Snippet<[item: SelectItem, selected: boolean]>;
	} = $props();

	const componentId = $props.id();
	const triggerId = `${componentId}-trigger`;
	const listId = `${componentId}-list`;
	let root: HTMLDivElement;
	let trigger: HTMLButtonElement;
	let search = $state<HTMLInputElement>();
	let open = $state(false);
	let active = $state(0);
	let query = $state('');
	let selected = $derived(items.find((item) => item.value === value));
	let visible = $derived(filterSelectItems(items, query));

	async function show() {
		if (disabled) return;
		open = true;
		query = '';
		active = Math.max(
			0,
			visible.findIndex((item) => item.value === value)
		);
		await tick();
		search?.focus();
	}

	function hide(restoreFocus = false) {
		open = false;
		query = '';
		if (restoreFocus) void tick().then(() => trigger?.focus());
	}

	function choose(item: SelectItem) {
		onselect(item.value);
		hide(true);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			active = Math.min(active + 1, Math.max(visible.length - 1, 0));
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (event.key === 'Enter' && visible[active]) {
			event.preventDefault();
			choose(visible[active]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			hide(true);
		}
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (open && root && !root.contains(event.target as Node)) hide();
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div bind:this={root} data-testid={testId} class:disabled class:open class="search-select">
	<label for={triggerId}
		>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label
	>
	{#if name}<input type="hidden" {name} {value} />{/if}
	<button
		bind:this={trigger}
		id={triggerId}
		class:placeholder={!selected}
		type="button"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={listId}
		{disabled}
		onclick={() => (open ? hide() : show())}
		onkeydown={(event) => {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				void show();
			}
		}}
	>
		<span class="selection">
			{#if selected && selection}
				{@render selection(selected)}
			{:else}
				<strong>{selected?.label ?? placeholder}</strong>
				{#if selected?.meta}<small>{selected.meta}</small>{/if}
			{/if}
		</span>
		<i aria-hidden="true">⌄</i>
	</button>

	{#if open && !disabled}
		<div class="popover">
			<div class="search-box">
				<span aria-hidden="true">⌕</span>
				<input
					bind:this={search}
					type="search"
					bind:value={query}
					placeholder={searchPlaceholder}
					aria-label={`Search ${label.toLocaleLowerCase()}`}
					aria-controls={listId}
					autocomplete="off"
					oninput={() => (active = 0)}
					onkeydown={handleSearchKeydown}
				/>
			</div>
			<ul id={listId} role="listbox" aria-labelledby={triggerId}>
				{#each visible as item, index (item.value)}
					{#if item.group && item.group !== visible[index - 1]?.group}
						<li class="group" role="presentation">{item.group}</li>
					{/if}
					<li
						class:active={index === active}
						role="option"
						aria-selected={item.value === value}
						onpointerenter={() => (active = index)}
					>
						<button type="button" tabindex="-1" onclick={() => choose(item)}>
							{#if option}
								{@render option(item, item.value === value)}
							{:else}
								<span class="option-copy">
									<strong>{item.label}</strong>
									{#if item.meta}<small>{item.meta}</small>{/if}
								</span>
								<i aria-hidden="true">{item.value === value ? '✓' : '→'}</i>
							{/if}
						</button>
					</li>
				{/each}
				{#if visible.length === 0}<li class="empty">{emptyText}</li>{/if}
			</ul>
		</div>
	{/if}
</div>

<style>
	.search-select {
		position: relative;
		display: grid;
		min-width: 0;
		gap: 0.5rem;
	}
	.search-select > label {
		color: var(--muted);
		font-size: 0.58rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.search-select > label span {
		color: var(--signal);
	}
	.search-select > button {
		display: flex;
		width: 100%;
		min-height: 3.35rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 1rem;
		border: 1px solid var(--line-strong);
		border-radius: 0;
		background: var(--canvas-soft);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.search-select > button:hover,
	.open > button {
		border-color: var(--signal);
		background: var(--panel-hover);
	}
	.selection,
	.option-copy {
		display: grid;
		min-width: 0;
		gap: 0.2rem;
	}
	.selection strong,
	.option-copy strong {
		overflow: hidden;
		color: var(--ink);
		font-size: 0.76rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.selection small,
	.option-copy small {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.placeholder .selection strong {
		color: var(--muted);
		font-weight: 500;
	}
	.search-select > button > i {
		flex: 0 0 auto;
		color: var(--signal);
		font-size: 1rem;
		font-style: normal;
		transition: transform 160ms ease;
	}
	.open > button > i {
		transform: rotate(180deg);
	}
	.popover {
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		left: 0;
		z-index: 50;
		padding: 0.4rem;
		border: 1px solid var(--line-strong);
		background: #101311;
		box-shadow: 0 1.2rem 2.5rem rgba(0, 0, 0, 0.58);
	}
	.search-box {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		margin-bottom: 0.35rem;
		border: 1px solid var(--line);
		background: var(--panel);
	}
	.search-box:focus-within {
		border-color: var(--signal);
	}
	.search-box > span {
		padding-left: 0.75rem;
		color: var(--signal);
	}
	.search-box input {
		width: 100%;
		height: 2.8rem;
		padding: 0 0.75rem;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--ink);
	}
	.search-box input::placeholder {
		color: var(--muted);
	}
	ul {
		max-height: 19rem;
		margin: 0;
		padding: 0;
		overflow: auto;
		list-style: none;
	}
	li > button {
		display: flex;
		width: 100%;
		min-height: 3.4rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 0.8rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	li:hover > button,
	li.active > button {
		background: var(--panel-hover);
	}
	li[aria-selected='true'] > button {
		background: color-mix(in srgb, var(--signal) 10%, var(--panel));
	}
	li > button > i {
		color: var(--signal);
		font-size: 0.7rem;
		font-style: normal;
	}
	.group {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 0.6rem 0.8rem 0.45rem;
		border-top: 1px solid var(--line);
		background: #101311;
		color: var(--signal);
		font-family: monospace;
		font-size: 0.56rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.group:first-child {
		border-top: 0;
	}
	.empty {
		padding: 1.2rem;
		color: var(--muted);
		font-size: 0.68rem;
		text-align: center;
	}
	.disabled {
		opacity: 0.45;
	}
	.disabled > button {
		cursor: not-allowed;
	}
</style>
