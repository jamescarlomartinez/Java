# Pickleball Rotation UX Contract

## State truth

`Live` means a Firestore snapshot has been confirmed by the server. Browser online status alone never means Live. During Connecting, Syncing, Reconnecting, Offline, or Error, the last valid room snapshot stays visible and shared mutations are paused. Solo games remain editable offline.

After a successful shared mutation, the interface stays Syncing until the room listener observes the committed revision. If it does not arrive within five seconds, the app performs one server read. Listener errors recover with bounded backoff, and browser online, visibility resume, `pageshow`, or Retry Now initiate recovery without periodic polling.

## Action contract

Every deliberate action receives a unique intent ID. Firestore transaction retries reuse the same ID; temporary in-flight keys only prevent repeated taps while an action is pending. Before offering a retry after uncertain completion, the app reads the authoritative room and checks the intent ID.

Recording a winner always records the result first. A prepared lineup is promoted unchanged; otherwise the engine attempts a fair next lineup. Preparation failure cannot roll back the winner. Up Next never starts automatically and never awards credits or starts a timer until Start Game is pressed.

Strict skill courts remain strict. Generation failures identify the affected court, eligible count, and unavailable-category breakdown, including partners unavailable, reserved, or skill-ineligible. Selection uses complete partner units; four individually available people do not guarantee a legal match. A legal four-player combination must produce a deterministic fallback if normal scoring cannot return one.

## Role contract

- Organizer: all controller operations plus Undo, resets, Clear All, and End Session.
- Controller: roster, court, rotation, results, replacements, sharing, and optional player participation.
- Player Check-In: only the linked player's check-in, availability, skill, alerts, partnership requests/cancellation/opt-out, and read-only live information.
- View Only: read-only room information.
- Solo: local organizer workflow without Activity.

## Navigation contract

Game is the default tab on every load. Tab choice is not written to local storage. Activity subscribes only while its tab is selected. All shared roles use the same tab names; unavailable operations are hidden, not merely explained after interaction.

## Modal contract

Only one app modal is open at a time. Opening stores the trigger, makes the application background inert, moves focus inside, traps Tab, supports Escape when closable, and restores focus on close. Destructive confirmations keep their action buttons disabled and expose an in-dialog error while the mutation is pending.

## Fixed session partners

Source: approved v3.13.0 Fixed Session Partners plan. Players request; controllers approve or directly set pairs. Each player may have one approved pair or pending request. Pair creation and ending require both players to be unassigned. Either involved player may cancel a request or end an unassigned pair. A pending request never changes rotation.

Approved partners are indivisible scheduling units across automatic, manual, replacement, and swap paths. Partnering takes priority over team balance; strict court eligibility remains mandatory. A break or checkout makes both wait without deleting the pair. Reset Courts/Stats preserve pairs; roster removal clears affected relationships; Clear Entire Game removes all relationships. Undo cannot cross a subsequent partnership change or undo a later opt-out.

Canonical UI map: the Players tab owns My Partner, roster partner badges, Set Partners, and pending requests. `openPartnerPicker` uses the existing `openModal` and picker-button list pattern, with local transient search and an explicit clear button. Search is deliberately not put in the URL because it is an uncommitted modal selection. The manual builder retains native selects with platform-owned popup geometry; selecting a paired player fills their teammate slot. `confirmAction`, `runAction`, and `showToast` own confirmation, pending/error feedback, shared writes, and acknowledgements. No new styling tokens or navigation shell are introduced.

Room state is schema 11. Older writers cannot downgrade an upgraded room; incompatible newer state is protected with an Update App notice. A completed check-in invalidates the pre-check-in bootstrap snapshot before the live listener starts, preserving the newly linked identity.

