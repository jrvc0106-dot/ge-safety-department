# G&E ONE — Local PDF archive for installed iPads

## What this change does now

- The browser-hosted G&E ONE deployment is unchanged. Safari cannot silently create arbitrary folders in iPad **Files**.
- For an **installed iPadOS Capacitor app**, completed PDF reports are saved in **On My iPad → G&E ONE → G&E Reports → [Project] → [Category] → [YYYY-MM]**.
- Only small file shortcuts (no PDF bytes, report HTML or signature data) are indexed by G&E ONE locally for the signed-in account. The Report Center displays **My Local Reports** on native iPad only.
- Existing online report *records* remain in the database for inspections, history and workflows. When the native archive is available, the PDF-generation path does not upload a second PDF into the cloud `final-reports` bucket.
- If the native write fails (including low storage), the app keeps the PDF available for manual download/share and warns the user; the failed file is not indexed.
- Confidential medical follow-up PDFs are **not auto-archived** without a separate authorization and audit design.
- A local Files copy is **not** a backup. Removing the app, resetting the iPad or deleting/moving its documents may break shortcuts. Never store irreplaceable company records on only one iPad.

## Required one-time native packaging — NOT yet installed on an iPad

The repository is currently a Vite web app. Capacitor's iOS wrapper is required for automated writing to Files. A real device IPA needs macOS/Xcode and Apple signing (local Mac or trusted macOS build service); a Windows PC alone cannot produce/sign an iOS app. Do not promise the user that the web-only deployment supports this behavior.

After checking a compatible Node version and using an approved Apple developer team:

```bash
npm install @capacitor/core @capacitor/filesystem @capacitor/share
npm install -D @capacitor/cli
npm install @capacitor/ios
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Verify the bundle identifier in `capacitor.config.json` is unique to the G&E Apple developer team **before signing**; the checked-in value is a provisional example, not a verified Apple registration.

In `ios/App/App/Info.plist` add:

```xml
<key>UIFileSharingEnabled</key>
<true/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

Include the iOS Filesystem plugin's required `PrivacyInfo.xcprivacy` usage entry for **NSPrivacyAccessedAPICategoryFileTimestamp**, reason **C617.1**, following the matching installed Capacitor version and Apple's requirements.

With the installed native app, `window.Capacitor.getPlatform() === 'ios'` and `window.Capacitor.Plugins.Filesystem` must be present with `writeFile`, `mkdir`, `stat`, `getUri`. For opening a saved report from G&E ONE, `window.Capacitor.Plugins.Share.share` must also be present.

## QA checklist before rolling out to every iPad

1. On a **test iPad only**, sign in and create a non-sensitive sample report. On its final report screen, confirm **Files → On My iPad → G&E ONE → G&E Reports** includes one PDF and its layout/logo/signatures are unchanged.
2. Re-open and re-export the same report. It must still have **one** archived file. If content changes, the latest PDF replaces the previous local copy.
3. In **Report Center → My Local Reports**, open/share that exact PDF. Turn off internet and verify it remains accessible.
4. Test long JHA reports, numerous photos, quick orientation, equipment, observation, incident and disciplinary reports; compare iPad memory, time to save and app responsiveness.
5. Fill the iPad nearly full in a controlled test. A write failure must not claim success or prevent the original record from being accessed.
6. Repeat on iPads with different company user accounts and projects. The G&E ONE shortcuts are user-scoped, but anything visible in the iPad Files app can be opened by another person with physical/device access.
7. Confirm cloud-based report history continues to work through the structured records, and clarify how archived PDFs must be transferred or backed up if an iPad is replaced.

**Do not enable broad production rollout without actual iPad testing and a company backup policy.**
