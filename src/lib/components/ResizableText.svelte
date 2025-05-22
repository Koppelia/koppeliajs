<script lang="ts">
    import { routeType } from '../stores/routeStore.js';
	import { Koppelia } from '../scripts/koppelia.js';

	export let id: string = '';
    export let defaultFontSize: number = 10;

	$: fontSize = defaultFontSize;

	let koppelia = Koppelia.instance;
	
	koppelia.onReady(async () => {
		await koppelia.registerNewResizableText(id, defaultFontSize, (newFontSize: number) => {
			fontSize = newFontSize;
		});
	});

</script>

<div class="resizable-text" id="resizable-text-{id}" style="font-size: {fontSize}px;">
    <slot />
</div>

<style>

</style>