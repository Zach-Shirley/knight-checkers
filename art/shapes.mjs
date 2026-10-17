// Original Knight Checkers piece outlines, shared by every art style.
// Coordinates: 100x100 box, y grows downward (SVG convention), knight faces left.

// Horse head and neck, drawn as one closed outline. The base (pedestal) is separate.
export const KNIGHT_HEAD = [
  "M 31 96",                       // front of the chest at the collar
  "C 29 85, 32 76, 40 70",         // chest rising
  "C 44 67, 47 64, 47 61",         // neck front into the throat
  "C 45 59, 41 60, 36 63",         // under the round jowl
  "C 30 66, 21 67, 14 64",         // jaw line to the chin
  "C 10 63, 7 61, 8 58",           // chin and lower lip
  "L 13 55.5",                     // mouth corner
  "C 10 56, 4 55, 3 50",           // upper lip
  "C 2 45, 4 41, 8 38",            // front of the muzzle
  "C 15 30, 22 21, 29 14",         // long nose bridge up to the forehead
  "C 29 10, 29 4, 32 0",           // front of the ear
  "C 38 1, 43 6, 45 13",           // back of the ear
  "C 55 14, 67 21, 75 34",         // poll and crest of the neck
  "C 82 48, 83 66, 80 80",         // back of the neck
  "C 79 86, 78 91, 78 96",         // down to the collar
  "Z"
].join(" ");

// Eye and nostril, as small closed shapes cut or painted on the head.
export const KNIGHT_EYE = { cx: 31, cy: 25, rx: 3.4, ry: 2.2, rotate: -38 };
export const KNIGHT_NOSTRIL = { cx: 9, cy: 45, r: 1.5 };

// Crown for the king marker, seen from above as a stamped emblem. 100x100 box.
export const CROWN_POINTS = "M 15 78 L 10 36 L 27 54 L 30 27 L 41 51 L 50 18 L 59 51 L 70 27 L 73 54 L 90 36 L 85 78 Q 50 84 15 78 Z";
export const CROWN_BAND = "M 15 66 Q 50 71 85 66 L 85 78 Q 50 84 15 78 Z";
export const CROWN_BALLS = [
  { cx: 10, cy: 33, r: 5 },
  { cx: 30, cy: 24, r: 5 },
  { cx: 50, cy: 14, r: 5.5 },
  { cx: 70, cy: 24, r: 5 },
  { cx: 90, cy: 33, r: 5 }
];
export const CROWN_GEMS = [
  { cx: 32, cy: 73, r: 3.2 },
  { cx: 50, cy: 75, r: 3.8 },
  { cx: 68, cy: 73, r: 3.2 }
];
