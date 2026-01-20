# Workflow Studio - Design System

## Brand Identity

**Workflow Studio** is a premium workflow automation tool designed for gamers and power users who want to automate repetitive tasks in video games. The design language reflects precision, power, and professional-grade tooling while maintaining an approachable, modern aesthetic.

### Brand Values
- **Precision** - Every interaction should feel exact and intentional
- **Power** - The interface communicates capability without complexity
- **Flow** - Smooth transitions and animations that don't interrupt workflow
- **Trust** - A professional appearance that instills confidence

---

## Color Palette

### Primary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Cyan 500 | `#06B6D4` | 6, 182, 212 | Primary actions, active states, brand accent |
| Cyan 400 | `#22D3EE` | 34, 211, 238 | Hover states, highlights |
| Cyan 600 | `#0891B2` | 8, 145, 178 | Pressed states |
| Cyan 300 | `#67E8F9` | 103, 232, 249 | Glows, subtle accents |

### Secondary / Background Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Black | `#000000` | 0, 0, 0 | Primary background |
| Gray 950 | `#09090B` | 9, 9, 11 | App background |
| Gray 900 | `#0C0C0F` | 12, 12, 15 | Card backgrounds |
| Gray 850 | `#111114` | 17, 17, 20 | Elevated surfaces |
| Gray 800 | `#18181B` | 24, 24, 27 | Input backgrounds, tertiary surfaces |
| Gray 700 | `#27272A` | 39, 39, 42 | Borders, dividers |
| Gray 600 | `#3F3F46` | 63, 63, 70 | Subtle borders, disabled states |

### Text Colors
| Name | Hex | Usage |
|------|-----|-------|
| White | `#FFFFFF` | Primary text, headings |
| Gray 100 | `#F4F4F5` | Body text |
| Gray 300 | `#D4D4D8` | Secondary text |
| Gray 400 | `#A1A1AA` | Muted text, placeholders |
| Gray 500 | `#71717A` | Disabled text, hints |

### Semantic Colors
| Name | Hex | Usage |
|------|-----|-------|
| Success | `#10B981` | Running states, success messages |
| Success Glow | `rgba(16, 185, 129, 0.15)` | Success backgrounds |
| Error | `#EF4444` | Stop actions, errors |
| Error Glow | `rgba(239, 68, 68, 0.15)` | Error backgrounds |
| Warning | `#F59E0B` | Recording states, warnings |
| Warning Glow | `rgba(245, 158, 11, 0.1)` | Warning backgrounds |

---

## Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
```

### Monospace (Code/Output)
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
```

### Type Scale
| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| Display | 32px | 700 | 1.2 | -0.02em |
| H1 | 28px | 700 | 1.3 | -0.01em |
| H2 | 20px | 600 | 1.4 | 0 |
| H3 | 16px | 600 | 1.4 | 0 |
| Body | 14px | 400 | 1.6 | 0 |
| Small | 13px | 400 | 1.5 | 0 |
| Caption | 12px | 500 | 1.4 | 0.01em |
| Micro | 11px | 500 | 1.3 | 0.02em |

---

## Spacing System

Based on 4px increments for pixel-perfect alignment:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing, icon gaps |
| sm | 8px | Related element spacing |
| md | 12px | Component internal padding |
| lg | 16px | Section spacing |
| xl | 20px | Panel padding |
| 2xl | 24px | Major section gaps |
| 3xl | 32px | Page-level spacing |
| 4xl | 48px | Hero spacing |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 4px | Badges, small elements |
| md | 6px | Buttons, inputs |
| lg | 8px | Cards, panels |
| xl | 12px | Modals, large containers |
| 2xl | 16px | Feature cards |
| full | 9999px | Pills, avatars |

---

## Shadows & Elevation

### Glow Effects (Signature Style)
The primary design signature is subtle cyan glow effects on interactive elements:

```css
/* Primary button glow */
box-shadow: 0 0 20px rgba(6, 182, 212, 0.3), 0 0 40px rgba(6, 182, 212, 0.1);

/* Subtle card glow on hover */
box-shadow: 0 0 30px rgba(6, 182, 212, 0.08);

/* Active/focus glow */
box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.2);
```

### Elevation Shadows
```css
/* Level 1 - Cards */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);

/* Level 2 - Dropdowns, popovers */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);

/* Level 3 - Modals */
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
```

---

## Animation & Motion

### Timing Functions
```css
/* Standard easing for most transitions */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);

/* Snappy for small interactions */
--ease-snap: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Smooth for large movements */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
```

### Duration Scale
| Token | Duration | Usage |
|-------|----------|-------|
| instant | 100ms | Micro-interactions, hover states |
| fast | 150ms | Button states, toggles |
| normal | 200ms | Standard transitions |
| slow | 300ms | Panel reveals, modals |
| slower | 400ms | Complex animations |

### Key Animations
- **Pulse** - Running script indicator (subtle opacity pulse)
- **Glow Pulse** - Active elements get a breathing glow effect
- **Slide Up** - Modal entrance from bottom
- **Fade** - Overlay backgrounds

---

## Components

### Buttons

#### Primary Button
- Background: `#06B6D4` (Cyan 500)
- Text: `#000000` (Black for contrast)
- Border Radius: 6px
- Padding: 10px 18px
- Font: 14px / 500
- Hover: Background `#22D3EE`, subtle glow, slight lift (-1px translateY)
- Active: Background `#0891B2`

#### Secondary Button
- Background: `#18181B` (Gray 800)
- Text: `#F4F4F5` (Gray 100)
- Border: 1px solid `#27272A` (Gray 700)
- Hover: Background `#27272A`, border `#3F3F46`

#### Danger Button
- Background: `#EF4444`
- Text: White
- Hover: Lighter red, subtle red glow

#### Success Button
- Background: `#10B981`
- Text: White
- Hover: Lighter green

### Cards / Panels
- Background: `#0C0C0F` (Gray 900)
- Border: 1px solid `#27272A` (Gray 700)
- Border Radius: 8px
- Padding: 16px
- Hover: Border color `#3F3F46`, optional subtle cyan glow

### Inputs
- Background: `#18181B` (Gray 800)
- Border: 1px solid `#27272A` (Gray 700)
- Border Radius: 6px
- Padding: 12px
- Focus: Border `#06B6D4`, subtle cyan glow ring
- Placeholder: `#71717A` (Gray 500)

### Tabs
- Container: `#0C0C0F` with 6px padding, 12px radius (pill container)
- Inactive Tab: Transparent, `#A1A1AA` text
- Active Tab: `#06B6D4` background, `#000000` text, subtle glow
- Hover (inactive): `#18181B` background

### Modals
- Overlay: `rgba(0, 0, 0, 0.8)` with backdrop blur (8px)
- Content: `#0C0C0F` background
- Border: 1px solid `#27272A`
- Border Radius: 12px
- Shadow: Level 3 + subtle cyan accent glow

### Badges / Key Indicators
- Background: `#18181B`
- Border: 1px solid `#27272A`
- Border Radius: 4px
- Padding: 6px 10px
- Font: Monospace, 12px, 500

---

## Iconography

### Style
- Stroke-based icons (2px stroke width)
- Rounded line caps and joins
- 20x20px or 24x24px standard sizes
- Color inherits from text (currentColor)

### Icon Set Recommendation
Use Lucide Icons or Heroicons (outline variant) for consistency.

---

## Logo & Brand Mark

### Logo Treatment
- "Workflow Studio" as wordmark
- "Workflow" in regular weight
- "Studio" in bold weight
- Gradient text effect: `#06B6D4` to `#22D3EE` (135deg)
- Optional: Subtle text shadow/glow on dark backgrounds

### Favicon/App Icon
- Abstract flow/automation symbol
- Cyan on dark background
- Simple geometric shapes suggesting connected nodes/flow

---

## Layout Principles

### Container
- Max width: 900px
- Centered with auto margins
- Padding: 24px on all sides

### Grid
- Use CSS Grid or Flexbox
- 8px gap for related items
- 16-24px gap for sections

### Responsive Breakpoints
| Name | Width | Usage |
|------|-------|-------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Wide desktop |

---

## Accessibility

### Focus States
All interactive elements must have visible focus indicators:
```css
outline: none;
box-shadow: 0 0 0 2px #06B6D4;
```

### Color Contrast
- All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Cyan on black: 8.59:1 (passes AAA)
- Gray 300 on Gray 900: 7.42:1 (passes AAA)

### Motion
- Respect `prefers-reduced-motion` media query
- Provide reduced/no animation alternatives

---

## Dark Mode

This design system is dark-mode by default. The deep black backgrounds with cyan accents create a premium, gaming-oriented aesthetic that reduces eye strain during extended use.

No light mode variant is planned - the dark aesthetic is core to the brand identity.

---

## File Type Indicators

Script type badges use gradient backgrounds for visual distinction:

| Type | Gradient |
|------|----------|
| Python (.py) | `#3776AB` to `#FFD43B` |
| JavaScript (.js) | `#F7DF1E` to `#E8A900` (dark text) |
| Lua (.lua) | `#000080` to `#0000CD` |

---

## Status Indicators

### Script Status
- **Stopped**: Gray dot (`#71717A`)
- **Running**: Green dot (`#10B981`) with pulse animation

### Recording State
- Border: `#F59E0B` (Warning)
- Background: `rgba(245, 158, 11, 0.1)`
- Solid border style (dashed when idle)
