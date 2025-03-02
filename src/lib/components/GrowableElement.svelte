<script lang="ts">
	import { routeType } from '../stores/routeStore.js';
	import { Koppelia } from '../scripts/koppelia.js';

	export let id: string = '';

	$: grownClass = '';

	let koppelia = Koppelia.instance;
	
	koppelia.onReady(async () => {
		await koppelia.registerNewGrowableElement(id, (grown: boolean) => {
			grownClass = grown ? 'top-growable-grown' : '';
		});
	});

	function onElementClick() {
		koppelia.updateGrowableElement(id, true);
	}

	function onCloseGrown() {
		koppelia.updateGrowableElement(id, false);
	}
</script>

<button {id} on:click={onElementClick}>
	<slot />
</button>

<div class="top-growable {grownClass}" id="top-growable-{id}">
	{#if $routeType == 'controller'}
		<button on:click={onCloseGrown} class="top-growable-close-button"> x </button>
	{/if}

	<slot />
</div>

<style>
	.top-growable {
		width: 90%;
		height: 90%;
		z-index: 99999;
		position: absolute;
		top: 5%;
		left: 5%;
		border: 1px solid #362a24;
		background-color: antiquewhite;
		margin: auto;
		display: none;
	}

	.top-growable-close-button {
		position: absolute;
		left: 5px;
		top: 5px;
		color: #362a24;
	}

	.top-growable-grown {
		display: flex;
	}
</style>
