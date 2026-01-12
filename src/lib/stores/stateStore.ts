
import { writable } from 'svelte/store';
import { logger } from '../scripts/logger.js';

// Create an empty game state
export const gameState = writable({
  
});

gameState.subscribe((newValue) => {
    // change the sate of the game

    logger.log("Game state changed")

});