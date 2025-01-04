
import { writable } from 'svelte/store';

// Create an empty game state
export const gameState = writable({
  
});

gameState.subscribe((newValue) => {
    // change the sate of the game

    console.log("Game state changed")

});