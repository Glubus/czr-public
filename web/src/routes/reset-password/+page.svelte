<script lang="ts">
	import { resolve } from '$app/paths';
	import ActionButton from '$lib/components/atoms/ActionButton.svelte';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import FormField from '$lib/components/atoms/FormField.svelte';
	import CenteredAuthCard from '$lib/components/organisms/CenteredAuthCard.svelte';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Choose a password - Zombies Records</title></svelte:head>
{#if form?.success}<CenteredAuthCard eyebrow="Account recovery" title="PASSWORD UPDATED."
		><a href={resolve('/login')}>Sign in →</a></CenteredAuthCard
	>{:else if !data.validToken}<CenteredAuthCard eyebrow="Account recovery" title="LINK INVALID."
		><a href={resolve('/forgot-password')}>Request another link →</a></CenteredAuthCard
	>{:else}<CenteredAuthCard eyebrow="Account recovery" title="NEW PASSWORD."
		>{#if form?.message}<FormAlert message={form.message} />{/if}
		<form method="POST">
			<FormField
				label="New password"
				id="password"
				name="password"
				type="password"
				minlength={8}
				autocomplete="new-password"
			/><FormField
				label="Confirm password"
				id="confirmation"
				name="confirmation"
				type="password"
				minlength={8}
				autocomplete="new-password"
			/><ActionButton>Update password</ActionButton>
		</form></CenteredAuthCard
	>{/if}
