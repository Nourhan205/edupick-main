import React, { useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa";
import "./ThemeToggle.css";

export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || localStorage.getItem("ep-theme") || "dark"
  );

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ep-theme", next);
  };

  return (
    <button
      className={`theme-toggle ${className}`}
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb">
          {theme === "dark" ? <FaMoon /> : <FaSun />}
        </span>
      </span>
    </button>
  );
}
