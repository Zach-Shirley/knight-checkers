import { useEffect, useState } from "react";
import { HomePage } from "./components/HomePage";
import { LocalGamePage } from "./components/LocalGamePage";
import { MultiplayerPage } from "./components/MultiplayerPage";
import type { BotLevel } from "./bot";
import type { GameRules } from "./game";

type AppRoute = "/" | "/local" | "/bot" | "/multiplayer";

function getRoute(): AppRoute {
  const path = window.location.pathname.replace(/\/$/, "") || "/";

  if (path === "/local" || path === "/bot" || path === "/multiplayer") {
    return path;
  }

  return "/";
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(getRoute);
  const [localRules, setLocalRules] = useState<GameRules>({ forceCheckerCaptures: true });
  const [localSession, setLocalSession] = useState(0);
  const [botLevel, setBotLevel] = useState<BotLevel>("medium");

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextRoute: AppRoute) {
    if (nextRoute !== route) {
      window.history.pushState({}, "", nextRoute);
      setRoute(nextRoute);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  function startLocalGame(rules: GameRules) {
    setLocalRules(rules);
    setLocalSession((current) => current + 1);
    navigate("/local");
  }

  function startBotGame(level: BotLevel, rules: GameRules) {
    setBotLevel(level);
    setLocalRules(rules);
    setLocalSession((current) => current + 1);
    navigate("/bot");
  }

  if (route === "/local") {
    return (
      <LocalGamePage
        key={localSession}
        initialRules={localRules}
        onExit={() => navigate("/")}
      />
    );
  }

  if (route === "/bot") {
    return (
      <LocalGamePage
        key={`bot-${localSession}`}
        initialRules={localRules}
        bot={{ player: "black", level: botLevel }}
        onExit={() => navigate("/")}
      />
    );
  }

  if (route === "/multiplayer") {
    return <MultiplayerPage onExit={() => navigate("/")} onPlayBot={startBotGame} />;
  }

  return (
    <HomePage
      onStartLocal={startLocalGame}
      onStartBot={startBotGame}
      onOpenMultiplayer={() => navigate("/multiplayer")}
    />
  );
}
