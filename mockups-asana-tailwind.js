/*
 * Shared Asana-style Tailwind config for HTML mockups.
 *
 * Usage in a mockup HTML:
 *   <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
 *   <script src="../mockups-asana-tailwind.js"></script>
 *
 * Replaces the per-mockup inline tailwind.config blocks with one unified
 * Asana-style light palette (coral primary, cream sidebar, pastel accents).
 */
(function applyAsanaTailwindConfig() {
  if (typeof window === "undefined" || !window.tailwind) {
    return;
  }

  window.tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          /* Surfaces */
          surface: "#ffffff",
          "surface-dim": "#f9f8f8",
          "surface-bright": "#ffffff",
          "surface-container": "#faf8f7",
          "surface-container-low": "#fcfbfa",
          "surface-container-high": "#f4f1ef",
          "surface-container-highest": "#ece8e6",
          "surface-container-lowest": "#ffffff",
          background: "#ffffff",

          /* Sidebar */
          sidebar: "#fcf8f7",
          "sidebar-hover": "#f1ece9",
          "sidebar-active": "#ffe4e0",

          /* Primary — Asana coral */
          primary: "#f06a6a",
          "primary-hover": "#e25555",
          "primary-pressed": "#c84545",
          "primary-container": "#ffe4e0",
          "primary-fixed": "#f06a6a",
          "primary-fixed-dim": "#ffcdc6",
          "on-primary": "#ffffff",
          "on-primary-container": "#6e1d1d",
          "on-primary-fixed": "#6e1d1d",
          "on-primary-fixed-variant": "#c84545",
          "inverse-primary": "#ffafa6",

          /* Secondary — muted */
          secondary: "#6f7782",
          "secondary-container": "#eef0f2",
          "secondary-fixed": "#eef0f2",
          "secondary-fixed-dim": "#d8dde3",
          "on-secondary": "#ffffff",
          "on-secondary-container": "#3a4453",
          "on-secondary-fixed": "#3a4453",
          "on-secondary-fixed-variant": "#525c69",

          /* Tertiary — Asana lavender (AI accent) */
          tertiary: "#8d6cdc",
          "tertiary-container": "#ece5fc",
          "tertiary-fixed": "#8d6cdc",
          "tertiary-fixed-dim": "#c9b8f3",
          "on-tertiary": "#ffffff",
          "on-tertiary-container": "#3b257a",
          "on-tertiary-fixed": "#3b257a",
          "on-tertiary-fixed-variant": "#5a3eb5",

          /* Status pastels */
          success: "#4cb782",
          "success-container": "#d6f0e2",
          "on-success-container": "#1f5e3d",
          warning: "#f1bd6c",
          "warning-container": "#fdecd1",
          "on-warning-container": "#6e4a14",
          info: "#4573d2",
          "info-container": "#dde7f9",
          "on-info-container": "#1f3d7a",

          /* Error */
          error: "#d1483c",
          "error-container": "#fadcd9",
          "on-error": "#ffffff",
          "on-error-container": "#6e1d18",

          /* Text */
          "on-surface": "#1e1f21",
          "on-surface-variant": "#6f7782",
          "on-surface-muted": "#9ca6b2",
          "on-background": "#1e1f21",
          "inverse-surface": "#1e1f21",
          "inverse-on-surface": "#ffffff",

          /* Outlines */
          outline: "#d8dde3",
          "outline-variant": "#ece8e6",
          "outline-strong": "#a8b1bd",
          "surface-tint": "#f06a6a",

          /* Asana category accents */
          "accent-coral": "#f06a6a",
          "accent-pink": "#f9a7c2",
          "accent-lavender": "#b8a0e8",
          "accent-blue": "#6ebeed",
          "accent-teal": "#4ecdc4",
          "accent-green": "#6fd391",
          "accent-lime": "#c5e066",
          "accent-yellow": "#f5d76e",
          "accent-orange": "#f8a26b",
        },
        borderRadius: {
          DEFAULT: "0.375rem",
          sm: "0.25rem",
          md: "0.5rem",
          lg: "0.75rem",
          xl: "1rem",
          "2xl": "1.25rem",
          full: "9999px",
        },
        boxShadow: {
          card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 4px rgba(15, 23, 42, 0.04)",
          elevated:
            "0 2px 4px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)",
          popover:
            "0 4px 8px rgba(15, 23, 42, 0.06), 0 16px 40px rgba(15, 23, 42, 0.1)",
        },
        fontFamily: {
          headline: ["Manrope", "system-ui", "sans-serif"],
          body: ["Inter", "system-ui", "sans-serif"],
          label: ["Inter", "system-ui", "sans-serif"],
        },
      },
    },
  };
})();
