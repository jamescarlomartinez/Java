# Pickleball Game Rotation

A mobile-first PWA for fair social pickleball rotation. Personal games remain in the browser and work offline; an approved organizer can publish the current game as a live room that multiple phones control in real time.

## Live rooms

- The organizer signs in with an email present in the `allowedEmails` Firestore collection.
- **Share Current Game** copies the device's `pickleballRotation_v2`, v3, or v4 state into a new unguessable `?room=...` URL.
- Controller link holders join with Firebase Anonymous Authentication, enter a display name, and may use normal rotation controls. Player links let guests choose an existing roster name or add and check in their own name; viewer links need no name entry.
- **QR & Links** provides three entry paths:
  - `?room=<id>` opens normal controller mode.
  - `?room=<id>&mode=player` lets a player choose an existing roster name or enroll themselves, check in, take a break, return, or check out.
  - `?room=<id>&mode=view` opens a simplified live read-only board.
- Social Fair remains the default rotation style. **Skill Balanced** adds editable 1.0–5.0 player ratings and minimizes the team-rating gap after game-count and waiting fairness.
- Every shared action runs in a Firestore transaction and creates a top-level `roomEvents` record.
- Organizer-only controls include clear-all, reset, undo, and end-session.
- Ended rooms are read-only and expire after 30 days. Firestore TTL is configured for rooms, events, and membership proofs.
- The footer shows the running app version. **Update App** clears old Pickleball caches, resets the service worker, and reloads the latest deployed release.

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
3. Deploy the Firestore rules, composite index, and TTL field policies:

   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes --project pickleball-rotation
   ```

4. Wait for the `roomEvents(roomId ASC, createdAt DESC)` index to finish building.
5. Publish the static files through GitHub Pages and validate a private live room on two browsers before merging the feature branch.

Firestore TTL deletion is asynchronous; an expired document can remain visible for a period before the service removes it.

The player and view-only query parameters simplify the interface for trusted link holders; they are not secret capability tokens because a recipient can edit the URL. QR generation uses the vendored MIT-licensed [`qrcode`](https://github.com/soldair/node-qrcode) browser build, with its license retained in `vendor/qrcode.LICENSE`.
