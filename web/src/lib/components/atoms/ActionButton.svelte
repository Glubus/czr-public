<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		children,
		type = 'submit',
		name = undefined,
		value = undefined,
		variant = 'primary',
		size = 'regular',
		full = true,
		arrow = true,
		disabled = false,
		busy = false
	}: {
		children: import('svelte').Snippet;
		type?: HTMLButtonAttributes['type'];
		name?: string;
		value?: string;
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'compact' | 'regular';
		full?: boolean;
		arrow?: boolean;
		disabled?: boolean;
		busy?: boolean;
	} = $props();
</script>

<button
	{type}
	{name}
	{value}
	{disabled}
	aria-busy={busy}
	class:compact={size === 'compact'}
	class:fit={!full}
	class:secondary={variant === 'secondary'}
	class:danger={variant === 'danger'}
	class:ghost={variant === 'ghost'}
>
	<span class="label"
		>{#if busy}<span class="spinner" aria-hidden="true"></span>{/if}{@render children()}</span
	>
	{#if arrow}<span aria-hidden="true">→</span>{/if}
</button>

<style>
	button {
		display: flex;
		width: 100%;
		height: 3.3rem;
		align-items: center;
		justify-content: space-between;
		margin-top: 1.5rem;
		padding: 0 1.1rem;
		border: 0;
		background: var(--signal);
		color: #fff;
		font-size: 0.72rem;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	button.fit {
		width: auto;
		margin-top: 0;
	}
	button.compact {
		height: 2.5rem;
		padding: 0 0.85rem;
		font-size: 0.62rem;
	}
	button.secondary {
		border: 1px solid var(--line-strong);
		background: var(--canvas-soft);
		color: var(--ink);
	}
	button.danger {
		border: 1px solid color-mix(in srgb, #d35c55 55%, var(--line));
		background: color-mix(in srgb, #d35c55 12%, var(--canvas-soft));
		color: #e98179;
	}
	button.ghost {
		border: 1px solid var(--line);
		background: transparent;
		color: var(--muted);
	}
	button:disabled {
		cursor: wait;
		opacity: 0.58;
	}
	.label {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}
	.spinner {
		width: 0.75rem;
		height: 0.75rem;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 650ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
</style>
