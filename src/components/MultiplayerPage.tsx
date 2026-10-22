import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent
} from "react";
import {
  BookOpen,
  ChevronLeft,
  Clipboard,
  DoorOpen,
  Home,
  LoaderCircle,
  LogIn,
  MessageSquare,
  Radio,
  RotateCcw,
  Swords,
  Trophy,
  UserRound,
  WifiOff,
  Users
} from "lucide-react";
import {
  BOARD_SIZE,
  getLegalMoves,
  getPieceAt,
  isDarkSquare,
  opponentOf,
  pieceName,
  playerName,
  squareName,
  type GameRules,
  type GameState,
  type Move,
  type Piece,
  type Player,
  type Square
} from "../game";
import {
  QUICK_CHAT_MESSAGES,
  type ColorChoice,
  type PlayerSession,
  type QueueResult,
  type RoomConnection,
  type RoomSnapshot,
  type ServerResponse
} from "../multiplayer/protocol";
import { withoutFreeText } from "../multiplayer/nativeSafety";
import { getMultiplayerSocket } from "../multiplayer/socket";
import { type BotLevel } from "../bot";
import { getPlayerIdentity } from "../playerIdentity";
import { ColorPicker, resolveColorChoice } from "./ColorPicker";
import { BotLevelPicker } from "./HomePage";
import { LocalGamePage } from "./LocalGamePage";
import { MaterialStrip } from "./MaterialStrip";
import { Modal } from "./Modal";
import { PieceToken, type PieceAnimation } from "./PieceToken";

const SESSION_KEY = "knight-checkers:online-session:v1";
const CELL_DISTANCE_IN_TOKEN_PERCENT = 138.889;
const boardIndexes = Array.from({ length: BOARD_SIZE }, (_, index) => index);

type LobbyMode = "create" | "join";
type GameDialog = "rules" | "resign" | "leave" | null;

export function MultiplayerPage({
  onExit,
  onPlayBot
}: {
  onExit: () => void;
  onPlayBot: (level: BotLevel, rules: GameRules, color: ColorChoice) => void;
}) {
  const identity = useMemo(getPlayerIdentity, []);
  // While quick match searches, the player can play a bot; a found match replaces that game.
  const [waitingBot, setWaitingBot] = useState<{ level: BotLevel; rules: GameRules; botPlayer: Player; session: number } | null>(null);
  const [queueRules, setQueueRules] = useState<GameRules>({ forceCheckerCaptures: true });
  const [matchNotice, setMatchNotice] = useState(false);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(() => readSession());
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const socket = useMemo(getMultiplayerSocket, []);

  const showSnapshot = useCallback((next: RoomSnapshot) => {
    setSnapshot(withoutFreeText(next));
  }, []);

  const acceptConnection = useCallback((connection: RoomConnection) => {
    setWaitingBot((current) => {
      if (current) setMatchNotice(true);
      return null;
    });
    writeSession(connection.session);
    setSession(connection.session);
    showSnapshot(connection.snapshot);
    setQueued(false);
    setError(null);
    setConnecting(false);
  }, [showSnapshot]);

  useEffect(() => {
    function resumeSavedSession() {
      setConnected(true);
      const savedSession = readSession();
      if (!savedSession) {
        setConnecting(false);
        return;
      }

      setConnecting(true);
      socket.emit("room:resume", savedSession, (response) => {
        if (response.ok) {
          acceptConnection(response.data);
          return;
        }

        clearSession();
        setSession(null);
        setSnapshot(null);
        setConnecting(false);
        setError(response.message);
      });
    }

    function handleDisconnect() {
      setConnected(false);
      setConnecting(false);
    }

    function handleConnectError() {
      setConnected(false);
      setConnecting(false);
      setError("Can't reach the game server yet. It sleeps when idle and can take up to a minute to wake up.");
    }

    function handleRoomClosed(message: string) {
      clearSession();
      setSession(null);
      setSnapshot(null);
      setQueued(false);
      setError(message);
    }

    socket.on("connect", resumeSavedSession);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("room:state", showSnapshot);
    socket.on("room:closed", handleRoomClosed);
    socket.on("matchmaking:matched", acceptConnection);
    socket.connect();

    return () => {
      socket.off("connect", resumeSavedSession);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("room:state", showSnapshot);
      socket.off("room:closed", handleRoomClosed);
      socket.off("matchmaking:matched", acceptConnection);
      socket.disconnect();
    };
  }, [acceptConnection, showSnapshot, socket]);

  function runRoomRequest<T>(
    emit: (ack: (response: ServerResponse<T>) => void) => void,
    onSuccess: (data: T) => void
  ) {
    if (!connected) {
      setError("The local game server is disconnected.");
      return;
    }

    setBusy(true);
    setError(null);
    emit((response) => {
      setBusy(false);
      if (response.ok) {
        onSuccess(response.data);
      } else {
        setError(response.message);
      }
    });
  }

  function createRoom(rules: GameRules, color: ColorChoice) {
    runRoomRequest<RoomConnection>(
      (ack) => socket.emit("room:create", { name: identity.name, playerId: identity.id, rules, color }, ack),
      acceptConnection
    );
  }

  function joinRoom(code: string) {
    runRoomRequest<RoomConnection>(
      (ack) => socket.emit("room:join", { name: identity.name, playerId: identity.id, code }, ack),
      acceptConnection
    );
  }

  function joinQueue(rules: GameRules) {
    setQueueRules(rules);
    runRoomRequest<QueueResult>(
      (ack) => socket.emit("matchmaking:join", { name: identity.name, playerId: identity.id, rules }, ack),
      (result) => setQueued(result.queued)
    );
  }

  function cancelQueue(onCancelled?: () => void) {
    runRoomRequest(
      (ack) => socket.emit("matchmaking:leave", ack),
      () => {
        setQueued(false);
        setWaitingBot(null);
        onCancelled?.();
      }
    );
  }

  function leaveRoom(exitAfter = false) {
    if (!connected) {
      clearSession();
      setSession(null);
      setSnapshot(null);
      setQueued(false);
      if (exitAfter) onExit();
      return;
    }

    runRoomRequest(
      (ack) => socket.emit("room:leave", ack),
      () => {
        clearSession();
        setSession(null);
        setSnapshot(null);
        if (exitAfter) onExit();
      }
    );
  }

  if (connecting && session && !snapshot) {
    return <ConnectionScreen label="Rejoining game" />;
  }

  if (snapshot && session) {
    if (snapshot.stage === "waiting") {
      return (
        <WaitingRoom
          snapshot={snapshot}
          session={session}
          connected={connected}
          busy={busy}
          error={error}
          onLeave={() => leaveRoom(true)}
          onRuleChange={(rules) =>
            runRoomRequest(
              (ack) => socket.emit("room:update-rules", rules, ack),
              () => undefined
            )
          }
        />
      );
    }

    return (
      <>
        {matchNotice ? <MatchFoundNotice onDone={() => setMatchNotice(false)} /> : null}
        <OnlineGame
          snapshot={snapshot}
          session={session}
          connected={connected}
          error={error}
          onError={setError}
          onLeave={() => leaveRoom(true)}
        />
      </>
    );
  }

  if (queued && waitingBot) {
    return (
      <LocalGamePage
        key={`waiting-bot-${waitingBot.session}`}
        initialRules={waitingBot.rules}
        bot={{ player: waitingBot.botPlayer, level: waitingBot.level }}
        kicker="Still searching for a match"
        onExit={() => setWaitingBot(null)}
      />
    );
  }

  return (
    <MultiplayerLobby
      playerName={identity.name}
      connected={connected}
      busy={busy}
      queued={queued}
      error={error}
      onExit={onExit}
      onCreate={createRoom}
      onJoin={joinRoom}
      onQueue={joinQueue}
      onCancelQueue={() => cancelQueue()}
      onBotWhileWaiting={(level, color) =>
        setWaitingBot({ level, rules: queueRules, botPlayer: opponentOf(resolveColorChoice(color)), session: Date.now() })
      }
      onBotInstead={(level, color) => cancelQueue(() => onPlayBot(level, queueRules, color))}
    />
  );
}

function MatchFoundNotice({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 4500);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <p className="match-toast" role="status">
      Match found! Your bot game was closed.
    </p>
  );
}

function MultiplayerLobby({
  playerName: ownName,
  connected,
  busy,
  queued,
  error,
  onExit,
  onCreate,
  onJoin,
  onQueue,
  onCancelQueue,
  onBotWhileWaiting,
  onBotInstead
}: {
  playerName: string;
  connected: boolean;
  busy: boolean;
  queued: boolean;
  error: string | null;
  onExit: () => void;
  onCreate: (rules: GameRules, color: ColorChoice) => void;
  onJoin: (code: string) => void;
  onQueue: (rules: GameRules) => void;
  onCancelQueue: () => void;
  onBotWhileWaiting: (level: BotLevel, color: ColorChoice) => void;
  onBotInstead: (level: BotLevel, color: ColorChoice) => void;
}) {
  const [mode, setMode] = useState<LobbyMode>("create");
  const [code, setCode] = useState("");
  const [forcedCaptures, setForcedCaptures] = useState(true);
  const [botLevel, setBotLevel] = useState<BotLevel>("medium");
  const [roomColor, setRoomColor] = useState<ColorChoice>("random");
  const [botColor, setBotColor] = useState<ColorChoice>("red");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "create") {
      onCreate({ forceCheckerCaptures: forcedCaptures }, roomColor);
    } else {
      onJoin(code);
    }
  }

  if (queued) {
    return (
      <main className="multiplayer-page">
        <section className="queue-screen" aria-live="polite">
          <LoaderCircle className="queue-spinner" aria-hidden="true" size={34} />
          <p className="section-kicker">Quick match</p>
          <h1>Looking for a player</h1>
          <p>You will be matched with the next player who searches with the same capture rule.</p>
          <div className="queue-bot">
            <strong>Play a bot meanwhile?</strong>
            <BotLevelPicker value={botLevel} onChange={setBotLevel} />
            <ColorPicker value={botColor} onChange={setBotColor} dark />
            <div className="queue-bot-actions">
              <button className="button primary" type="button" onClick={() => onBotWhileWaiting(botLevel, botColor)}>
                Play while I wait
              </button>
              <button className="button secondary" type="button" onClick={() => onBotInstead(botLevel, botColor)} disabled={busy}>
                Play a bot instead
              </button>
            </div>
            <small>While you wait, a found match takes over right away.</small>
          </div>
          <button className="button secondary" type="button" onClick={onCancelQueue} disabled={busy}>
            Cancel search
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="multiplayer-page">
      <button className="back-button" type="button" onClick={onExit}>
        <ChevronLeft aria-hidden="true" size={20} />
        Back
      </button>

      <section className="multiplayer-lobby" aria-labelledby="multiplayer-title">
        <header className="multiplayer-heading">
          <div className="multiplayer-icon" aria-hidden="true"><Users size={29} /></div>
          <div>
            <p className="section-kicker">Online play</p>
            <h1 id="multiplayer-title">Play online</h1>
          </div>
          <span className={`server-state ${connected ? "online" : "offline"}`}>
            <Radio aria-hidden="true" size={14} />
            {connected ? "Multiplayer server online" : "Server offline"}
          </span>
        </header>

        <div className="lobby-tabs" role="tablist" aria-label="Room action">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "create"}
            className={mode === "create" ? "active" : ""}
            onClick={() => setMode("create")}
          >
            Create room
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "join"}
            className={mode === "join" ? "active" : ""}
            onClick={() => setMode("join")}
          >
            Join room
          </button>
        </div>

        <form className="lobby-form" onSubmit={submit}>
          <p className="playing-as">
            Playing as <strong>{ownName}</strong>
          </p>

          {mode === "create" ? <ColorPicker value={roomColor} onChange={setRoomColor} dark /> : null}

          {mode === "create" ? (
            <label className="setting-toggle compact-toggle">
              <span>
                <strong>Force checker captures</strong>
                <small>Checkers must jump when able. Knights stay optional.</small>
              </span>
              <input
                type="checkbox"
                checked={forcedCaptures}
                onChange={(event) => setForcedCaptures(event.currentTarget.checked)}
              />
              <span className="toggle-track" aria-hidden="true" />
            </label>
          ) : (
            <label className="field-label">
              Room code
              <input
                className="room-code-input"
                type="text"
                value={code}
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="ABC123"
                onChange={(event) => setCode(normalizeRoomCode(event.currentTarget.value))}
              />
            </label>
          )}

          {error ? <p className="lobby-error" role="alert">{error}</p> : null}

          <button className="button primary lobby-submit" type="submit" disabled={busy || !connected || (mode === "join" && code.length !== 6)}>
            {busy ? <LoaderCircle className="button-spinner" aria-hidden="true" size={18} /> : mode === "create" ? <Swords aria-hidden="true" size={18} /> : <LogIn aria-hidden="true" size={18} />}
            {mode === "create" ? "Create private room" : "Join room"}
          </button>
        </form>

        <div className="quick-match-row">
          <div>
            <strong>Quick match</strong>
            <span>Pair with another waiting player. Colors are random.</span>
          </div>
          <button
            className="button secondary"
            type="button"
            disabled={busy || !connected}
            onClick={() => onQueue({ forceCheckerCaptures: forcedCaptures })}
          >
            Find match
          </button>
        </div>
      </section>
    </main>
  );
}

function WaitingRoom({
  snapshot,
  session,
  connected,
  busy,
  error,
  onLeave,
  onRuleChange
}: {
  snapshot: RoomSnapshot;
  session: PlayerSession;
  connected: boolean;
  busy: boolean;
  error: string | null;
  onLeave: () => void;
  onRuleChange: (rules: GameRules) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isHost = snapshot.players[session.player]?.isHost ?? false;

  async function copyCode() {
    // The clipboard API only exists on secure (https) pages.
    try {
      await navigator.clipboard.writeText(snapshot.code);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <main className="multiplayer-page">
      <button className="back-button" type="button" onClick={onLeave} disabled={busy}>
        <ChevronLeft aria-hidden="true" size={20} />
        Leave
      </button>

      <section className="waiting-room" aria-labelledby="waiting-title">
        <div className="waiting-pulse" aria-hidden="true"><Users size={30} /></div>
        <p className="section-kicker">Private room</p>
        <h1 id="waiting-title">Waiting for an opponent</h1>
        <p className="waiting-copy">Share this code with your opponent. They choose Join room and enter it.</p>

        <button className="room-code-display" type="button" onClick={copyCode} title="Copy room code">
          <span>{snapshot.code}</span>
          <small><Clipboard aria-hidden="true" size={14} /> {copied ? "Copied" : "Copy code"}</small>
        </button>

        <div className="waiting-seats">
          <WaitingSeat label="Red" name={snapshot.players.red?.name ?? "Open seat"} connected={Boolean(snapshot.players.red?.connected)} />
          <span aria-hidden="true">vs</span>
          <WaitingSeat label="Black" name={snapshot.players.black?.name ?? "Open seat"} connected={Boolean(snapshot.players.black?.connected)} />
        </div>

        <label className={`setting-toggle compact-toggle ${!isHost ? "disabled" : ""}`}>
          <span>
            <strong>Force checker captures</strong>
            <small>{isHost ? "You can change this until another player joins." : "Set by the room host."}</small>
          </span>
          <input
            type="checkbox"
            checked={snapshot.rules.forceCheckerCaptures}
            disabled={!isHost || !connected || busy}
            onChange={(event) => onRuleChange({ forceCheckerCaptures: event.currentTarget.checked })}
          />
          <span className="toggle-track" aria-hidden="true" />
        </label>

        {!connected ? <p className="lobby-error" role="alert">Reconnecting to multiplayer server...</p> : null}
        {error ? <p className="lobby-error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

function WaitingSeat({ label, name, connected }: { label: string; name: string; connected: boolean }) {
  return (
    <div className={connected ? "occupied" : ""}>
      <span className="waiting-avatar" aria-hidden="true"><UserRound size={21} /></span>
      <small>{label}</small>
      <strong>{name}</strong>
    </div>
  );
}

function OnlineGame({
  snapshot,
  session,
  connected,
  error,
  onError,
  onLeave
}: {
  snapshot: RoomSnapshot;
  session: PlayerSession;
  connected: boolean;
  error: string | null;
  onError: (message: string | null) => void;
  onLeave: () => void;
}) {
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [pieceAnimation, setPieceAnimation] = useState<PieceAnimation | null>(null);
  const [displayState, setDisplayState] = useState(snapshot.game);
  const [dialog, setDialog] = useState<GameDialog>(null);
  const latestStateRef = useRef(snapshot.game);
  const animationIdRef = useRef<number | null>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socket = useMemo(getMultiplayerSocket, []);
  const state = snapshot.game;
  const legalMoves = useMemo(
    () => !pieceAnimation && state.status.phase === "playing" && state.currentPlayer === session.player ? getLegalMoves(state) : [],
    [pieceAnimation, session.player, state]
  );
  const movesByPiece = useMemo(() => groupMovesByPiece(legalMoves), [legalMoves]);
  const selectedMoves = selectedPieceId ? movesByPiece.get(selectedPieceId) ?? [] : [];
  const opponent = session.player === "red" ? "black" : "red";
  const opponentConnected = snapshot.players[opponent]?.connected ?? false;
  const rows = session.player === "black" ? boardIndexes.slice().reverse() : boardIndexes;
  const cols = session.player === "black" ? boardIndexes.slice().reverse() : boardIndexes;
  const hasForcedCheckerCapture =
    state.rules.forceCheckerCaptures &&
    legalMoves.some((move) => move.pieceKind !== "knight" && move.captures.length > 0);

  useEffect(() => {
    if (state.forcedPieceId && state.currentPlayer === session.player) {
      setSelectedPieceId(state.forcedPieceId);
    } else if (selectedPieceId && !movesByPiece.has(selectedPieceId)) {
      setSelectedPieceId(null);
    }
  }, [movesByPiece, selectedPieceId, session.player, state.currentPlayer, state.forcedPieceId]);

  const finishPieceAnimation = useCallback((animationId: number) => {
    if (animationIdRef.current !== animationId) return;
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    animationTimerRef.current = null;
    animationIdRef.current = null;
    setPieceAnimation(null);
    setDisplayState(latestStateRef.current);
  }, []);

  useEffect(() => {
    latestStateRef.current = state;
    if (animationIdRef.current !== null) return;

    const displayedMoves = displayState.moveLog.length;
    if (state.moveLog.length === displayedMoves + 1) {
      const entry = state.moveLog[state.moveLog.length - 1];
      const movingPiece = getPieceAt(displayState, entry.from);
      if (movingPiece) {
        const animation = createForwardPieceAnimation({
          id: snapshot.revision,
          pieceId: movingPiece.id,
          pieceKind: entry.pieceKind,
          from: entry.from,
          to: entry.to,
          isCapture: entry.captured.length > 0,
          perspective: session.player
        });
        animationIdRef.current = animation.id;
        setPieceAnimation(animation);
        animationTimerRef.current = setTimeout(
          () => finishPieceAnimation(animation.id),
          500
        );
        return;
      }
    }

    if (displayState !== state) setDisplayState(state);
  }, [displayState, finishPieceAnimation, session.player, snapshot.revision, state]);

  useEffect(() => () => {
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
  }, []);

  function request(
    action: (ack: (response: ServerResponse<null>) => void) => void,
    onSuccess?: () => void
  ) {
    if (!connected) {
      onError("The game server is disconnected.");
      return;
    }

    onError(null);
    action((response) => {
      if (response.ok) {
        onSuccess?.();
      } else {
        onError(response.message);
      }
    });
  }

  function playMove(move: Move) {
    request((ack) => socket.emit("room:move", move.id, ack));
  }

  function handleSquareClick(square: Square) {
    if (pieceAnimation || !connected || !opponentConnected || state.status.phase === "won" || state.currentPlayer !== session.player) return;

    const destinationMove = selectedMoves.find(
      (move) => move.to.row === square.row && move.to.col === square.col
    );
    if (destinationMove) {
      playMove(destinationMove);
      return;
    }

    const piece = getPieceAt(displayState, square);
    if (piece?.player === session.player && movesByPiece.has(piece.id)) {
      setSelectedPieceId(piece.id);
      return;
    }

    if (!state.forcedPieceId) setSelectedPieceId(null);
  }

  const statusMessage = getOnlineStatusMessage(
    state,
    session.player,
    connected,
    opponentConnected,
    hasForcedCheckerCapture
  );
  const topPlayer = session.player === "red" ? "black" : "red";
  const bottomPlayer = session.player;
  const ownRematchVote = snapshot.rematchVotes.includes(session.player);
  const opponentRematchVote = snapshot.rematchVotes.includes(opponent);

  function requestRematch() {
    request((ack) => socket.emit("room:rematch", ack));
  }

  return (
    <main className="game-page online-game-page">
      <section className="game-workspace" aria-label="Online Knight Checkers game">
        <div className="board-column">
          <OnlinePlayerBar
            player={topPlayer}
            roomPlayer={snapshot.players[topPlayer]}
            active={state.status.phase === "playing" && state.currentPlayer === topPlayer}
            state={state}
          />

          <div className="board-frame">
            <div className="board" role="grid" aria-label={`Knight Checkers board, ${playerName(session.player)} side`}>
              {rows.flatMap((row, visualRow) =>
                cols.map((col, visualCol) => {
                  const square = { row, col };
                  const piece = getPieceAt(displayState, square);
                  const squareMove = selectedMoves.find((move) => move.to.row === row && move.to.col === col);
                  const isSelected = selectedPieceId === piece?.id;
                  const isForcedPiece = displayState.forcedPieceId === piece?.id;
                  const isRestingKnight = Boolean(piece?.kind === "knight" && displayState.knightCooldown[piece.player] > 0);

                  return (
                    <button
                      className={[
                        "square",
                        isDarkSquare(square) ? "dark-square" : "light-square",
                        squareMove ? "legal-square" : "",
                        squareMove?.captures.length ? "capture-square" : "",
                        isSelected ? "selected-square" : "",
                        isForcedPiece ? "forced-piece-square" : ""
                      ].filter(Boolean).join(" ")}
                      key={`${row}-${col}`}
                      type="button"
                      role="gridcell"
                      aria-label={squareAriaLabel(square, piece, squareMove, isRestingKnight)}
                      onClick={() => handleSquareClick(square)}
                    >
                      {piece ? (
                        <PieceToken
                          piece={piece}
                          resting={isRestingKnight}
                          animation={pieceAnimation?.pieceId === piece.id ? pieceAnimation : null}
                          onAnimationEnd={finishPieceAnimation}
                        />
                      ) : null}
                      {squareMove ? <span className="move-target" aria-hidden="true" /> : null}
                      {visualCol === BOARD_SIZE - 1 ? <span className="rank-label" aria-hidden="true">{BOARD_SIZE - row}</span> : null}
                      {visualRow === BOARD_SIZE - 1 ? <span className="file-label" aria-hidden="true">{String.fromCharCode(97 + col)}</span> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <OnlinePlayerBar
            player={bottomPlayer}
            roomPlayer={snapshot.players[bottomPlayer]}
            active={state.status.phase === "playing" && state.currentPlayer === bottomPlayer}
            isYou
            state={state}
          />

          <GameEventOverlay
            snapshot={snapshot}
            session={session}
            connected={connected}
            onLeave={onLeave}
            onRematch={requestRematch}
          />
        </div>

        <aside className="game-panel" aria-label="Online game controls and move history">
          <header className="game-panel-header">
            <button className="icon-button" type="button" onClick={() => setDialog("leave")} aria-label="Leave game" title="Leave game">
              <Home aria-hidden="true" size={20} />
            </button>
            <div>
              <p className="section-kicker">Room {snapshot.code}</p>
              <strong>Online match</strong>
            </div>
            <span className={`connection-indicator ${connected ? "online" : "offline"}`} title={connected ? "Connected" : "Disconnected"}>
              <Radio aria-hidden="true" size={16} />
            </span>
          </header>

          <section className={`turn-status ${state.status.phase === "won" ? "game-over" : ""}`} aria-live="polite">
            <span className={`status-color ${state.status.phase === "won" ? state.status.winner : state.currentPlayer}`} />
            <div>
              <p>{state.status.phase === "won" ? "Game over" : state.currentPlayer === session.player ? "Your move" : `${snapshot.players[opponent]?.name ?? playerName(opponent)} to move`}</p>
              <span>{statusMessage}</span>
            </div>
            {state.canEndJump && state.currentPlayer === session.player ? (
              <button className="text-button" type="button" onClick={() => request((ack) => socket.emit("room:end-jump", ack))}>End turn</button>
            ) : null}
          </section>

          <MoveList state={state} />

          <ChatPanel
            snapshot={snapshot}
            session={session}
            connected={connected}
            onSend={(message, onSent) =>
              request((ack) => socket.emit("room:chat", message, ack), onSent)
            }
          />

          <footer className="game-actions online-actions">
            <button
              className="danger-action"
              type="button"
              onClick={() => setDialog("resign")}
              disabled={state.status.phase === "won" || !connected}
              title="Resign game"
            >
              <DoorOpen aria-hidden="true" size={19} />
              <span>Resign</span>
            </button>
            <button
              className={opponentRematchVote ? "rematch-action requested" : "rematch-action"}
              type="button"
              onClick={requestRematch}
              disabled={state.status.phase !== "won" || ownRematchVote || !connected || !opponentConnected}
              title="Request a rematch"
            >
              <RotateCcw aria-hidden="true" size={19} />
              <span>{ownRematchVote ? "Waiting" : opponentRematchVote ? "Accept" : "Rematch"}</span>
            </button>
            <button type="button" onClick={() => setDialog("rules")} title="View rules">
              <BookOpen aria-hidden="true" size={19} />
              <span>Rules</span>
            </button>
          </footer>
        </aside>
      </section>

      {error ? <div className="game-toast" role="alert">{error}</div> : null}

      {dialog === "rules" ? (
        <Modal title="How to play" onClose={() => setDialog(null)}>
          <p className="rules-copy">Move checkers diagonally, jump enemies, chain available jumps, and crown pieces on the far row. Knights move and capture like chess knights, rest through their owner&apos;s next turn after moving, and are never forced to capture. Win by taking every enemy checker; the knight may survive.</p>
          <div className="modal-actions single-action"><button className="button primary" type="button" data-autofocus onClick={() => setDialog(null)}>Got it</button></div>
        </Modal>
      ) : null}

      {dialog === "resign" ? (
        <Modal title="Resign this game?" description="Your opponent will win the current match." tone="danger" onClose={() => setDialog(null)}>
          <div className="modal-actions">
            <button className="button secondary" type="button" onClick={() => setDialog(null)}>Cancel</button>
            <button className="button danger" type="button" data-autofocus onClick={() => { setDialog(null); request((ack) => socket.emit("room:resign", ack)); }}>Resign</button>
          </div>
        </Modal>
      ) : null}

      {dialog === "leave" ? (
        <Modal title="Leave this room?" description={state.status.phase === "playing" ? "Leaving an active match counts as a resignation." : "You will return to the home screen."} onClose={() => setDialog(null)}>
          <div className="modal-actions">
            <button className="button secondary" type="button" onClick={() => setDialog(null)}>Stay</button>
            <button className="button danger" type="button" data-autofocus onClick={onLeave}>Leave room</button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

function GameEventOverlay({
  snapshot,
  session,
  connected,
  onLeave,
  onRematch
}: {
  snapshot: RoomSnapshot;
  session: PlayerSession;
  connected: boolean;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const state = snapshot.game;
  const opponent = session.player === "red" ? "black" : "red";
  const opponentName = snapshot.players[opponent]?.name ?? playerName(opponent);
  const opponentConnected = snapshot.players[opponent]?.connected ?? false;
  const ownRematchVote = snapshot.rematchVotes.includes(session.player);
  const opponentRematchVote = snapshot.rematchVotes.includes(opponent);
  const disconnectSeconds = useCountdownSeconds(snapshot.disconnectDeadlines[opponent]);
  // "View board" hides the result card; a rematch (a new game) brings it back next time.
  const [resultHidden, setResultHidden] = useState(false);
  const isOver = state.status.phase === "won";
  useEffect(() => {
    if (!isOver) setResultHidden(false);
  }, [isOver]);

  if (connected && opponentConnected && state.status.phase === "playing") {
    return null;
  }

  if (!connected || (state.status.phase === "playing" && !opponentConnected)) {
    const serverOffline = !connected;
    return (
      <div className="game-event-layer" role="status" aria-live="assertive">
        <section className="game-event-card disconnected-event">
          <span className="game-event-icon" aria-hidden="true"><WifiOff size={30} /></span>
          <p className="section-kicker">Match paused</p>
          <h2>{serverOffline ? "Connection lost" : `${opponentName} disconnected`}</h2>
          {serverOffline || disconnectSeconds === null ? null : (
            <strong className="disconnect-countdown" aria-label={`${disconnectSeconds} seconds remaining`}>{disconnectSeconds}</strong>
          )}
          <p>{serverOffline ? "Reconnecting to the game server..." : `Their seat is being held for ${disconnectSeconds ?? 30} seconds. If they do not reconnect, the match ends by resignation.`}</p>
          <button className="button secondary" type="button" onClick={onLeave}>Leave room</button>
        </section>
      </div>
    );
  }

  if (state.status.phase !== "won" || resultHidden) {
    return null;
  }

  const didWin = state.status.winner === session.player;
  const opponentLeft = didWin && state.status.reason === "resignation" && !opponentConnected;
  const resultLabel = didWin ? "Victory" : "Defeat";
  const resultTitle = opponentLeft
    ? `${opponentName} left the match`
    : state.status.reason === "resignation"
      ? didWin
        ? `${opponentName} resigned`
        : "You resigned"
      : didWin
        ? "You won"
        : `${opponentName} won`;
  const title = ownRematchVote
    ? "Rematch requested"
    : opponentRematchVote
      ? `${opponentName} wants a rematch`
      : resultTitle;
  const description = ownRematchVote
    ? `Waiting for ${opponentName} to accept.`
    : opponentRematchVote
      ? "Accept to reset the board and play again with the same rules."
      : state.status.message;

  return (
    <div className="game-event-layer" role="status" aria-live="assertive">
      <section className={`game-event-card result-event ${didWin ? "won" : "lost"}`}>
        <span className="game-event-icon" aria-hidden="true"><Trophy size={32} /></span>
        <p className="section-kicker">{resultLabel}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="game-event-actions">
          <button
            className="button primary"
            type="button"
            onClick={onRematch}
            disabled={ownRematchVote || !connected || !opponentConnected}
          >
            <RotateCcw aria-hidden="true" size={17} />
            {!opponentConnected ? "Opponent left" : ownRematchVote ? "Waiting for opponent" : opponentRematchVote ? "Accept rematch" : "Request rematch"}
          </button>
          <button className="button secondary" type="button" onClick={onLeave}>Leave room</button>
          <button className="button secondary" type="button" onClick={() => setResultHidden(true)}>View board</button>
        </div>
      </section>
    </div>
  );
}

function useCountdownSeconds(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [deadline]);

  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

function OnlinePlayerBar({
  player,
  roomPlayer,
  active,
  isYou = false,
  state
}: {
  player: Player;
  roomPlayer: RoomSnapshot["players"][Player];
  active: boolean;
  isYou?: boolean;
  state: GameState;
}) {
  return (
    <div className={`player-bar ${player} ${active ? "active" : ""} ${roomPlayer?.connected ? "" : "disconnected"}`}>
      <span className="player-avatar" aria-hidden="true"><UserRound size={22} /></span>
      <div className="player-identity">
        <strong>{roomPlayer?.name ?? "Open seat"}</strong>
        <span>{isYou ? `You · ${playerName(player)} · Unrated` : `${playerName(player)} · Unrated`}</span>
        <MaterialStrip state={state} player={player} />
      </div>
      <div className="player-turn-state">
        <span className="turn-pip" aria-hidden="true" />
        {!roomPlayer?.connected ? "Offline" : active ? "To move" : "Waiting"}
      </div>
    </div>
  );
}

function MoveList({ state }: { state: GameState }) {
  return (
    <section className="moves-section" aria-labelledby="moves-title">
      <div className="moves-heading">
        <h2 id="moves-title">Moves</h2>
        <span>{state.moveLog.length}</span>
      </div>
      <ol className="move-list">
        {state.moveLog.length === 0 ? (
          <li className="empty-moves">Moves will appear here.</li>
        ) : (
          state.moveLog.slice().reverse().map((entry, index) => (
            <li key={`${entry.turn}-${entry.notation}-${index}`}>
              <span className="move-number">{entry.turn}</span>
              <span className={`move-player ${entry.player}`} aria-hidden="true" />
              <span className="move-notation">{entry.notation}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

function ChatPanel({
  snapshot,
  session,
  connected,
  onSend
}: {
  snapshot: RoomSnapshot;
  session: PlayerSession;
  connected: boolean;
  onSend: (message: string, onSent: () => void) => void;
}) {
  const messageListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [snapshot.chat.length]);

  return (
    <section className="chat-section" aria-labelledby="chat-title">
      <div className="chat-heading">
        <span><MessageSquare aria-hidden="true" size={16} /></span>
        <h2 id="chat-title">Room chat</h2>
      </div>
      <div className="chat-messages" ref={messageListRef} aria-live="polite">
        {snapshot.chat.length === 0 ? (
          <p className="empty-chat">No messages yet.</p>
        ) : (
          snapshot.chat.map((chatMessage) => {
            const isYou = chatMessage.player === session.player;
            const sender = isYou ? "You" : snapshot.players[chatMessage.player]?.name ?? playerName(chatMessage.player);
            return (
              <div className={`chat-message ${isYou ? "own" : "opponent"}`} key={chatMessage.id}>
                <strong>{sender}</strong>
                <p>{chatMessage.text}</p>
              </div>
            );
          })
        )}
      </div>
      <div className="quick-chat" aria-label="Quick messages">
        {QUICK_CHAT_MESSAGES.map((quickMessage) => (
          <button
            key={quickMessage}
            type="button"
            disabled={!connected}
            onClick={() => onSend(quickMessage, () => undefined)}
          >
            {quickMessage}
          </button>
        ))}
      </div>
    </section>
  );
}

function ConnectionScreen({ label }: { label: string }) {
  return (
    <main className="multiplayer-page">
      <section className="queue-screen" aria-live="polite">
        <LoaderCircle className="queue-spinner" aria-hidden="true" size={34} />
        <h1>{label}</h1>
      </section>
    </main>
  );
}

function createForwardPieceAnimation({
  id,
  pieceId,
  pieceKind,
  from,
  to,
  isCapture,
  perspective
}: {
  id: number;
  pieceId: string;
  pieceKind: Piece["kind"];
  from: Square;
  to: Square;
  isCapture: boolean;
  perspective: Player;
}): PieceAnimation {
  const orientation = perspective === "black" ? -1 : 1;
  return {
    id,
    pieceId,
    mode: pieceKind === "knight" || isCapture ? "hop" : "slide",
    direction: "forward",
    style: {
      "--move-to-x": `${(to.col - from.col) * CELL_DISTANCE_IN_TOKEN_PERCENT * orientation}%`,
      "--move-to-y": `${(to.row - from.row) * CELL_DISTANCE_IN_TOKEN_PERCENT * orientation}%`
    } as CSSProperties & { "--move-to-x": string; "--move-to-y": string }
  };
}

function groupMovesByPiece(moves: Move[]) {
  const grouped = new Map<string, Move[]>();
  for (const move of moves) grouped.set(move.pieceId, [...(grouped.get(move.pieceId) ?? []), move]);
  return grouped;
}

function getOnlineStatusMessage(
  state: GameState,
  player: Player,
  connected: boolean,
  opponentConnected: boolean,
  hasForcedCheckerCapture: boolean
) {
  if (!connected) return "Reconnecting to the game server...";
  if (!opponentConnected) return "Waiting for your opponent to reconnect.";
  if (state.status.phase === "won") return state.status.message;
  if (state.currentPlayer !== player) return "Waiting for your opponent.";
  if (state.forcedPieceId && state.canEndJump) return "Continue jumping or end the turn.";
  if (state.forcedPieceId) return "A checker must finish its jump.";
  if (hasForcedCheckerCapture) return "A checker capture is available.";
  return "Select a piece to make a move.";
}

function squareAriaLabel(square: Square, piece: Piece | null, move: Move | undefined, isRestingKnight: boolean) {
  const contents = piece ? `${playerName(piece.player)} ${pieceName(piece.kind)}` : "empty";
  const restText = isRestingKnight ? ", resting" : "";
  const moveText = move ? move.captures.length > 0 ? ", capture destination" : ", legal destination" : "";
  return `${squareName(square)}, ${contents}${restText}${moveText}`;
}

function normalizeRoomCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function writeSession(session: PlayerSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readSession(): PlayerSession | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as PlayerSession : null;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
