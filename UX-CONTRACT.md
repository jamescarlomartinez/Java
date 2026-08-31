# Pickleball Rotation UX Contract

## State truth

`Live` means a Firestore snapshot has been confirmed by the server. Browser online status alone never means Live. During Connecting, Syncing, Reconnecting, Offline, or Error, the last valid room snapshot stays visible and shared mutations are paused. Solo games remain editable offline.

After a successful shared mutation, the interface stays Syncing until the room listener observes the committed revision. If it does not arrive within five seconds, the app performs one server read. Listener errors recover with bounded backoff, and browser online, visibility resume, `pageshow`, or Retry Now initiate recovery without periodic polling.

## Action contract

Every deliberate action receives a unique intent ID. Firestore transaction retries reuse the same ID; temporary in-flight keys only prevent repeated taps while an action is pending. Before offering a retry after uncertain completion, the app reads the authoritative room and checks the intent ID.

Recording a winner always records the result first. A prepared lineup is promoted unchanged; otherwise the engine attempts a fair next lineup. Preparation failure cannot roll back the winner. Up Next never starts automatically and never awards credits or starts a timer until Start Game is pressed.

Strict skill courts remain strict. Generation failures identify the affected court, eligible count, and unavailable-category breakdown. Four eligible players must produce a deterministic fallback lineup if normal scoring cannot return one.

## Role contract

- Organizer: all controller operations plus Undo, resets, Clear All, and End Session.
- Controller: roster, court, rotation, results, replacements, sharing, and optional player participation.
- Player Check-In: only the linked player's check-in, availability, skill, alerts, and read-only live information.
- View Only: read-only room information.
- Solo: local organizer workflow without Activity.

## Navigation contract

Game is the default tab on every load. Tab choice is not written to local storage. Activity subscribes only while its tab is selected. All shared roles use the same tab names; unavailable operations are hidden, not merely explained after interaction.

## Modal contract

Only one app modal is open at a time. Opening stores the trigger, makes the application background inert, moves focus inside, traps Tab, supports Escape when closable, and restores focus on close. Destructive confirmations keep their action buttons disabled and expose an in-dialog error while the mutation is pending.

