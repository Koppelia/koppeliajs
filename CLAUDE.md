# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

KoppeliaJS is a SvelteKit library SDK (`@momo2555/koppeliajs`) that game developers install into their SvelteKit projects to build games for the Koppelia console — an asymmetric gaming system for senior care facilities. The SDK is **not a game itself**; it's the framework games are built with.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Build + package for publishing (vite build && svelte-package)
npm run package      # Package only (svelte-kit sync && svelte-package && publint)
npm run check        # Type-check with svelte-check
npm run check:watch  # Type-check in watch mode
npm run lint         # prettier + eslint
npm run format       # Auto-format with prettier
npm run pub          # Build and publish to npm (vite build && npm publish --access public)
```

There are no tests. Type-checking (`npm run check`) is the primary correctness gate.

## Architecture

### The Network Peer Model

The Koppelia ecosystem has five peer types (defined in `src/lib/scripts/message.ts` as `PeerType`):
- **`monitor`** — the TV screen displayed to players
- **`controller`** — the animator's tablet interface  
- **`master`** — the Filarmonic server orchestrating the session
- **`device`** — physical BLE IoT controllers
- **`maestro`** — handles TTS and audio

All communication flows through a WebSocket at `ws://<hostname>:2225`. Every message is a `Message` object (UUID-tagged, typed, with source/destination peer fields) sent through `KoppeliaWebsocket`, which handles reconnection and request/response correlation.

### Core Class Hierarchy

```
Koppelia (singleton, src/lib/scripts/koppelia.ts)
  ├── Console (src/lib/scripts/console.ts)       — WebSocket event hub, all send/receive
  │     └── KoppeliaWebsocket                    — raw WS with timeout & reconnection
  ├── State (src/lib/scripts/state.ts)           — synchronized Svelte writable store
  ├── Stage (src/lib/scripts/stage.ts)           — server-driven navigation
  ├── Option (src/lib/scripts/option.ts)         — live game settings (slider/switch/choices)
  └── CustomCallbacks (src/lib/scripts/customCallback.ts) — RPC system (on/run/unsub)
```

`Koppelia` is a singleton accessed via `Koppelia.instance`. It is the only class game developers interact with directly.

### Key Patterns

**Isomorphic routing** — Both monitor and controller are served from the same SvelteKit codebase. The URL path (`/game/monitor/...` vs `/game/controller/...`) determines context via the `routeType` store (`src/lib/stores/routeStore.ts`). Call `updateRoute()` once in the root layout.

**State diffing** — `State` subscribes to its own Svelte store and computes a diff before broadcasting. `updateState(partial)` is preferred over `setState(full)` for performance. Receiving a network state update temporarily disables the local subscriber to prevent echo-broadcasting.

**`onReady` pattern** — `Console.onReady()` fires once the WebSocket opens. If already open, it fires immediately. `Koppelia.init()` and all hardware setup should happen inside `onReady`. On `monitor` only: `init()` sets the initial state and registers valid stage names.

**Custom callback lifecycle** — `koppelia.on(name, cb)` registers a local listener. `koppelia.run(name, args)` broadcasts to all peers. Always call `koppelia.unsub(name)` in Svelte's `onDestroy` to prevent memory leaks across stage transitions (stage navigation calls `Console.destroyEvents()` which wipes device/request handlers but not custom callbacks).

**`init()` is monitor-only** — `koppelia.init(defaultState, stages)` is guarded to execute only on the monitor peer. The monitor is the authoritative state initializer.

### What Gets Exported

Public API is declared in `src/lib/index.ts`:
- **Classes**: `Koppelia`, `Device`, `Play`, `Resident`, `Song`, `Console`, `Message`, `AudioManager`
- **Svelte components**: `KBase`, `GrowableElement`, `Button`, `ResizableText`
- **Stores/functions**: `routeType`, `updateRoute`, `audioManager`

Server-side export (`./server` subpath): `KoppeliaServerApi` — an Express server (port 2227) game projects run server-side to serve play content files from `/koppelia/games/<gameId>/plays/`.

### Media URLs

The Filarmonic media API runs at `http://<hostname>:8000`. Use `koppelia.getMediaLink(path)` to build URLs and `koppelia.fixMediaUrl(url)` to normalize URLs that were cached by one peer (e.g., controller) and need to work on another (e.g., monitor).

### Environment Variables

Games using this SDK require:
- `PUBLIC_GAME_ID` — unique game identifier (read inside `koppelia.ts` via `$env/static/public`)
- `PUBLIC_MOCE_ENV` — environment flag (`dev` or production)
