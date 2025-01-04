// src/lib/routeStore.js (dans la librairie)
import { writable, get } from 'svelte/store';
import { page } from '$app/stores'

// Crée un store pour la route active
export const routeType = writable('');

// Cette fonction met à jour le store en fonction de la route
export function updateRoute() {

  const path = get(page).url.pathname

  console.log("updateRoue with path = ", path);

  if (path.includes('controller')) {
    routeType.set('controller');
    console.log(path, "CONTROLLER");
  } else if (path.includes('monitor')) {
    routeType.set('monitor');
    console.log(path, "MONITOR");
  } else {
    routeType.set('');
  }




}