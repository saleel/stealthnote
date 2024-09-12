import React from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import "./styles.css";
import App from "./app.tsx";

globalThis.Buffer = Buffer;

createRoot(document.getElementById("root")!).render(<App />);
