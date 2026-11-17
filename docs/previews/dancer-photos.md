# Private dancer photos

The single native/hosted DancerEditor uses the same crop control. Optional `photo`
capability supplies `{ value: dataUrl | null }`; save sends a changed value only.
Undefined preserves the photo, null removes it. Never enable the capability in a
host that cannot persist it. Teacher/studio-only photos remain out of scope.

## Image policy

- JPG, PNG, WebP and HEIC/HEIF, up to 30 MiB and 50 megapixels.
- Native decoding first; unsupported HEIC lazily loads heic-to locally. No third-party conversion service.
- 4:5 portrait, maximum 800 × 1000; minimum effective crop 400 × 500. No upscaling.
- Zoom up to 5×, with a clear error if the crop loses too much resolution.
- Browser crops to JPEG; Connect independently validates/decodes and re-encodes
  using Sharp, JPEG quality 85 (75 for unusually large output), max 500 KB.
- 160 × 200 thumbnail. Original and EXIF/GPS metadata are never stored.
- Guidance only, not identity verification or passport compliance.

## Persistence

Backend: `scotdance-worktrees/connect-photo-api`, owner-authenticated native API
and exact Entries/Binder-owner service routes. Objects live only in the
standard Firebase Storage bucket `scotdance-connect.firebasestorage.app` in
project `scotdance-connect` (Firebase Console → Storage).
No public URLs or Firebase download tokens. Metadata contains a version reference,
not photo bytes. List/registration/submission snapshots never contain images.

The native account adapter and sibling app adapters must whitelist dancer fields;
photo data is a separate top-level write field. Load the portrait before opening
an existing editor, fail visibly on load errors, and never treat a failed read as
an empty photo. Native rows fetch only the thumbnail. Sign-out discards UI state.

## Local preview

Frontend: `npm --prefix web run dev:connect -- --port 5336`.
Backend: build `connect-photo-api`, then use Firebase emulators with
`firebase.test.json` and `node scripts/serve-photo-preview.cjs` (see backend docs).
Open `http://127.0.0.1:5336/photo-preview.html?storage=1`.
This uses fictional accounts and real local Auth/Firestore/Storage emulators.
The Embedded form switch exercises the actual postMessage editor. No production
API is proxied. The preview entry is excluded from production builds.

Without `?storage=1`, the older browser-only fixture remains available.
Tests cover HEIC conversion in Chrome, mobile crop, save/reload/replace/remove,
unchanged photo preservation through the embedded form, owner isolation, request
replay and stale-revision cleanup. Backend `npm run test:integration` covers actual
API handlers against emulators; frontend `photo.test.ts` covers crop bounds.

## Release

Deploy Connect backend first, including cleanupPhotos; then Connect Hosting,
then Entries/Binder adapters. Older hosts omit the capability safely. Keep the
local photo UI and all production adapters in the same release. Bucket creation
alone does not enable photos in production. See backend `docs/photos.md` for IAM
and retention details.
