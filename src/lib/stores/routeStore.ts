import { get, writable } from "svelte/store";
import { page } from "$app/stores";
import { logger } from "../scripts/logger.js";

/**
 * A reactive Svelte store that holds the active route context of the application.
 * Developers can subscribe to this store to adapt UI or logic based on the current view.
 * * Possible values: 
 * - `"controller"`: If the user is on a controller interface.
 * - `"monitor"`: If the user is on a monitor interface.
 * - `""` (empty string): If the current route matches neither.
 */
export const routeType = writable("");

/**
 * Evaluates the current SvelteKit page URL and updates the `routeType` store accordingly.
 * This function should typically be called during layout initialization or whenever 
 * a route change is detected to ensure the store stays synchronized with the actual URL.
 */
export function updateRoute() {
  const path = get(page).url.pathname;

  logger.log("updateRoute with path = ", path);

  if (path.includes("controller")) {
    routeType.set("controller");
    logger.log(path, "CONTROLLER");
  } else if (path.includes("monitor")) {
    routeType.set("monitor");
    logger.log(path, "MONITOR");
  } else {
    routeType.set("");
  }
}



