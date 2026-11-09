# Xion Launcher

Premium Minecraft: Java Edition launcher for Windows, with its own in-game client — **Xion Client** — built into every profile.

## Launcher

- **Accounts** – Microsoft sign-in (official OAuth window) or offline username accounts; switch from the top-right chip.
- **Profiles** – every profile runs Xion Client on Fabric (or Quilt), each with its own game folder (`instances/<profile>`). Versions **1.18 → 26.3**.
- **Optimization pack** – Sodium, Lithium, FerriteCore, Entity Culling, ImmediatelyFast, More Culling, ModernFix, Starlight, Noisium, Krypton, Dynamic FPS, Exordium, Iris, Sodium Extra and more, resolved per version from Modrinth (toggle per mod).
- **Self-healing launches** – missing mod dependencies are installed automatically; mods that are incompatible with the chosen version are disabled and the game relaunches.
- **Mods page** – browse and install any Fabric mod from Modrinth into a profile (dependencies included).
- **Player page** – animated 3D skin viewer, playtime stats, skin upload (Microsoft: sent to your Minecraft account, visible to everyone; offline: applied in-game by Xion Client), classic/slim model.
- **Automatic Java** – Mojang's official runtime for each version (Java 8/17/21/25).
- **Paper servers** – create and run local Paper servers with a live console.
- News feed, featured servers with live player counts, console, RAM/resolution/JVM settings.

## Xion Client (in game)

- Dark animated **Xion main menu** replacing the vanilla title screen.
- **Right Shift** opens the Xion menu: HUD Mods, Features, Mods (everything loaded), Profile.
- **HUD mods**: FPS, CPS, Coordinates + facing, Ping, Speed, Clock, Day counter, Memory, Server address, Potion effects, Keystrokes, Armor status — drag them anywhere in the **HUD editor**.
- **Features**: Auto Sprint, Fullbright, HUD background, Xion badge, custom skin, Xion main menu.
- **Xion badge** – the Xion logo next to your name in the tab list and above your head in third person.

Source: [`xion-client-mod/`](xion-client-mod/) — one codebase preprocessed for every Minecraft version (`//#if MC >= 12002 …`). Build all jars with:

```bash
node xion-client-mod/tools/build.js
```

(needs JDK 25; jars land in `src/assets/mods/`).

## Develop

```bash
npm install
npm start
```

## Build the .exe

```bash
npm run dist
```

Outputs to `dist/`: `Xion Launcher Setup <version>.exe` (installer) and `XionLauncher-Portable-<version>.exe`.

Game data lives in `%APPDATA%\.xionlauncher` (changeable in Settings).
