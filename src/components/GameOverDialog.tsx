import { useEffect, useState, type ReactNode } from "react";
import { Trophy } from "lucide-react";
import { getMaterial, playerName, type GameState, type Player } from "../game";
import { Modal } from "./Modal";

export type GameOverAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

// Shows once each time a game ends. "View board" closes it so the final position can be studied.
export function GameOverDialog({
  state,
  you,
  actions,
  note
}: {
  state: GameState;
  // The local player's side, or null in pass-and-play where both sides share the screen.
  you: Player | null;
  actions: GameOverAction[];
  note?: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  const isOver = state.status.phase === "won";

  // A new game (rematch, play again) re-arms the dialog.
  useEffect(() => {
    if (!isOver) setDismissed(false);
  }, [isOver]);

  if (state.status.phase !== "won" || dismissed) return null;

  const { winner, message } = state.status;
  const title = you === null ? `${playerName(winner)} wins!` : winner === you ? "You win!" : "You lose";
  const { score } = getMaterial(state);

  return (
    <Modal title={title} description={message} onClose={() => setDismissed(true)}>
      <div className={`game-over-banner ${winner}`}>
        <Trophy aria-hidden="true" size={22} />
        <span>
          Material: Red {score.red} · Black {score.black}
        </span>
      </div>
      {note ? <p className="game-over-note">{note}</p> : null}
      <div className="game-over-actions">
        {actions.map((action, index) => (
          <button
            key={action.label}
            className={`button ${action.variant ?? (index === 0 ? "primary" : "secondary")}`}
            type="button"
            data-autofocus={index === 0 ? true : undefined}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
        <button className="button secondary" type="button" onClick={() => setDismissed(true)}>
          View board
        </button>
      </div>
    </Modal>
  );
}
