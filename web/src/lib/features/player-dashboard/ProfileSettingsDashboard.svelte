<script lang="ts">
	import { enhance } from '$app/forms';
	import { onDestroy } from 'svelte';
	import ClaimProfileSearch from '$lib/components/organisms/ClaimProfileSearch.svelte';
	import CountrySelectContent from '$lib/components/CountrySelectContent.svelte';
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import type { SelectItem } from '$lib/components/search-select';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData } from '../../../routes/me/$types';
	import { countries } from '$lib/countries';
	import SearchSelect from '$lib/components/SearchSelect.svelte';

	let { user, claims }: Pick<PageData, 'user' | 'claims'> = $props();
	let avatarPreview = $state<string | null>(null);
	let backgroundPreview = $state<string | null>(null);
	let avatarObjectUrl: string | null = null;
	let backgroundObjectUrl: string | null = null;
	const presets = [
		'#e45735',
		'#e9b949',
		'#b8e840',
		'#2398c5',
		'#28c4b7',
		'#8b5cf6',
		'#e8468b',
		'#d9364f'
	];
	function initialProfileColor() {
		return user?.profileColor?.toLowerCase() === '#101311'
			? '#e45735'
			: (user?.profileColor ?? '#e45735');
	}
	function initialCountryCode() {
		return user?.countryCode ?? '';
	}
	let profileColor = $state(initialProfileColor());
	let countryCode = $state(initialCountryCode());
	const countryItems = [
		{ value: '', label: 'Not specified', meta: 'No national ranking' },
		...countries.map((country) => ({
			value: country.code,
			label: country.name,
			meta: country.code
		}))
	];
	let isAdmin = $derived(user?.roles.includes('ROLE_ADMIN') ?? false);
	let activeClaim = $derived(
		claims.find((claim) => ['pending', 'approved'].includes(claim.status))
	);

	function selectMedia(kind: 'avatar' | 'background', event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		const current = kind === 'avatar' ? avatarObjectUrl : backgroundObjectUrl;
		if (current) URL.revokeObjectURL(current);
		const preview = file ? URL.createObjectURL(file) : null;
		if (kind === 'avatar') {
			avatarObjectUrl = preview;
			avatarPreview = preview;
		} else {
			backgroundObjectUrl = preview;
			backgroundPreview = preview;
		}
	}

	function clearPreviews() {
		if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
		if (backgroundObjectUrl) URL.revokeObjectURL(backgroundObjectUrl);
		avatarObjectUrl = backgroundObjectUrl = null;
		avatarPreview = backgroundPreview = null;
	}

	const enhanceSettings: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false, invalidateAll: result.type === 'success' });
			if (result.type === 'success') clearPreviews();
		};
	};

	onDestroy(clearPreviews);
</script>

{#snippet countrySelection(item: SelectItem)}
	{#if item.value}
		<CountrySelectContent code={item.value} name={item.label} />
	{:else}
		<span>{item.label}</span>
	{/if}
{/snippet}

{#snippet countryOption(item: SelectItem, selected: boolean)}
	{#if item.value}
		<CountrySelectContent code={item.value} name={item.label} {selected} showMarker />
	{:else}
		<span>{item.label}</span>
	{/if}
{/snippet}

<div class="grid">
	<section class="panel profile">
		<header>
			<div>
				<span>Identity</span>
				<h2>Public profile</h2>
			</div>
		</header>
		<form
			method="POST"
			action="?/profileSettings"
			enctype="multipart/form-data"
			use:enhance={enhanceSettings}
		>
			<label>Display name<input name="name" value={user?.name} required maxlength="80" /></label>
			<div class="country-field">
				<SearchSelect
					label="Country"
					items={countryItems}
					value={countryCode}
					name="countryCode"
					placeholder="Choose your country"
					searchPlaceholder="Search a country…"
					emptyText="No country found"
					onselect={(value) => (countryCode = value)}
					selection={countrySelection}
					option={countryOption}
				/>
				<small
					>Your country determines your national ranking. {isAdmin
						? 'Administrators can change it at any time.'
						: 'Once changed, it is locked for one month.'}</small
				>
			</div>
			<div class="media-grid">
				<label class="picker"
					><span class="avatar"
						><PlayerAvatar
							name={user?.name ?? ''}
							image={avatarPreview ?? user?.image}
							size="large"
						/></span
					><span
						><strong>Profile picture</strong><small>Image or animated GIF · max 4 MB</small><b
							>Choose picture</b
						></span
					><input
						name="avatar"
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif"
						onchange={(event) => selectMedia('avatar', event)}
					/></label
				>
				<label class="picker"
					><span class="background"
						>{#if backgroundPreview ?? user?.backgroundImage}<img
								src={backgroundPreview ?? user?.backgroundImage ?? ''}
								alt="Profile background preview"
							/>{:else}<i>No background selected</i>{/if}</span
					><span
						><strong>Profile background</strong><small>Image or animated GIF · max 10 MB</small><b
							>Choose background</b
						></span
					><input
						name="background"
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif"
						onchange={(event) => selectMedia('background', event)}
					/></label
				>
			</div>
			<section class="theme">
				<div>
					<span>Profile glow</span><strong>A subtle accent</strong><small
						>Your profile keeps the site design; only its header shadow changes.</small
					>
				</div>
				<div class="preview" style:--preview-glow={profileColor}>
					{#if backgroundPreview ?? user?.backgroundImage}<img
							src={backgroundPreview ?? user?.backgroundImage ?? ''}
							alt=""
						/>{/if}<i></i>
					<div>
						<PlayerAvatar
							name={user?.name ?? ''}
							image={avatarPreview ?? user?.image}
							size="large"
						/><strong>{user?.name}</strong>
					</div>
				</div>
				<div class="presets" aria-label="Profile glow presets">
					{#each presets as color (color)}<button
							type="button"
							aria-label={color}
							aria-pressed={profileColor === color}
							class:active={profileColor === color}
							style:background={color}
							onclick={() => (profileColor = color)}
						></button>{/each}<label
						>Custom glow<input type="color" bind:value={profileColor} /></label
					>
				</div>
				<input type="hidden" name="profileColor" value={profileColor} /><input
					type="hidden"
					name="profileGradientEnabled"
					value="false"
				/><input type="hidden" name="profileGradientAngle" value="135" />
			</section>
			<footer>
				<span>Name, media, and profile glow are saved together.</span><button class="primary"
					>Save profile settings →</button
				>
			</footer>
		</form>
	</section>

	<section class="panel">
		<header>
			<div>
				<span>Security</span>
				<h2>Change password</h2>
			</div>
		</header>
		<form class="stack" method="POST" action="?/password">
			<label
				>Current password<input
					name="currentPassword"
					type="password"
					required
					autocomplete="current-password"
				/></label
			><label
				>New password<input
					name="newPassword"
					type="password"
					required
					minlength="8"
					autocomplete="new-password"
				/></label
			><label
				>Confirm new password<input
					name="confirmation"
					type="password"
					required
					minlength="8"
					autocomplete="new-password"
				/></label
			><button class="primary">Update password →</button>
		</form>
	</section>

	<section class="panel">
		<header>
			<div>
				<span>Imported history</span>
				<h2>Claim a player profile</h2>
			</div>
		</header>
		{#if activeClaim}
			<div class="claim-state">
				<strong
					>{activeClaim.status === 'approved'
						? 'Player profile claimed'
						: 'Claim under review'}</strong
				>
				<span>{activeClaim.profileExternalId}</span>
				<p>
					{activeClaim.status === 'approved'
						? 'This imported history is now attached to your account. An account can claim only one player profile.'
						: 'You already have an active request. You cannot submit another one while it is being reviewed.'}
				</p>
			</div>
		{:else}
			<p>
				Search for your player name, select the matching imported profile, and add proof that it
				belongs to you.
			</p>
			<form class="stack" method="POST" action="?/claim">
				<ClaimProfileSearch /><label
					>Proof URL<input name="proofUrl" type="url" required placeholder="https://…" /></label
				><label
					>Message<textarea
						name="message"
						maxlength="2000"
						placeholder="Optional context for moderators"></textarea></label
				><button class="primary">Request claim →</button>
			</form>
		{/if}
		{#if claims.length}<div class="claims">
				{#each claims as claim (claim.id)}<div>
						<strong>{claim.profileExternalId}</strong><span>{claim.status}</span>
					</div>{/each}
			</div>{/if}
	</section>

	<section class="panel danger">
		<header>
			<div>
				<span>Danger zone</span>
				<h2>Delete account</h2>
			</div>
		</header>
		<p>
			This removes your login and personal data. Verified leaderboard history is anonymized where
			retention is required.
		</p>
		<form class="stack" method="POST" action="?/deleteAccount">
			<label>Type DELETE<input name="confirmation" required pattern="DELETE" /></label><label
				>Password<input
					name="password"
					type="password"
					required
					autocomplete="current-password"
				/></label
			><button class="danger-button">Delete account</button>
		</form>
	</section>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}
	.panel {
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 1.25rem;
	}
	.profile {
		grid-column: 1 / -1;
	}
	header {
		margin-bottom: 1rem;
	}
	header span,
	.theme > div:first-child > span {
		color: var(--signal);
		font: 900 0.58rem monospace;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0.2rem 0 0;
		font-family: var(--font-display);
	}
	.profile form,
	.stack,
	label,
	.theme > div:first-child {
		display: grid;
		gap: 0.45rem;
	}
	input,
	textarea {
		width: 100%;
		border: 1px solid var(--line);
		background: var(--field);
		color: var(--text);
		padding: 0.75rem;
	}
	.country-field {
		display: grid;
		gap: 0.45rem;
	}
	.country-field > small {
		color: var(--muted);
		font-size: 0.62rem;
	}
	.media-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.8rem;
	}
	.picker {
		position: relative;
		grid-template-columns: auto 1fr;
		align-items: center;
		border: 1px solid var(--line);
		padding: 0.8rem;
		cursor: pointer;
	}
	.picker > span:last-of-type {
		display: grid;
		gap: 0.2rem;
	}
	.picker > input {
		position: absolute;
		opacity: 0;
		inset: 0;
		cursor: pointer;
	}
	.background {
		width: 9rem;
		height: 5rem;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: var(--field);
	}
	.background img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	small,
	p,
	footer > span {
		color: var(--muted);
	}
	.theme {
		display: grid;
		grid-template-columns: minmax(12rem, 0.6fr) 1fr;
		gap: 1rem;
		margin-top: 0.8rem;
		border: 1px solid var(--line);
		padding: 1rem;
	}
	.preview {
		position: relative;
		overflow: hidden;
		min-height: 9rem;
		background: #111;
		box-shadow: inset 0 -3rem 5rem color-mix(in srgb, var(--preview-glow), transparent 45%);
	}
	.preview > img,
	.preview > i {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.4;
	}
	.preview > div {
		position: absolute;
		inset: auto 1rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.presets {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.5rem;
	}
	.presets button {
		width: 2rem;
		height: 2rem;
		border: 2px solid transparent;
		border-radius: 50%;
	}
	.presets button.active {
		border-color: white;
	}
	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.8rem;
	}
	button {
		border: 1px solid var(--line);
		background: transparent;
		color: var(--text);
		padding: 0.7rem;
		cursor: pointer;
	}
	.primary {
		background: var(--signal);
		color: #101311;
		font-weight: 900;
	}
	.danger {
		border-color: #9d3543;
	}
	.danger-button {
		background: #9d3543;
		color: white;
	}
	.claims {
		margin-top: 1rem;
	}
	.claims div {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem;
		border-top: 1px solid var(--line);
	}
	.claim-state {
		display: grid;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--signal) 45%, var(--line));
		background: color-mix(in srgb, var(--signal) 8%, var(--surface));
	}
	.claim-state strong {
		color: var(--signal);
		font-family: var(--font-display);
		font-size: 1.2rem;
		text-transform: uppercase;
	}
	.claim-state span {
		font: 700 0.65rem monospace;
	}
	.claim-state p {
		margin: 0;
		color: var(--muted);
		font-size: 0.7rem;
	}
	@media (max-width: 800px) {
		.grid,
		.media-grid,
		.theme {
			grid-template-columns: 1fr;
		}
		.profile {
			grid-column: auto;
		}
	}
</style>
