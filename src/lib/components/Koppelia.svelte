<script lang="ts">
    import { routeType } from '../stores/routeStore.js';
</script>

<div class={$routeType}>
    <slot />
</div>

<style>

</style>