# Obsidian & Emerald POS Design System

This document outlines the visual identity and design principles for the Fatboy POS application.

## 🎨 Color Palette

The color system follows a high-contrast dark theme with premium accents.

| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Surface** | `#131313` | Main background and base layers |
| **Surface Container** | `#201f1f` | Cards, input backgrounds, sidebars |
| **Primary (Emerald/Gold)** | `#FFD700` | High-importance actions, active states, accents |
| **Secondary (Steel Blue)** | `#b7c8e1` | Secondary information, badges, borders |
| **Tertiary (Peach)** | `#ffb595` | Muted accents, specific categories |
| **Error** | `#ffb4ab` | Destructive actions, negative currency, deletions |
| **Outline** | `#8b90a0` | Muted text, tertiary labels, inactive states |

## Typography

The system uses a readable, high-contrast type system designed for fast scanning on dense operational screens.

- **Primary Font**: `Source Sans 3` (Sans-serif, optimized for UI legibility)
- **Monospaced Font**: `JetBrains Mono` (For scripts/receipts)

### Usage Patterns
- **Headlines**: `font-headline font-black uppercase tracking-tighter` (Compact & Bold)
- **Labels (High Density)**: `font-label font-bold text-[8px] tracking-widest uppercase`
- **Secondary Text**: `text-outline uppercase font-bold text-[7px]`
- **Currency (Major)**: `text-xl font-headline font-black`
- **Currency (Inline)**: `text-[10px] font-black`

## 🧱 Component Standards

### 1. Buttons
- **Primary**: `bg-primary text-on-primary font-black uppercase shadow-lg shadow-primary/20`
- **Secondary**: `bg-surface-container-highest text-outline uppercase border border-outline-variant/10`
- **Navigation**: `p-2 bg-surface-container hover:bg-surface-container-high active:scale-95 transition-all`

### 2. Modals
- **Overlay**: `bg-black/80 backdrop-blur-md`
- **Container**: `bg-surface-container-low border border-outline-variant/20 shadow-2xl overflow-hidden`
- **Density**: Maximize utilization; avoid excessive whitespace. Padding should be consistent (e.g., `p-6` for content).

### 3. Cards & Sections
- **Borders**: Subtle `border border-outline-variant/5` or `border-l-4` for highlighting status.
- **Backgrounds**: Slightly lighter than main surface (`bg-surface-container-low`).

## ⚡ Interactive States
- **Hover**: Visual change in background or brightness (`hover:brightness-110` or `hover:bg-surface-container-high`).
- **Active**: Tactical haptic-like feedback using `active:scale-95 transition-all`.
- **Loading**: Pulse animations for small accents (`bg-primary animate-pulse`).

## 📏 Layout Principles
- **Sidebar (Collapsible)**: Primary navigation Icons (64px) / Full list (256px).
- **Bottom Bar**: Contextual actions.
- **Grids**: Favor CSS Grid with small gaps (`gap-1.5`, `gap-2`).
- **Density**: Avoid "Bento" style padding. Prefer "Industrial" high-density alignment.

---
*Created on March 30, 2026. Antigravity AI.*
