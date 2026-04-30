<script lang="ts">
	import { routeType } from '../stores/routeStore.js';
	import { Koppelia } from '../scripts/koppelia.js';
	import { onDestroy } from 'svelte';

	export let id: string = '';
	export let defaultFontSize: number = 10;

	$: fontSize = defaultFontSize;
	$: callbackId = "";

	let koppelia = Koppelia.instance;

	koppelia.onReady(async () => {
		let resizableTexts = await koppelia.getResizableTexts();
		let resizableExist = false;
		for (let rt of resizableTexts) {
			if (rt.id !== undefined && rt.id == id) {
				if (rt.fontSize !== undefined) {
					fontSize = rt.fontSize;
				}
				resizableExist = true;
				break;
			}
		}
		if (!resizableExist) {
			await koppelia.registerNewResizableText(id, defaultFontSize);
		}
		callbackId = koppelia.onResizableTextChanged(id, (newFontSize: number) => {
			fontSize = newFontSize;
		});
	});

	onDestroy(() => {
		koppelia.unsubResizableText(callbackId);
	});
</script>

<div class="resizable-text" id="resizable-text-{id}" style="font-size: {fontSize}px;">
	<slot />
</div>

<style>
</style>