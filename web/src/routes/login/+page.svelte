<script lang="ts">
	import { resolve } from '$app/paths';
	import ActionButton from '$lib/components/atoms/ActionButton.svelte';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import FormField from '$lib/components/atoms/FormField.svelte';
	import AuthSplitLayout from '$lib/components/organisms/AuthSplitLayout.svelte';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Sign in - Zombies Records</title></svelte:head>
<AuthSplitLayout
	title="SIGN IN."
	description="Track your records, follow players and submit new runs."
	panelTitle="Welcome back"
	>{#if form?.message}<FormAlert message={form.message} />{/if}
	<form method="POST">
		<FormField
			label="Email"
			id="email"
			type="email"
			value={form?.email ?? ''}
			autocomplete="email"
		/><FormField label="Password" id="password" type="password" autocomplete="current-password" /><a
			class="forgot"
			href={resolve('/forgot-password')}>Forgot password?</a
		><ActionButton>Sign in</ActionButton>
	</form>
	{#snippet footer()}New here? <a href={resolve('/register')}>Create an account</a
		>{/snippet}</AuthSplitLayout
>

<style>
	.forgot {
		justify-self: end;
		margin-top: 0.7rem;
		color: var(--muted);
		font-size: 0.68rem;
		text-decoration: none;
	}
	.forgot:hover {
		color: var(--ink);
	}
</style>
