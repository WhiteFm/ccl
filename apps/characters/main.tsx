import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CharacterApp from "./app/CharacterApp";
import "./app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root is missing");
}

createRoot(root).render(
  <StrictMode>
    <CharacterApp />
  </StrictMode>,
);
