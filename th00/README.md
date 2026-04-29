# th00

`th00/index.html` is the public entry page for the Touhou-style canvas game. `../th00.html` only redirects here for old-link compatibility.

## Structure

- `assets/images/`: sprite sheets and image assets.
- `assets/sounds/`: audio effects.
- `css/`: page and game styling.
- `js/core/`: shared configuration, input state, utilities, runtime mob logic, texture rendering, scene rendering, game state, and the main game loop.
- `js/patterns/`: data-driven templates for bullets, danmaku generators, mobs, stages, textures, and reusable trajectories.
- `js/systems/`: non-UI gameplay systems such as autoplay AI.
- `js/ui/`: DOM controls, theme handling, effects, and audio playback.

`js/core/config.js` owns shared runtime configuration, including asset paths, mode mappings, gameplay constants, and the mutable input state consumed by the game loop.

## Module Entry

The game now loads through a single ES module entry:

1. `js/main.js`

`index.html` still exposes a few `window.*` UI handlers for inline button actions, but gameplay code uses explicit imports and exports internally.
