<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		id,
		name = id,
		type = 'text',
		value = '',
		autocomplete = undefined,
		minlength = undefined,
		required = true
	}: {
		label: string;
		id: string;
		name?: string;
		type?: HTMLInputAttributes['type'];
		value?: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		minlength?: number;
		required?: boolean;
	} = $props();
</script>

<label for={id}
	>{label}<input {id} {name} {type} {value} {autocomplete} {minlength} {required} /></label
>

<style>
	label {
		display: grid;
		gap: 0.5rem;
		margin-top: 1rem;
		color: var(--muted);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	input {
		height: 3.2rem;
		padding: 0 1rem;
		border: 1px solid var(--line-strong);
		border-radius: 0;
		background: var(--canvas-soft);
		color: var(--ink);
	}
</style>
