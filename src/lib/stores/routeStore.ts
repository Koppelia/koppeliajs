// src/lib/routeStore.js (dans la librairie)
import { writable, get } from 'svelte/store';
import { page } from '$app/stores'
import { logger } from '../scripts/logger.js';

// Crée un store pour la route active
export const routeType = writable('');

// Cette fonction met à jour le store en fonction de la route
export function updateRoute() {

  const path = get(page).url.pathname

  logger.log("updateRoue with path = ", path);

  if (path.includes('controller')) {
    routeType.set('controller');
    logger.log(path, "CONTROLLER");
  } else if (path.includes('monitor')) {
    routeType.set('monitor');
    logger.log(path, "MONITOR");
  } else {
    routeType.set('');
  }




}