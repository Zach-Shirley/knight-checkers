import knightBlackSvg from "./assets/chess-knight-black.svg";
import knightGraySvg from "./assets/chess-knight-gray.svg";
import knightRedSvg from "./assets/chess-knight-red.svg";
import kingSvg from "./assets/checker-king.svg";

export type PieceArt = {
  id: string;
  knight: { red: string; black: string; gray: string };
  crown: string;
  // Rendered sprites already carry their own lighting, so they skip the outline glow the flat SVGs need.
  rendered: boolean;
};

// The original Wikimedia-based pieces (CC BY-SA 3.0, see README).
const classic: PieceArt = {
  id: "classic",
  knight: { red: knightRedSvg, black: knightBlackSvg, gray: knightGraySvg },
  crown: kingSvg,
  rendered: false
};

// Original sprites rendered by art/studio.js, one folder per style.
const files = import.meta.glob<string>("./assets/pieces/*/*.png", { eager: true, import: "default" });
const renderedSets: Record<string, PieceArt> = {};
for (const [path, url] of Object.entries(files)) {
  const [, style, file] = path.match(/pieces\/([^/]+)\/([^/]+)\.png$/) ?? [];
  if (!style) continue;
  const set = (renderedSets[style] ??= { id: style, knight: { red: "", black: "", gray: "" }, crown: "", rendered: true });
  if (file === "crown") set.crown = url;
  else if (file.startsWith("knight-")) set.knight[file.slice(7) as "red" | "black" | "gray"] = url;
}

export const PIECE_ART_SETS: Record<string, PieceArt> = { classic, ...renderedSets };

const STORAGE_KEY = "knight-checkers:pieces";
const DEFAULT_SET = "classic";

// Preview a set with ?pieces=<style>; the choice is remembered on this device.
function chooseSet(): PieceArt {
  try {
    const requested = new URLSearchParams(window.location.search).get("pieces");
    if (requested && PIECE_ART_SETS[requested]) localStorage.setItem(STORAGE_KEY, requested);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && PIECE_ART_SETS[stored]) return PIECE_ART_SETS[stored];
  } catch {
    // Storage can be unavailable (private mode); fall back to the default set.
  }
  return PIECE_ART_SETS[DEFAULT_SET];
}

export const pieceArt = chooseSet();
