<script lang="ts">
	let { message, kind = 'error' }: { message: string; kind?: 'error' | 'success' } = $props();
</script>

<div class:success={kind === 'success'} role={kind === 'error' ? 'alert' : 'status'}>{message}</div>

<style>
	div {
		margin-top: 1rem;
		padding: 0.8rem 1rem;
		border: 1px solid #783322;
		background: #28140f;
		color: #f3a58f;
		font-size: 0.75rem;
	}
	.success {
		border-color: #3c7044;
		background: #102517;
		color: #9ee0a8;
	}
</style>
