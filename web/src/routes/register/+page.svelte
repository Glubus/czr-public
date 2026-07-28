<script lang="ts">
	import { resolve } from '$app/paths';
	import ActionButton from '$lib/components/atoms/ActionButton.svelte';
	import FormAlert from '$lib/components/atoms/FormAlert.svelte';
	import FormField from '$lib/components/atoms/FormField.svelte';
	import Eyebrow from '$lib/components/atoms/Eyebrow.svelte';
	import PageHero from '$lib/components/organisms/PageHero.svelte';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Create account - Zombies Records</title></svelte:head>
<div class="page">
	<PageHero compact eyebrow="Join the community" title="CREATE ACCOUNT." />
	<section>
		{#if form?.success}<div class="success">
				<span>✓</span>
				<h2>Account created</h2>
				<p>Your account for <strong>{form.email}</strong> is ready.</p>
				<a href={resolve('/login')}>Sign in →</a>
			</div>{:else}<header>
				<Eyebrow>Account / Register</Eyebrow>
				<h2>Create your player profile</h2>
			</header>
			{#if form?.message}<FormAlert message={form.message} />{/if}
			<form method="POST">
				<FormField
					label="Display name"
					id="name"
					value={form?.name ?? ''}
					autocomplete="nickname"
				/><FormField
					label="Email"
					id="email"
					type="email"
					value={form?.email ?? ''}
					autocomplete="email"
				/>
				<div class="passwords">
					<FormField
						label="Password"
						id="password"
						type="password"
						minlength={8}
						autocomplete="new-password"
					/><FormField
						label="Confirm password"
						id="confirmation"
						type="password"
						minlength={8}
						autocomplete="new-password"
					/>
				</div>
				<ActionButton>Create account</ActionButton>
				<p class="legal-consent">
					By creating an account, you agree to the <a href={resolve('/terms')}>Terms of Service</a>
					and acknowledge the <a href={resolve('/privacy')}>Privacy Policy</a>.
				</p>
			</form>
			<p class="switch">Already registered? <a href={resolve('/login')}>Sign in</a></p>{/if}
	</section>
</div>

<style>
	.page {
		padding: clamp(1rem, 4vw, 4rem);
	}
	.page > section {
		max-width: 52rem;
		padding: clamp(1.5rem, 4vw, 3rem);
		border: 1px solid var(--line);
		background: var(--panel);
	}
	h2 {
		margin: 0.6rem 0 1.5rem;
		font-family: var(--font-display);
		font-size: 2rem;
		font-style: italic;
	}
	form {
		display: grid;
	}
	.passwords {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	.switch,
	.success p,
	.legal-consent {
		color: var(--muted);
		font-size: 0.75rem;
	}
	.switch a,
	.success a,
	.legal-consent a {
		color: var(--ink);
		font-weight: 800;
	}
	.legal-consent {
		margin: 0.9rem 0 0;
		font-size: 0.58rem;
		line-height: 1.6;
	}
	.success {
		display: grid;
		min-height: 18rem;
		align-content: center;
	}
	.success > span {
		color: var(--signal);
		font-size: 2rem;
	}
	.success a {
		margin-top: 1rem;
		font-size: 0.72rem;
		text-transform: uppercase;
	}
	@media (max-width: 600px) {
		.passwords {
			grid-template-columns: 1fr;
		}
		.page {
			padding-bottom: 6rem;
		}
	}
</style>
