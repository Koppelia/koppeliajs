<script lang="ts">
    export let text: String;
    export let callback: () => void;

</script>

<div class="button" on:click={callback}>
    <p class="luciole">
        {text}
    </p>
</div>

<style>
    .button {
        background-color: #245bec;
        display: flex;
        padding: 15px;
        border-radius: 28px;
        margin: 10px;
        z-index: 1;
    }

    .button p {
        color: white;
        margin: auto;
        padding: 0;
        font-size: 22px;
    }
</style>
