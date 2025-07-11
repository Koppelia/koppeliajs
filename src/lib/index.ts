// Reexport your entry components here

import "./styles/fonts.css"

import KBase from "./components/KBase.svelte";
import GrowableElement from "./components/GrowableElement.svelte";
import Button from "./components/Button.svelte";
import ResizableText from "./components/ResizableText.svelte";

import { Koppelia } from "./scripts/koppelia.js";
import { Console } from "./scripts/console.js";
import { Message } from "./scripts/message.js";
import { Device } from "./scripts/device.js";
import { Play } from "./scripts/play.js";
import { Resident } from "./scripts/resident.js";

import { updateRoute, routeType } from './stores/routeStore.js';
import { audioManager  } from '.,/stores/audioManager.js';



export { KBase, GrowableElement, Button, ResizableText }   // Compoenents

export { updateRoute, routeType, Koppelia, Console, Message, Device, Play, audioManager, Resident};    //  libraries and stores