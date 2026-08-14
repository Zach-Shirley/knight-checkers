import { useEffect, useState } from "react";
import { HomePage } from "./components/HomePage";
import { LocalGamePage } from "./components/LocalGamePage";
import { MultiplayerPage } from "./components/MultiplayerPage";
import type { GameRules } from "./game";

type AppRoute = "/" | "/local" | "/multiplayer";

function getRoute(): AppRoute {
  const path = window.location.pathname.replace(/\/$/, "") || "/";

  if (path === "/local" || path === "/multiplayer") {
    return path;
  }

  return "/";
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(getRoute);
  const [localRules, setLocalRules] = useState<GameRules>({ forceCheckerCaptures: true });
  const [localSession, setLocalSession] = useState(0);

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

  if (route === "/local") {
    return (
      <LocalGamePage
        key={localSession}
        initialRules={localRules}
        onExit={() => navigate("/")}
      />
    );
  }

  if (route === "/multiplayer") {
    return <MultiplayerPage onExit={() => navigate("/")} />;
  }

  return (
    <HomePage
      onStartLocal={startLocalGame}
      onOpenMultiplayer={() => navigate("/multiplayer")}
    />
  );
}
