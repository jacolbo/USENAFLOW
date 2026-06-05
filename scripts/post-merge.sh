#!/bin/bash
set -e
npm install
npm run db:push
# Hide legacy auto-created calendar "inspo placeholder" projects (idempotent).
npx tsx scripts/backfill-inspo-placeholders.ts
# Collapse duplicate project rows for the same shoot, preserving inspos (idempotent).
npx tsx scripts/merge-duplicate-shoots.ts
