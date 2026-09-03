# Pickleball Rotation Design System

## Product character

The interface is a night-court scoreboard: dark evergreen surfaces, bright court-line greens, orange match accents, and compact, high-confidence controls. It should feel active and athletic without looking like a generic admin dashboard.

## Canonical tokens

Runtime CSS custom properties in `index.html` are the source of truth. The primary palette is `--bg`, `--card`, `--primary`, `--primary-light`, `--accent`, `--danger`, `--text`, `--text-muted`, and `--border`. Focus, scrollbar, and overlay tokens are `--focus-ring`, `--scroll-track`, `--scroll-thumb`, and the `--z-*` layer tokens.

Spacing uses an approximately 4/8/12/16/24 rhythm. Primary touch targets are at least 44px. Cards use the existing 11–18px radius range; court cards retain their stronger team and status borders.

## Navigation

The canonical application structure is Game, Players, Results, Activity, and Session. Phones use a fixed bottom tab bar with safe-area padding. Wider layouts use a sticky tab rail. The app opens on Game after navigation or refresh and keeps tab selection only for the current page lifetime.

Activity is hidden in solo mode. Shared roles keep the same tab vocabulary while permission-specific operations are hidden. Global announcements, connectivity recovery, and turn alerts remain outside the tab panels.

Navigation uses the approved raised-button style: distinct dark-green surfaces, visible green borders, bright labels, and a subtle three-pixel lower edge. Selected tabs are mint with dark text. Icons sit immediately beside labels on desktop and above labels on phones. Pressing lowers the face two pixels without changing layout; keyboard focus remains a separate outline. Reduced-motion and forced-color preferences remain supported.

The shared `.app-tab` recipe in `index.html` owns every role's navigation appearance. Its canonical runtime tokens are `--tab-surface` (alias of `--card2`), `--tab-edge` (alias of `--bg`), `--tab-selected-edge` (alias of `--primary-dark`), and `--tab-radius` (10px). Theme overrides flow through these aliases; other controls retain their existing styles.

## Component ownership

- The compact session card owns room name, access role, linked player identity, and sync status.
- Game owns court counts, availability, preparation, live courts, and Up Next.
- Players owns roster management, player search, skill, availability, and player tools.
- Results owns standings, standings search, summary/export, and history.
- Activity owns the room-event subscription and all loading/error/empty states.
- Session owns court configuration, sharing, help, display controls, rules, lifecycle actions, undo, and resets.
- `#appModal` is the only general-purpose overlay. It owns focus trapping, Escape, background inertness, action pending state, and focus restoration.

## Responsive behavior

Layouts must work without horizontal page scrolling at 320px, 375px, 428px, landscape phone widths, and 200% browser zoom. Dense content may scroll inside its table or modal region. Sticky navigation and recovery banners must not cover focused content.

## Accessibility

Tabs follow the WAI-ARIA tabs pattern. Keyboard users can use Arrow keys, Home, and End. Destructive actions use the app confirmation dialog with explicit verbs. Status changes are announced through existing live regions. Color is reinforced with labels, icons, and borders.

