// The inspector's entry: the generated client on the page's own origin, which
// is the server that served it (ADR 0027). No StrictMode: its doubled effects
// in development would make each lane read twice, and every read is an event.
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { createEngramClient } from "./api/index.ts";
import "./style.css";

const root = document.getElementById("root");
if (root === null) throw new Error("the page has no #root element");
createRoot(root).render(<App client={createEngramClient({ baseUrl: window.location.origin })} />);
