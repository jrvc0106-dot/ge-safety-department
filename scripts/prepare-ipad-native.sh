#!/usr/bin/env bash
set -euo pipefail

# DEVELOPMENT-ONLY bootstrap. Does not migrate data or remove Supabase.
# A cloud-dependent wrapper is NOT the final offline G&E ONE app.
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Xcode and iOS builds require a Mac (macOS)."
  exit 2
fi
if [[ "${1:-}" != "--development-pilot" ]]; then
  echo "G&E ONE is still cloud-dependent. For a private DEVELOPMENT build only,"
  echo "run: bash scripts/prepare-ipad-native.sh --development-pilot"
  echo "Never distribute this pilot as the completed local version."
  exit 2
fi
command -v xcodebuild >/dev/null || { echo "Install Xcode from Apple first."; exit 2; }
command -v npm >/dev/null || { echo "Install Node.js 22+ first."; exit 2; }
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || {
  echo "Node.js 22+ is required."; exit 2;
}
npm install --save-exact @capacitor/core@8.5.3 @capacitor/ios@8.5.3
npm install --save-dev --save-exact @capacitor/cli@8.5.3
npm test
npm run build
if [[ -d ios ]]; then
  npx cap sync ios
else
  npx cap add ios
fi
echo "Development wrapper created. The app remains dependent on existing services."
echo "Review the complete permissions and security before signing or distributing."
npx cap open ios
