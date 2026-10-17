# Knight Checkers Store Listing (draft)

| Field | Draft |
|---|---|
| Name (30 chars) | Knight Checkers |
| Subtitle, iOS (30 chars) | Checkers with a chess knight |
| Short description, Google (80 chars) | Classic checkers plus one chess knight per side. Play a friend or online. |
| Category | Games → Board |
| Age rating | 4+ / Everyone (no free-form chat or user-generated text in the app build) |
| Price | Free, no in-app purchases |
| Privacy label (iOS) | Data Not Collected. The random player ID only lives in server memory for the length of a room. Once ratings store it, declare "Identifiers → User ID", not linked to identity |
| Data safety (Google) | No data collected or shared |
| Privacy policy URL | [LLC SITE]/knight-checkers/privacy |
| Support URL | [LLC SITE]/knight-checkers/support |

## Description

Knight Checkers is classic American checkers with one twist: each side gets a chess knight.

The knight jumps in an L like it does in chess, captures whatever it lands on and is never forced to take. After it moves it has to rest for a turn, so you have to pick your moment.

- Play the bot on Easy, Medium or Hard, even offline
- Pass & Play on one phone
- Online play with private room codes or quick match, and a bot to play while you wait
- Optional forced captures for checkers
- Multi-jumps and crowned kings, just like regular checkers
- No accounts, no ads, no tracking

## Review notes for Apple

No sign-in is needed. Online play connects to a game server that may take up to a minute to wake on the first connection. To test online play with one device, start a private room, then open the website (https://knight-checkers.vercel.app/multiplayer) in a browser and join with the room code.

## Still to do

- Screenshots: drafts in `screenshots/framed/` (iPhone 6.9", 1320×2868). Regenerate with `node scripts/store-screenshots.mjs` then `node scripts/frame-screenshots.mjs`. The same images work for Google Play.
- Google feature graphic (1024×500)
- Icon: lacquered knight on a board corner (original render, chosen with the piece set on 2026-10-17)
