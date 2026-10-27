#!/usr/bin/env bash
set -e
npm install
npm run build
npx cap add android
python3 scripts/patch-manifest.py
npx cap sync android
echo "Done. Now run: npm run android:open  (Android Studio) -> Run on your phone"
