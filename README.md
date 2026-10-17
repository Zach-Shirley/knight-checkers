# Knight Checkers

A browser-based variant of American checkers with one chess knight per side. It includes local pass-and-play and an authoritative real-time multiplayer mode for private rooms or quick matching.

## Run locally

```bash
npm install
npm run dev
```

Then open the localhost URL printed by Vite.

For local pass-and-play only:

```bash
npm run dev:local
```

Then open `http://knight-checkers.127.0.0.1.sslip.io:4174/` or `http://127.0.0.1:4174/`.

For multiplayer development, start the web app and game server together:

```bash
npm run dev:multiplayer
```

Open `http://127.0.0.1:4174/` in two tabs. Create a private room in one tab, then join its six-character code from the other. The authoritative Socket.IO game server listens on `http://127.0.0.1:4175/`; its health check is available at `/health`.

## App screens

- `/` provides the game-mode menu, rules, and local-game setup.
- `/local` runs the complete pass-and-play game with move history and standard game actions.
- `/bot` plays against the computer at Easy, Medium or Hard. The bot (`src/bot.ts`) is an alpha-beta search over the shared rules engine and runs in a web worker, so it works offline.
- `/multiplayer` provides private room creation, join codes, quick matching, reconnect support, quick-message room chat, resignations, a 30-second disconnect grace period, visible departure states, and rematches.

## Multiplayer architecture

- `server/game-server.ts` owns room membership and the canonical game state in memory.
- Clients submit move IDs; the server validates them through the shared rules engine before broadcasting a new snapshot.
- Accepted moves animate locally from their source square after server validation, keeping both board perspectives visually consistent without making the client authoritative.
- Per-tab reconnect tokens allow a player to refresh without taking over the other tab's seat.
- Players never type a name. Each device gets a permanent generated name (like `SwiftFalcon27`) and a random player ID (`src/playerIdentity.ts`), kept for ratings and profiles later. The server shows only generated names and never sends player IDs to other players.
- During quick match a player can play a bot while waiting (a found match takes over immediately) or play a bot instead.
- Colors: Red always moves first. Against the bot and when creating a private room the player picks Red, Black or Random (the board flips for Black). The room joiner gets the other color, and quick match assigns colors at random. Pass & play keeps Red at the bottom.
- Disconnects pause the match for 30 seconds. Reconnecting cancels the deadline; otherwise the server records a resignation.
- Room snapshots include capped chat history and rematch votes so every connected player sees the same conversation and match state.
- Chat is limited to a fixed set of quick messages (`QUICK_CHAT_MESSAGES` in `src/multiplayer/protocol.ts`); the server rejects anything else. That avoids moderating free text and the App Store's user-generated-content rules.
- Rooms are currently ephemeral and disappear when the game server restarts. Persistent accounts, ratings, and multi-instance scaling are intentionally deferred until shared storage is added.

## Deployment

Pushes to `main` run the GitHub Actions validation workflow and deploy to `https://knight-checkers.vercel.app/` through Vercel. As of 2026-10-17 the deploy step fails because the stored Vercel token lacks project access; the live site was deployed manually.

The multiplayer server is configured for Render through `render.yaml`. It uses a Free web service for the current side-project phase, deploys from every commit to `main`, listens on Render's assigned `PORT`, exposes `/health`, and accepts Socket.IO connections from the production Vercel origin. Set the Vercel production build variable `VITE_GAME_SERVER_URL` to the service's public `https://...onrender.com` URL after the Render service is created. The service can be upgraded to Starter later without changing the application architecture.

One server process supports any number of simultaneous room codes within the service's memory limit. Rooms are held in memory, so a service restart ends active matches; persistent room recovery and horizontal scaling will require shared state such as Redis later.

## Mobile apps (in progress)

The `mobile-pilot` branch wraps the same web app for iPhone and Android with [Capacitor](https://capacitorjs.com). The reusable playbook is in `02 Projects/Foundry Mobile Kit`.

- `npm run mobile:sync` builds the web app and copies it into `ios/` and `android/`.
- `npm run mobile:icons` regenerates every icon and splash size from `scripts/make-app-icon.mjs`.
- `codemagic.yaml` describes the cloud iOS build and TestFlight upload. It has not run yet.
- `store/` holds draft privacy, support and listing copy.
- The app build hides the unbuilt bot mode and shows no player-typed text: opponents appear by seat color instead of their typed name (`src/multiplayer/nativeSafety.ts`).
- The app connects to the production game server, which must allow the `capacitor://localhost` and `https://localhost` origins (`render.yaml`).
- `appId` in `capacitor.config.ts` is a placeholder until the LLC domain is chosen.

## Implemented rules

- Standard 8x8 checkers movement on dark squares.
- Optional forced-capture toggle for checker pieces.
- With forced checker captures on, checker captures and multi-jumps are mandatory, but knight moves are still optional.
- With forced checker captures off, no pieces are forced to capture.
- Men crown into kings on the far row.
- Each side starts with the normal 12 checkers plus one adjacent second-rank knight: Red on e2, Black on d7.
- The knight moves and captures like a chess knight and is never forced to capture.
- After a knight moves, that player's next turn must be a non-knight move before the knight is ready again.
- Resting knights use a gray version of the same piece until their cooldown clears.
- Checkers can jump and capture the knight like any other opposing piece.
- A player wins when the opponent has no men or kings left; the opponent's knight can remain on the board.
- A player also loses if they have no legal move, matching normal checkers lockout behavior.

The game rules live in `src/game.ts`, separate from the React UI, so a later online version can reuse the same state transitions behind a network layer.

## Piece art

The knight and crown sprites are original renders made for this project with three.js (`art/`). Earlier versions used Wikimedia Commons pieces by Cburnett (CC BY-SA 3.0); those files were removed on 2026-10-17 and no longer ship.
