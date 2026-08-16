# Pickleball Game Rotation

A mobile-first PWA for fair social pickleball rotation. Personal games remain in the browser and work offline; an approved organizer can publish the current game as a live room that multiple phones control in real time.

## Live rooms

- The organizer signs in with an email present in the `allowedEmails` Firestore collection.
- **Share Current Game** copies the device's `pickleballRotation_v2` or v3 state into a new unguessable `?room=...` URL.
- Link holders join with Firebase Anonymous Authentication, enter a display name, and may use normal rotation controls.
- Every shared action runs in a Firestore transaction and creates a top-level `roomEvents` record.
- Organizer-only controls include clear-all, reset, undo, and end-session.
- Ended rooms are read-only and expire after 30 days. Firestore TTL is configured for rooms, events, and membership proofs.

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
