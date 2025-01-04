<script lang="ts">
    import { routeType } from '../stores/routeStore.js'
    $: route = $routeType;

</script>

<slot {route}/>

