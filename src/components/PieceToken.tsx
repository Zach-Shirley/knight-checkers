import type { CSSProperties } from "react";
import type { Piece } from "../game";
import knightBlackSvg from "../assets/chess-knight-black.svg";
import knightGraySvg from "../assets/chess-knight-gray.svg";
import knightRedSvg from "../assets/chess-knight-red.svg";
import kingSvg from "../assets/checker-king.svg";

export type PieceAnimation = {
  id: number;
  pieceId: string;
  mode: "slide" | "hop";
  direction?: "backward" | "forward";
  style: CSSProperties & {
    "--move-from-x"?: string;
    "--move-from-y"?: string;
    "--move-to-x"?: string;
    "--move-to-y"?: string;
  };
};

type PieceTokenProps = {
  piece: Piece;
  resting?: boolean;
  animation?: PieceAnimation | null;
  onAnimationEnd?: (animationId: number) => void;
};

export function PieceToken({
  piece,
  resting = false,
  animation = null,
  onAnimationEnd
}: PieceTokenProps) {
  const animationClass = animation
    ? `animate-${animation.mode} ${animation.direction === "forward" ? "animate-forward" : ""}`
    : "";
  const handleAnimationEnd = () => {
    if (animation) onAnimationEnd?.(animation.id);
  };

  if (piece.kind === "knight") {
    const source = resting
      ? knightGraySvg
      : piece.player === "red"
        ? knightRedSvg
        : knightBlackSvg;

    return (
      <span
        className={`knight-piece ${piece.player} ${resting ? "resting" : "ready"} ${animationClass}`.trim()}
        style={animation?.style}
        aria-hidden="true"
        onAnimationEnd={handleAnimationEnd}
      >
        <img className="knight-mark" src={source} alt="" draggable="false" />
      </span>
    );
  }

  return (
    <span
      className={`piece-token ${piece.player} ${piece.kind} ${animationClass}`.trim()}
      style={animation?.style}
      aria-hidden="true"
      onAnimationEnd={handleAnimationEnd}
    >
      {piece.kind === "king" ? (
        <img className="king-mark" src={kingSvg} alt="" draggable="false" />
      ) : null}
    </span>
  );
}
