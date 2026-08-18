# Pickleball Game Rotation

A mobile-first PWA for fair social pickleball rotation. Personal games remain in the browser and work offline; an approved organizer can publish the current game as a live room that multiple phones control in real time.

## Live rooms

- The organizer signs in with an email present in the `allowedEmails` Firestore collection.
- **Share Current Game** copies the device's `pickleballRotation_v2`, v3, or v4 state into a new unguessable `?room=...` URL.
- Controller link holders join with Firebase Anonymous Authentication, enter a display name, and may use normal rotation controls. Player links let guests choose an existing roster name or add and check in their own name and skill level; viewer links need no name entry.
- **QR & Links** provides three entry paths:
  - `?room=<id>` opens normal controller mode.
  - `?room=<id>&mode=player` lets a player choose an existing roster name or enroll themselves, check in, take a break, return, or check out.
  - `?room=<id>&mode=view` opens a simplified live read-only board.
- Social Fair remains the default rotation style. **Skill Balanced** uses **Beginner** and **Intermediate & Above** to minimize the team-skill gap after game-count and waiting fairness.
- Every existing pre-v3.4 player is reset to an unconfirmed level. They may play on Any courts, but must choose one of the current levels before using a strict skill-designated court.
- Controllers can designate every court as **Any level**, **Beginner**, or **Intermediate & Above**. Strict courts never mix levels and are filled before Any courts.
- Checked-in players can explicitly enable free device alerts. The existing live Firestore room snapshot detects a new assignment, shows a system notification, displays an in-app banner, and vibrates when supported. No Cloud Functions, FCM token storage, or paid Firebase plan is required.
- Free turn alerts require the app to remain open or running in the background. They cannot arrive after the browser or installed app is fully closed; true closed-app push would require a server-side push service.
- Each shared role has a context-sensitive **How to Use** guide, shown automatically on its first visit and available afterward from the session card.
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
3. No Cloud Functions, Cloud Messaging VAPID key, or Blaze plan is needed for turn alerts. Alerts are generated on the player's device from the room's existing live Firestore updates.
4. Deploy Firestore rules, indexes, TTL field policies, and Firebase Hosting:

   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes,hosting --project pickleball-rotation
   ```

5. Wait for the `roomEvents(roomId ASC, createdAt DESC)` index and TTL policies for rooms, events, and memberships to finish provisioning.
6. Publish the static files through GitHub Pages and validate a private live room on two browsers before merging the feature branch.

The Firebase project can remain on the Spark plan with billing disabled. Firestore and Hosting still have free usage limits; when a no-billing project exceeds a limit, service may be restricted rather than generating a paid bill.

Firestore TTL deletion is asynchronous; an expired document can remain visible for a period before the service removes it.

The player and view-only query parameters simplify the interface for trusted link holders; they are not secret capability tokens because a recipient can edit the URL. QR generation uses the vendored MIT-licensed [`qrcode`](https://github.com/soldair/node-qrcode) browser build, with its license retained in `vendor/qrcode.LICENSE`.
