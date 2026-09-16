import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
export { unwrapImportedMesh } from "./unwrap-consumer";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}
