#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Uploads dist/ to the osmviews-app Bunny Storage zone over its native
// Storage HTTP API (this zone is `type = "Standard"` in brawer/production's
// storage.tf, not S3, so an S3 client doesn't work here).
//
// Content-hashed files under assets/ are uploaded before index.html, so a
// browser never fetches an index.html that references a not-yet-uploaded
// asset -- see the caching rationale in brawer/production's cdn.tf
// (immutable long-TTL assets vs. short-TTL HTML). No cache purge: the
// deploy pipeline intentionally never holds the Bunny account API key
// (see RELEASING.md), so the pull zone's short default TTL is what makes a
// deploy show up.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ZONE = 'osmviews-app';
// DE (Falkenstein) is this zone's region in production/bunny/storage.tf;
// Bunny's DE-region Storage API has no region prefix. Update this if that
// zone's region ever changes.
const STORAGE_HOST = 'storage.bunnycdn.com';

const accessKey = process.env.BUNNY_OSMVIEWS_APP_ACCESS_KEY;
if (!accessKey) {
  console.error('BUNNY_OSMVIEWS_APP_ACCESS_KEY is not set');
  process.exit(1);
}

function walk(dir, root = dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full, root));
    } else {
      files.push(relative(root, full).split(sep).join('/'));
    }
  }
  return files;
}

async function upload(path) {
  const body = readFileSync(join('dist', path));
  const res = await fetch(`https://${STORAGE_HOST}/${ZONE}/${path}`, {
    method: 'PUT',
    headers: { AccessKey: accessKey, 'Content-Type': 'application/octet-stream' },
    body,
  });
  if (!res.ok) {
    throw new Error(`PUT ${path}: ${res.status} ${await res.text()}`);
  }
  console.log(`uploaded ${path} (${body.length} bytes)`);
}

const allFiles = walk('dist');
const assetFiles = allFiles.filter((f) => f.startsWith('assets/'));
const otherFiles = allFiles.filter((f) => !f.startsWith('assets/'));

for (const path of [...assetFiles, ...otherFiles]) {
  await upload(path);
}
