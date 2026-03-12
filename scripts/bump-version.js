#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'core', 'app-version.js');

function readCurrentVersion() {
    const content = fs.readFileSync(VERSION_FILE, 'utf8');
    const match = content.match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (!match) {
        throw new Error('Could not read APP_VERSION from core/app-version.js');
    }
    return match[1];
}

function nextVersion() {
    const current = readCurrentVersion();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const [datePart, revisionPart] = current.split('-');
    if (datePart === today) {
        return `${today}-${Number.parseInt(revisionPart, 10) + 1}`;
    }
    return `${today}-1`;
}

const newVersion = process.argv[2] || nextVersion();
fs.writeFileSync(VERSION_FILE, `export const APP_VERSION = '${newVersion}';\n`, 'utf8');

const sync = spawnSync('node', [path.join(__dirname, 'sync-version-refs.js')], {
    cwd: ROOT,
    stdio: 'inherit'
});

if (sync.status !== 0) {
    process.exit(sync.status ?? 1);
}

console.log(`Bumped WABA Playground version to ${newVersion}.`);
