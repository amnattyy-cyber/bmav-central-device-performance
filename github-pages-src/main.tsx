import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import MongkolDashboard from "../app/mongkol-dashboard";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Dashboard root element was not found");
}

function DashboardRouter() {
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const syncRoute = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);
  return route === "#/mongkol" ? <MongkolDashboard /> : <Home />;
}

createRoot(root).render(<React.StrictMode><DashboardRouter /></React.StrictMode>);
