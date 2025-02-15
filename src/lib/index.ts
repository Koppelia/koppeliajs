// Reexport your entry components here

import KBase from "./components/KBase.svelte";
import GrowableElement from "./components/GrowableElement.svelte";

import { Koppelia } from "./scripts/koppelia.js";
import { Console } from "./scripts/console.js";
import { Message } from "./scripts/message.js";
import { Device } from "./scripts/device.js";
import { Play } from "./scripts/play.js";

import { updateRoute, routeType } from './stores/routeStore.js'
import { gameState } from "./stores/stateStore.js";



export { KBase }   // Compoenents

export { updateRoute, routeType, Koppelia, Console, Message, Device, gameState, Play, GrowableElement};    //  libraries and stores