import React from "react";
import ReactDOM from "react-dom/client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { PenTool } from "lucide-react";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import SmoothCursor from "./components/SmoothCursor.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Tooltip.Provider delayDuration={400} skipDelayDuration={100}>
      <AuthProvider>
        <App />
        <SmoothCursor rotate={false} hotspot={{ x: "8%", y: "8%" }} cursor={<PenTool size={30} strokeWidth={1.5} color="#fff" fill="#000" />} />
      </AuthProvider>
    </Tooltip.Provider>
  </React.StrictMode>
);
