# Pickleball Game Rotation

A mobile-first PWA for fair social pickleball rotation. Personal games remain in the browser and work offline; an approved organizer can publish the current game as a live room that multiple phones control in real time.

## Live rooms

- The organizer signs in with an email present in the `allowedEmails` Firestore collection.
- **Share Current Game** copies the device's `pickleballRotation_v2`, v3, or v4 state into a new unguessable `?room=...` URL.
- Controller link holders join with Firebase Anonymous Authentication, enter a display name, and may use normal rotation controls. Player links let guests choose an existing roster name or add and check in their own name and skill level; viewer links need no name entry.
- Every organizer and controller chooses **Controller Only**, **Existing Player**, or **New Player**. Controller-player identities keep full controls, retain a separate activity-log name, and use one compact Player Tools menu for availability, skill, alerts, switching, and checkout.
- **QR & Links** provides three entry paths:
  - `?room=<id>` opens normal controller mode.
  - `?room=<id>&mode=player` lets a player choose an existing roster name or enroll themselves, check in, take a break, return, or check out.
  - `?room=<id>&mode=view` opens a simplified live read-only board.
- Social Fair remains the default rotation style. After game-count fairness, it prioritizes never-used teammates and opponents so the roster does not remain in fixed groups of four.
- **Skill Balanced** keeps game-count fairness first, prefers even Any-court compositions (2–2 mixed or four of one level), minimizes the team-skill gap, then applies the same matchup-mixing priorities. Odd 1–3 groups remain playable as the closest-balanced fallback.
- Every existing pre-v3.4 player is reset to an unconfirmed level. They may play on Any courts, but must choose one of the current levels before using a strict skill-designated court.
- Controllers can designate every court as **Any level**, **Beginner**, or **Non-Beginner**. Strict courts never mix levels and are filled before Any courts.
- Controllers can give courts recognizable custom names. Names appear consistently in live court cards, alerts, history, activity, summaries, and exports.
- Every court can hold one independent **Up Next** lineup beneath its active match. Prepared players are reserved immediately but receive no game credit, waiting update, or timer until **Start Game** is tapped.
- **Prepare Courts & Up Next** prepares idle courts first, then fills empty Up Next slots on active courts, with strict skill courts processed before Any courts in each pass.
- **Build Next Manually** provides four mobile-friendly player selectors for exact teams while still enforcing availability and the prepared game’s skill designation snapshot.
- Recording a winner promotes that court’s prepared lineup into the main court view. It still waits for a controller to tap **Start Game**, and the same player assignment does not trigger a second alert.
- Each started court has an elapsed timer. Completed timed games retain their duration in Game History and Session Summary; migrated in-progress games begin timing with their next game.
- **Summary & Export** shows completed-game totals, timing metrics, court usage, and standings. It downloads player and game records as a CSV entirely on the device.
- Checked-in players can explicitly enable free device alerts. The existing live Firestore room snapshot detects a new assignment, shows a system notification, displays an in-app banner, and vibrates when supported. No Cloud Functions, FCM token storage, or paid Firebase plan is required.
- Free turn alerts require the app to remain open or running in the background. They cannot arrive after the browser or installed app is fully closed; true closed-app push would require a server-side push service.
- Each shared role has a context-sensitive **How to Use** guide covering active and Up Next games, reservations, alerts, timers, summaries, large rooms, and role-specific controls. The revised guide is shown once after updating and remains available from the session card.
- **Live Activity** subscribes only while its panel is open. Large Room Mode activates automatically at 50 players, limits live activity to 20 recent events, paginates player/standings rendering, and caps decorative availability chips.
- Player and standings search remain local to the device and do not create Firestore reads.
- **Display Settings** stores high-contrast, larger-text, assignment-sound, and vibration preferences locally. **Court Display** presents only live court cards in a fullscreen-ready board.
- Controllers can publish a short announcement and collapsible Session Rules. They travel with the existing room state and do not require another backend service.
- Every shared action runs in a Firestore transaction and creates a top-level `roomEvents` record. Stable intent IDs prevent repeated critical actions from being applied twice.
- New undo records store compact inverse patches; legacy `beforeState` events remain supported. The `room-data.js` compatibility layer reads old room documents while marking new writes with a layout version for future partitioning.
- Organizer-only controls include clear-all, reset, undo, and end-session.
- Ended rooms are read-only. They retain a cleanup date for future manual maintenance, but automatic Firestore TTL deletion is not enabled because it requires billing.
- The footer shows the running app version. **Update App** clears old Pickleball caches, resets the service worker, and reloads the latest deployed release.

## v3.9.0 scale-ready behavior

The release keeps the current room document as the source of truth so existing rooms and links continue to work. New rooms add optional `dataLayoutVersion` and bounded `recentActionIds` fields. This is preparation for a future per-court/player storage layout, not a breaking migration.

## Local verification

```bash
npm install
npm test
npm run test:rules
```

The rules test requires Java 11+ because the Firebase Firestore emulator is Java-based.

## Firebase release setup

1. In Firebase Authentication, enable the **Anonymous** sign-in provider. Keep Google enabled for organizers.
2. Confirm each organizer has a document in `allowedEmails` with an `email` field. The client records that document ID as the organizer grant when creating a room.
3. No Cloud Functions, Cloud Messaging VAPID key, or Blaze plan is needed for turn alerts. Alerts are generated on the player's device from the room's existing live Firestore updates.
4. Deploy Firestore rules, indexes, and Firebase Hosting:

   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes,hosting --project pickleball-rotation
   ```

5. Wait for the `roomEvents(roomId ASC, createdAt DESC)` index to finish provisioning.
6. Publish the static files through GitHub Pages and validate a private live room on two browsers before merging the feature branch.

The Firebase project can remain on the Spark plan with billing disabled. Firestore and Hosting still have free usage limits; when a no-billing project exceeds a limit, service may be restricted rather than generating a paid bill.

The player and view-only query parameters simplify the interface for trusted link holders; they are not secret capability tokens because a recipient can edit the URL. QR generation uses the vendored MIT-licensed [`qrcode`](https://github.com/soldair/node-qrcode) browser build, with its license retained in `vendor/qrcode.LICENSE`.
