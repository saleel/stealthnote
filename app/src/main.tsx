import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import { GoogleOAuthProvider } from "@react-oauth/google";

createRoot(document.getElementById("root")!).render(

    <App />

);
