#!/bin/bash
cd "$(dirname "$0")"
npm run version:bump
npx tauri build
