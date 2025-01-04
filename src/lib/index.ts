// Reexport your entry components here

import KBase from "./components/KBase.svelte";

import { Koppelia } from "./scripts/koppelia.js";
import { Console } from "./scripts/console.js";
import { Request } from "./scripts/request.js";
import { Device } from "./scripts/device.js";

import { updateRoute, routeType } from './stores/routeStore.js'
import { gameState } from "./stores/stateStore.js";



export { KBase }   // Compoenents

export { updateRoute, routeType, Koppelia, Console, Request, Device, gameState };    //  libraries and stores