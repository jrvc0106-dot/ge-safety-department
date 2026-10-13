# G&E ONE iPad Local-First Migration (draft; not for production)

**Scope:** preserve every existing module and PDF layout while replacing Vercel hosting and Supabase Auth, DB, Storage and Edge Functions. The published app remains unchanged.

## Verified current architecture
- Vite/JavaScript web frontend with pdf export, iPad UI, camera and scan workflows.
- Supabase Auth, PostgreSQL, Storage, SQL policies, and Edge Functions.
- Vercel API routes: help assistant and Toolbox save.
- Local browser IndexedDB for draft evidence; local browser drafts are **not** automatically transferable to another web origin or native app.
- Local backup UI currently rejects packages > 200 MB.
- Source repository visibility is public: do not commit employee information, passwords, API keys, database dumps, private certificates, or photos here.

## Native direction
- Capacitor 8 wrapper for existing UI (bundle identifier is provisional).
- Native encrypted SQLite as the authoritative local database **after implementation and device verification**.
- Native iOS filesystem for full-resolution photo and PDF bytes, with a hash-verified manifest; no permanent base64 files in SQLite.
- Per-device accounts/roles with an admin-signed authorization mechanism (NOT the current Supabase Auth).
- Admin revocations cannot be instantaneous on a disconnected iPad. Define bounded offline entitlement expiry and the renewal procedure before production.
- Offline record repository contract in `native/local-record-contract.mjs` and parameterized SQLite adapter in `native/sqlite-record-adapter.mjs`. Neither is connected to the live UI yet.
- Lossless evidence vault `native/local-evidence-vault.mjs` and injected Capacitor file bridge `native/capacitor-file-driver.mjs` added. Preserve exact HEIC/JPG/PDF bytes, verify SHA-256, reject cross-report paths, test retry integrity. Five isolated unit tests in `tests/local-evidence-vault.test.js` use mocked drivers; **not tested on physical iPad**. No UI integration or native plugin installation yet.
- Data export with encrypted backups and an operator-verified restore is a release blocker. Store copies outside the iPad; a lost/broken iPad must not mean irreversible evidence loss.

## Required feature equivalence (must all PASS on physical iPads)

| Functional area | Acceptance requirement |
| --- | --- |
| Login / roles / Team | Admin can enroll/remove users; roles and project permissions enforced offline |
| Projects / profiles | Create, change, and access only authorized projects |
| Safety Observations | Photo, corrective actions, status, notifications and PDF preserved |
| Daily Report JHA | 40 questions, autosave, photos, signatures, original PDF layout preserved |
| Incidents / Near Miss | Involved employee, witnesses, photos and report preserved |
| Disciplinary Actions | Available to authorized Safety accounts, signatures and PDF preserved |
| Equipment Inspections | Checklists, photos, hazard items and PDF preserved |
| Inventory | Items, quantities, images and reports preserved |
| Safety Orientation | Employee face, sticker, credentials, notices and scan preserved |
| Quick Safety Orientation | Single-page PDF, undistorted high-resolution images, automatic Safety name/role |
| Toolbox Talk / Safety Tools | Existing forms, photos, PDF, safe retry and local storage preserved |
| Notifications / invites | Offline queue where possible; any email delivery requires an external provider and connectivity |
| AI writing / Safety trends | External AI service or an on-device model needed; full equivalence cannot be claimed without tests |
| Reports / backup | PDFs match originals; encrypted backup and restore tested with complete evidence |
| iPad experience | Safari migration, camera, HEIC, signatures, downloads, sharing, orientation and app updates verified |

## Exit criteria BEFORE disconnecting Vercel or Supabase
1. Build native iOS app with Xcode on macOS, sign through an Apple-approved distribution method.
2. Migrate all required DB rows, authentication identities/roles and all Storage *bytes*, and reconcile hashes and counts.
3. Do not delete unrelated records while cleaning obsolete Daily Safety Walks.
4. Verify encryption, per-project isolation, admin revocation policy, key recovery and audit log in offline mode.
5. Pass existing automated tests and run acceptance checklist on at least two physical iPads, including internet-off and restart tests.
6. Verify independent backup restore to a different iPad (not just generating a ZIP).
7. Perform parallel pilot without changing main/prod. Obtain explicit release approval before cutover.
8. Only after independent verification, retire cloud integrations and old subscriptions.

## Development-only wrapper
On a Mac with Xcode 26+ and Node.js 22+, from the repository root:

```sh
bash scripts/prepare-ipad-native.sh --development-pilot
```

This script installs *pinned* Capacitor 8 packages locally and updates the local lockfile. The pilot is still cloud-dependent. Do not distribute it, do not place secrets into bundled front-end variables, and do not mistake an IPA for an offline application.

## Unresolved items
- Exact device iPadOS versions and Apple signing/distribution ownership.
- Migration/export of restricted Supabase Storage files.
- Replacement for shared live notifications, central team management, mail, AI, and remote analytics without a server.
- Secure native database and file encryption, native iPad file protection, SHA-256 integrity on physical devices, key management and recovery.
- Install and validate `@capacitor/filesystem` and native SQLite plugin in a controlled macOS/Xcode development build; the pure modules alone do not provide a ready-to-install IPA.
- Full audit against all Supabase calls in the UI, Edge Functions and Vercel endpoints.
