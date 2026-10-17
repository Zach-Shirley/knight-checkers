import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { syncStatusBarWithPages } from "./platform";
import "./styles.css";

const root = document.getElementById("root") as HTMLElement;
syncStatusBarWithPages(root);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
