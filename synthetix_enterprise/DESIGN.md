# Design System Specification: The Intelligent Layer

## 1. Overview & Creative North Star
**Creative North Star: "The Cognitive Architecture"**

This design system is not a static library of parts; it is a living framework designed to bridge the gap between enterprise-grade stability and the fluid, predictive nature of modern AI. We reject the "boxed-in" aesthetic of legacy platforms. Instead, we embrace a "Cognitive Architecture" that uses tonal depth, intentional asymmetry, and editorial typography to guide the user through complex low-code logic.

To move beyond the generic "SaaS dashboard," this system prioritizes **Tonal Layering** over structural lines. By removing traditional borders, we create a sense of infinite workspace—an environment where AI-driven insights don't just sit on top of data but are woven into the very fabric of the UI.

---

## 2. Color & Tonal Strategy

Our palette balances the authoritative weight of **Deep Slate** and **Professional Blue** with the vibrant, organic pulse of **Emerald Green**.

### The "No-Line" Rule
Explicitly prohibit the use of 1px solid borders for sectioning or layout containment. Boundaries must be defined through:
1.  **Background Shifts:** Using `surface-container-low` against a `surface` background.
2.  **Tonal Transitions:** Leveraging the `surface-container` tiers to distinguish global navigation from the active workspace.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of frosted glass.
-   **Base Layer:** `surface` (#f8f9ff) for the primary application background.
-   **Content Areas:** `surface-container-low` (#eff4ff) to define the main working canvas.
-   **Active Modules:** `surface-container-lowest` (#ffffff) for cards and data modules to provide maximum contrast and "pop."
-   **High-Intensity Contexts:** `surface-container-highest` (#d3e4fe) for sidebars or property panels that require visual anchoring.

### Signature Textures & Glassmorphism
-   **The AI Pulse:** Use a subtle linear gradient (`primary` to `primary-container`) for high-level CTAs to provide a sense of "depth and soul."
-   **Floating Intelligence:** Floating menus and AI command bars must use Glassmorphism. Apply a 70% opacity to `surface-container-lowest` combined with a `backdrop-blur` (16px–24px). This allows the underlying data density to remain visible while focusing the user's attention.

---

## 3. Typography: Editorial Authority

We use a dual-typeface system to create an "Editorial Enterprise" feel.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "AI" aesthetic. Use `display-lg` through `headline-sm` for page headers and high-level summaries.
*   **Functional Interface (Inter):** The workhorse. Inter provides maximum legibility for low-code logic and data tables.

**The Hierarchy of Intent:**
-   **Display (Manrope, 3.5rem - 2.25rem):** High-contrast, tight letter-spacing for brand moments.
-   **Title (Inter, 1.375rem - 1rem):** Bold weights for section headers within modules.
-   **Body (Inter, 1rem - 0.75rem):** Optimized for high-density data reading.

---

## 4. Elevation & Depth: The Layering Principle

Standard drop shadows are strictly forbidden. Depth is achieved through light and material properties.

*   **Tonal Stacking:** Instead of a shadow, place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift.
*   **Ambient Shadows:** For floating elements (Modals, Popovers), use an extra-diffused shadow:
    *   `box-shadow: 0 12px 40px rgba(11, 28, 48, 0.06);`
    *   Note: The shadow color is a tinted version of `on-surface` (#0b1c30), not pure black.
*   **The "Ghost Border":** If accessibility requires a container boundary, use `outline-variant` (#c6c6cd) at 15% opacity. It should be felt, not seen.

---

## 5. Components & Interaction Patterns

### Buttons: The Weighted Scale
-   **Primary:** Solid `primary` (#000000) with `on-primary` text. Use for the single most important action (e.g., "Deploy").
-   **Secondary/AI Suggested:** Solid `tertiary_container` (#002113) with `tertiary_fixed` (#6ffbbe) text. This specific Emerald combination marks AI-augmented paths.
-   **Tertiary:** Transparent background with `on-surface` text. Only a ghost-border on hover.

### Cards & Data Lists
-   **The Divider Prohibition:** Do not use line dividers between list items. Use 12px–16px of vertical white space or a 2-step shift in surface tokens (e.g., `surface-container-low` to `surface-container-lowest`) on hover to define rows.
-   **Radius:** All containers must adhere to the `DEFAULT` (0.5rem / 8px) roundedness for a friendly yet professional finish.

### Input Fields: High Density
-   **Resting:** No border. `surface-container-high` background.
-   **Focus:** A 2px signature blue (`surface_tint`) soft glow. No harsh 1px outlines.
-   **AI Suggestion:** A subtle `tertiary_fixed` (Emerald) glow indicates the AI has pre-filled or suggested a value.

### The "Logic Node" (Unique Component)
For the low-code canvas, use nodes with `surface-container-lowest` backgrounds and `outline-variant` at 20%. Connectors should be soft-curved paths using `primary-fixed-dim` to maintain an "Enterprise Blue" professional tone.

---

## 6. Do's and Don'ts

### Do
-   **Do** use extreme white space to separate logic blocks. 
-   **Do** use `tertiary` (Emerald) sparingly. It is a "signal," not a decorative color.
-   **Do** nest containers to create depth (Lowest inside Low).
-   **Do** prioritize typographic scale over color to show importance.

### Don't
-   **Don't** use 100% opaque, high-contrast borders.
-   **Don't** use standard "drop shadows" with high opacity or small blurs.
-   **Don't** use dividers or lines to separate list items; let the space breathe.
-   **Don't** mix the `display` (Manrope) font into functional data tables.

---

## 7. Token Summary Reference

| Role | Token | Value |
| :--- | :--- | :--- |
| **Primary Base** | `primary` | #000000 |
| **AI Action** | `tertiary_container` | #002113 |
| **App Canvas** | `surface` | #f8f9ff |
| **Floating Card** | `surface-container-lowest` | #ffffff |
| **Radius** | `DEFAULT` | 0.5rem (8px) |
| **Headline** | `headline-lg` | Manrope 2rem |