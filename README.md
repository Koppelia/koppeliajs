# KoppeliaJS SDK 🎮

**The official SvelteKit SDK for the Koppelia Console: Building accessible, real-time, zero-overstimulation games for seniors.**

KoppeliaJS is a specialized framework designed to bridge the gap between game development and cognitive accessibility. It allows developers to create synchronized, asymmetric, multi-screen experiences tailored for retirement homes and senior care facilities. By leveraging SvelteKit, WebSockets, and our Filarmonic Master Server, KoppeliaJS synchronizes UI, shared state, and physical IoT hardware seamlessly.

---

## 🌟 The Koppelia Ecosystem (Context)

Koppelia is an asymmetric gaming console designed with a strict focus on cognitive accessibility and ergonomic physical interactions.

### The Screens
* 📺 **The Monitor (Players' Screen):** Plugged via HDMI to a TV. It displays **only essential information**. It is intentionally stripped of complex UI elements (no cursors, no complicated menus, no over-stimulation) to prevent cognitive overload for senior players.
* 📱 **The Controller (Animator's Tablet):** Connected via Wi-Fi. This is the control center for the animator. It features the game settings, scores, real-time difficulty adjustments, and hidden mechanics. It acts as the "Dungeon Master" interface.

### The Hardware & Backend
* 🕹️ **The Devices:** Accessible controllers connected via BLE to the console. They feature a single luminous button, an IMU (Inertial Measurement Unit to detect orientation/motion), and a modular design (e.g., they can be clipped to an exercise bike).
* 🖧 **Filarmonic (Master Server):** The core console server orchestrating Docker containers to spin up a dedicated web server for every game launch.

---

## 🚀 Getting Started

### 1. Initialize a New Game Project
We recommend using Node.js version 20 to manage dependencies.

```bash
npx sv create my-game
# Prompts:
# - Add to project: prettier, eslint
# - SvelteKit adapter: auto
# - Package manager: npm

cd my-game
npm install
npm run dev

# Install the KoppeliaJS SDK
npm install @momo2555/koppeliajs
```

### 2. Configure the Environment
Contact the administration to get your unique Game ID. Create an `.env` file at the root of your project:

```env
PUBLIC_GAME_ID=your-unique-game-id
PUBLIC_MOCE_ENV=dev
```

*Note: In your `package.json`, update the preview script to expose your host: `"preview": "vite preview --host 0.0.0.0"`.*

### 3. Basic Directory Structure
Koppelia relies on SvelteKit dynamic routing to serve both the Monitor and the Controller from the same codebase. Create the necessary files:

```bash
mkdir -p "src/routes/game/[type]/home"
touch "src/routes/game/[type]/home/+page.svelte"
touch "src/routes/+layout.svelte" 
```

---

## 📖 Core Concepts & APIs

The KoppeliaJS SDK abstracts complex WebSocket networking and IoT Bluetooth management into simple Svelte stores and TypeScript classes. Below is a comprehensive breakdown of every system, how it works, its full capabilities, and an example.

### 1. Smart Routing (`routeType`)

#### How it works & Capabilities
Because your codebase serves both the TV (Monitor) and the Tablet (Controller), the SDK provides a reactive Svelte store (`routeType`) to identify the current environment context. When the application loads, `updateRoute()` parses the URL to determine if the device is at `/game/monitor/...` or `/game/controller/...`. 
This is the cornerstone of **isomorphic game design**: you write one Svelte component, and you use `if ($routeType === 'monitor')` to strip away buttons and complex UI, ensuring the TV remains accessible and visually clean for seniors.

#### Example
**In `src/routes/+layout.svelte`:**
```svelte
<script>
    import { updateRoute } from "@momo2555/koppeliajs";
    // Parses the URL and sets the store globally
    updateRoute();
</script>

<slot />
```

**In any component:**
```svelte
<script>
    import { routeType } from "@momo2555/koppeliajs";
</script>

{#if $routeType === 'monitor'}
    <h1>Welcome Players!</h1>
    {:else if $routeType === 'controller'}
    <h1>Animator Dashboard</h1>
    <button>Force Next Level</button>
{/if}
```

---

### 2. Global State Synchronization (`koppelia.state`)

#### How it works & Capabilities
The `State` is a synchronized, real-time Svelte `Writable` store shared across the entire network. It is designed for **persistent game data** (e.g., scores, current question index, timers, player names).
Under the hood, when you mutate the state, KoppeliaJS performs a diffing operation and broadcasts only the changes via WebSocket to all other connected screens. Because it extends a Svelte store, any UI bound to `$state` will automatically re-render when the server or another device alters the data.

**Available Methods:**
* `koppelia.updateState(partialObject)`: Merges the provided keys/values into the existing state (Recommended for performance).
* `koppelia.setState(fullObject)`: Completely overwrites the global state tree.

#### Example
```svelte
<script lang="ts">
    import { Koppelia } from "@momo2555/koppeliajs";
    
    let koppelia = Koppelia.instance;
    let state = koppelia.state;

    function awardPoints() {
        // Broadcasts the updated score to all screens instantly
        koppelia.updateState({ 
            score: $state.score + 10,
            lastAction: "Points Awarded!"
        });
    }
</script>

<p>Current Score: {$state.score}</p>

{#if $routeType === 'controller'}
    <button on:click={awardPoints}>Award 10 Points</button>
{/if}
```

---

### 3. IoT Hardware Control (`Device`)

#### How it works & Capabilities
The `Device` class is your bridge to the physical world. Instead of dealing with BLE (Bluetooth Low Energy) protocols, the Master Server handles the connection and exposes an abstracted API through KoppeliaJS. You can control the visual feedback of the controllers and listen to their onboard IMU sensors.

**Available Output Methods (Feedback):**
* `setColor({ r, g, b, lon?, loff? })`: Sets a solid color. `lon` and `loff` can be used to create an automatic hardware blinking effect.
* `setColorSequence(["RED", "BLUE", "GREEN"], reset)`: Sends a predefined color loop to the device.
* `vibrate(time, blink?, blinkOff?, blinkCount?)`: Triggers the haptic motor. Can be set to a single long buzz, or a pulsing pattern (e.g., heartbeat effect).

**Available Input Listeners:**
* `onEvent(eventName, callback)`: Listens for physical button presses (e.g., "buzz").
* `onVerticalDetector(callback(isVertical))`: Uses the IMU to detect if the controller is held upright or flat.
* `onCursor(callback(x, y))`: Translates IMU spatial movement into 2D coordinates.
* `onBiking(callback(speed))`: Reads data if the modular controller is clipped to a physical exercise bike pedal.

#### Example
```typescript
import { Koppelia, Device } from "@momo2555/koppeliajs";
let koppelia = Koppelia.instance;

koppelia.onReady(async () => {
    let devices: Device[] = await koppelia.getDevices();

    for (let device of devices) {
        // Setup visual feedback
        device.setColor({ r: 0, g: 255, b: 0 }); // Green

        // Listen for physical button press
        device.onEvent("buzz", () => {
            console.log(`${device.name} pressed the button!`);
            // Trigger 500ms haptic feedback
            device.vibrate(500); 
            // Update the game state to lock out other players
            koppelia.updateState({ winner: device.name });
        });

        // Listen for orientation (e.g., raising a hand/controller)
        device.onVerticalDetector((isVertical) => {
            if (isVertical) console.log(`${device.name} is holding the device up!`);
        });
    }
});
```

---

### 4. Remote Procedure Calls (`CustomCallbacks`)

#### How it works & Capabilities
While `State` is used for persistent data, **Custom Callbacks** are designed for **transient events**. If you need to trigger a one-off action (like playing a sound effect, triggering a CSS explosion animation, or forcing a hardware reset), using state is inefficient. Custom Callbacks act as a Remote Procedure Call (RPC) system to broadcast functions across the network.

**Available Methods:**
* `koppelia.on(name, callback(args))`: Registers a listener on the current device.
* `koppelia.run(name, args)`: Broadcasts an execution request to all devices.
* `koppelia.unsub(name)`: Removes a listener. **Crucial:** Always call this in Svelte's `onDestroy` lifecycle to prevent memory leaks when changing stages.

#### Example
```svelte
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Koppelia, routeType } from "@momo2555/koppeliajs";
    let koppelia = Koppelia.instance;

    if ($routeType === 'monitor') {
        // The Monitor listens for the trigger
        onMount(() => {
            koppelia.on("playExplosion", (args) => {
                showVisualExplosionAt(args.x, args.y);
                audioManager.play("boom.mp3");
            });
        });

        onDestroy(() => {
            koppelia.unsub("playExplosion"); // Prevent memory leaks!
        });
    }

    function triggerEventFromTablet() {
        // The Animator clicks a button, sending the command to the Monitor
        koppelia.run("playExplosion", { x: 50, y: 50 });
    }
</script>

{#if $routeType === 'controller'}
    <button on:click={triggerEventFromTablet}>Trigger Explosion</button>
{/if}
```

---

### 5. Game Options (Live Settings)

#### How it works & Capabilities
Game Options allow the animator to adjust variables dynamically from their tablet menu without altering the core game state tree. The Master server processes these UI definitions and generates Native UI components on the Flutter Controller App. The Svelte application receives real-time updates when the animator moves a slider or toggles a switch.

**Available Generators (Called by Controller):**
* `createSliderOption(name, label, value, min, max, step)`: Creates a numeric slider.
* `createSwitchOption(name, label, value)`: Creates a boolean toggle.
* `createChoicesOption(name, label, value, choicesArray)`: Creates a dropdown/segmented control.

**Available Listeners (Used by both screens):**
* `onOptionChanged(name, callback(data))`: Fires whenever the animator adjusts the generated UI.

#### Example
```typescript
import { Koppelia, routeType } from "@momo2555/koppeliajs";
import { get } from "svelte/store";
let koppelia = Koppelia.instance;

// Only the controller asks the Master Server to generate the UI
if (get(routeType) === 'controller') {
    koppelia.createSliderOption("gameSpeed", "Game Speed Modifier", 1.0, 0.5, 2.0, 0.1);
    koppelia.createSwitchOption("hardMode", "Enable Hard Mode", false);
}

// Both screens listen to the changes to adapt their logic
koppelia.onOptionChanged("hardMode", (data) => {
    let isHardModeEnabled = data.value;
    if (isHardModeEnabled) {
        enableStrictTimer();
    }
});
```

---

### 6. CMS & Content (`Play`, `Resident`, `Song`)

#### How it works & Capabilities
Koppelia games are "engines" populated by content stored in the Filarmonic database. The SDK provides classes to securely fetch this data, automatically resolving complex media paths into usable URLs.
* **`Resident`**: Profiles of the seniors. Contains `.name` and `.imageUrl` (automatically resolved) to display their faces on the TV.
* **`Play`**: The content payload. E.g., a specific quiz deck. You must call `updatePlayContent()` to download the JSON payload into memory.
* **`Song`**: Structured audio data featuring separate URLs for backing tracks, vocals, lyrics, and album covers.

#### Example
```typescript
import { Koppelia, Resident, Play } from "@momo2555/koppeliajs";
let koppelia = Koppelia.instance;

koppelia.onReady(async () => {
    // 1. Load Residents (Avatars)
    let residents: Resident[] = await koppelia.getResidents();
    console.log("Player 1 is:", residents[0].name);

    // 2. Load the specific Game Content
    let currentPlay: Play = await koppelia.getCurrentPlay();
    await currentPlay.updatePlayContent(); // Triggers the actual download
    
    // Access the JSON payload created by the animator
    let quizQuestions = currentPlay.playContent.questions;
});
```

---

### 7. Stage Management (Server-Driven Navigation)

#### How it works & Capabilities
A "Stage" correlates directly to a SvelteKit route (e.g., `home`, `game`, `explanation`). Navigation in Koppelia is driven by the server. You do not use standard `<a>` tags or Svelte's `goto` manually. Instead, you ask the SDK to change the stage, which ensures that **both the Monitor and Controller transition to the new screen simultaneously**.

**Available Methods:**
* `init(defaultState, stagesArray)`: Registers the permitted routes with the server.
* `goto(stageName)`: Broadcasts a navigation command. The SDK will automatically clean up internal event listeners and force the browser to change URLs.

#### Example
```typescript
import { Koppelia } from "@momo2555/koppeliajs";
let koppelia = Koppelia.instance;

// Called on the boot screen
koppelia.init(
    { score: 0 }, 
    ['home', 'game', 'results']
);

function startGame() {
    // Both TV and Tablet will navigate to /game/[type]/game instantly
    koppelia.goto('game'); 
}
```

---

## 🛠️ Global Practical Example

Here is a comprehensive example demonstrating how Routing, State, Hardware, and Custom Callbacks come together in a single isomorphic `+page.svelte` file to create a fully functioning Quiz Game environment.

```svelte
<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { get } from "svelte/store";
    import { routeType, Koppelia, Device } from "@momo2555/koppeliajs";
    
    // Abstracted UI Components (Assumed to exist in your project)
    import QuestionDisplay from "$lib/components/QuestionDisplay.svelte";
    import Button from "$lib/components/Button.svelte";

    let koppelia = Koppelia.instance;
    let state = koppelia.state; 
    let devices: Device[] = [];

    // ==========================================
    // 📺 MONITOR LOGIC (Game Rules & Hardware Hub)
    // ==========================================
    if ($routeType === "monitor") {
        
        onMount(() => {
            // Track persistent data in the global state
            koppelia.updateState({ questionStartTime: Date.now() });
        });

        onDestroy(() => {
            // Prevent memory leaks when changing stages!
            koppelia.unsub("qpc-unbuzz");
            koppelia.unsub("resetDevices");
        });

        koppelia.onReady(async () => {
            devices = await koppelia.getDevices();
            let players = get(koppelia.state).players || {};

            // 1. RPC Callback: Listen for Animator forcing a hardware reset
            koppelia.on("resetDevices", () => {
                for (let device of devices) device.setColorSequence([], true);
            });

            // 2. Hardware Initialization
            for (let device of devices) {
                // Initialize player data in the state
                if (!Object.hasOwn(players, device.name)) {
                    players[device.name] = { score: 0, name: device.name };
                }

                // Listen for physical buzzer presses
                device.onEvent("buzz", () => {
                    // Only accept buzz if nobody has buzzed yet
                    if ($state.buzz === null) {
                        device.vibrate(700); // Haptic feedback
                        
                        // Update global state! The tablet will instantly see who buzzed.
                        koppelia.updateState({ buzz: $state.players[device.name] });
                    }
                });
            }
            // Push the registered players to the network
            koppelia.updateState({ players });

            // 3. RPC Callback: Reset the UI state if the Animator rejects an answer
            koppelia.on("qpc-unbuzz", () => {
                koppelia.updateState({ buzz: null }); 
            });
        });
    }

    // ==========================================
    // 📱 CONTROLLER LOGIC (Animator Actions)
    // ==========================================
    function onSkip() {
        koppelia.updateState({ buzz: null });
        // Forces both screens to navigate to the explanation stage
        koppelia.goto("explanation"); 
    }

    function onCorrect() {
        // Mutate persistent state
        let players = $state.players;
        players[$state.buzz.name].score += 1;
        koppelia.updateState({ players, answerState: "right" });
        
        // Wait 2 seconds, then change stage
        setTimeout(() => {
            koppelia.goto("explanation");
            koppelia.updateState({ buzz: null });
        }, 2000);
    }

    function onWrong() {
        koppelia.updateState({ answerState: "bad" });
        // RPC: Tell the Monitor to reset hardware/buzzer lockout
        koppelia.run("qpc-unbuzz", {}); 
    }
</script>

<div class="game-content">
    
    {#if $routeType === "controller"}
        <div class="top-dashboard">
            <p>Game Difficulty: {$state.difficulty}</p>
        </div>
    {/if}

    <QuestionDisplay question={$state.question}></QuestionDisplay>

    {#if $state.buzz !== null}
        <h2>{$state.buzz.name} Buzzed!</h2>
    {/if}

    {#if $routeType === "controller"}
        <div class="actions">
            {#if $state.buzz !== null}
                <Button text="Correct" color="green" callback={onCorrect} />
                <Button text="Wrong" color="red" callback={onWrong} />
            {:else}
                <Button text="Skip Question" callback={onSkip} />
            {/if}
        </div>
    {/if}
</div>

<style>
    /* Strict layout control to prevent scrolling issues on the TV */
    :global(body, html) {
        margin: 0;
        padding: 0;
        height: 100vh;
        overflow: hidden; 
    }
    .game-content {
        background-color: #f8f9fa;
        display: flex;
        flex-direction: column;
        height: 100vh; 
        text-align: center;
    }
    .actions {
        margin-top: auto;
        padding: 20px;
    }
</style>
```