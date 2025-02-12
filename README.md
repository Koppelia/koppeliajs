# create-svelte

Everything you need to build a Svelte library, powered by [`create-svelte`](https://github.com/sveltejs/kit/tree/main/packages/create-svelte).

Read more about creating a library [in the docs](https://svelte.dev/docs/kit/packaging).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Everything inside `src/lib` is part of your library, everything inside `src/routes` can be used as a showcase or preview app.

## Building

To build your library:

```bash
npm run package
```

To create a production version of your showcase app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Publishing

Go into the `package.json` and give your package the desired name through the `"name"` option. Also consider adding a `"license"` field and point it to a `LICENSE` file which you can create from a template (one popular option is the [MIT license](https://opensource.org/license/mit/)).

To publish your library to [npm](https://www.npmjs.com):

```bash
npm publish
```

```bash
npm install --save-dev @types/node
```

# Features of Koppeliajs
## Monitor and Controller
**Monitor**: This the screen shown on the tv

**Controller**: This is the screen shown on the smartphone (Koppeli'App)

KoppeliaJS provides tools

## State management
Manage the state of the game, change easily the state, and get all updates from the server

## Stage management
A stage is a part of the game (it is a page), when the stage changes, it changes for the controller and monitor

## Device management
Manage the devices connected to the console.

## Play management
Manage the plays of the game. You can create new plays for a specific game on KOppelia'App.

## difficulty Cursor
Change the difficulty of the game in real time. The DifficultyCurser option should be activated on KoppeliaJS.

## Growable Element
Growable elements are elements (generally text) that are shown on the monitor screen. Those elements can be expanded from the controller. They will take all the surface of the monitor screen.

## Resizable Text
Resizable text are text shwon on monitor screen and the font size can be changed in real time from Koppeli'App

## ScrollSyncer

## StageButton