<script lang="ts">
	import { resolve } from '$app/paths';
	import ActionButton from '$lib/components/atoms/ActionButton.svelte';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import FormField from '$lib/components/atoms/FormField.svelte';
	import CenteredAuthCard from '$lib/components/organisms/CenteredAuthCard.svelte';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Reset password - Zombies Records</title></svelte:head>
{#if form?.success}<CenteredAuthCard
		eyebrow="Account recovery"
		title="CHECK YOUR INBOX."
		description={`If an account exists for ${form.email}, a reset link is on its way.`}
		><a href={resolve('/login')}>Back to sign in →</a></CenteredAuthCard
	>{:else}<CenteredAuthCard
		eyebrow="Account recovery"
		title="RESET PASSWORD."
		description="Enter the email linked to your player account."
		>{#if form?.message}<FormAlert message={form.message} />{/if}
		<form method="POST">
			<FormField
				label="Email"
				id="email"
				name="email"
				type="email"
				value={form?.email ?? ''}
				autocomplete="email"
			/><ActionButton>Send reset link</ActionButton>
		</form>
		<a href={resolve('/login')}>Back to sign in</a></CenteredAuthCard
	>{/if}
