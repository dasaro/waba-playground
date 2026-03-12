#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'core', 'app-version.js');

function readVersion() {
    const content = fs.readFileSync(VERSION_FILE, 'utf8');
    const match = content.match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (!match) {
        throw new Error('Could not read APP_VERSION from core/app-version.js');
    }
    return match[1];
}

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'backup-cytoscape') {
            continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walk(fullPath));
        } else if (/\.(js|html)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

function rewriteContent(filePath, version) {
    const original = fs.readFileSync(filePath, 'utf8');
    let updated = original.replace(/\?v=\d{8}-\d+/g, `?v=${version}`);
    if (path.basename(filePath) === 'version-check.html') {
        updated = updated.replace(/<pre>v\d{8}-\d+.*?<\/pre>/, `<pre>v${version}</pre>`);
        updated = updated.replace(/const expectedVersion = '\d{8}-\d+';/, `const expectedVersion = '${version}';`);
    }
    if (path.basename(filePath) === 'app.js') {
        updated = updated.replace(/VERSION:\s*\d{8}-\d+/, `VERSION: ${version}`);
    }
    if (updated !== original) {
        fs.writeFileSync(filePath, updated, 'utf8');
        return true;
    }
    return false;
}

const version = readVersion();
const files = walk(ROOT);
let changed = 0;

files.forEach((filePath) => {
    if (rewriteContent(filePath, version)) {
        changed += 1;
    }
});

console.log(`Synchronized versioned asset references to ${version} in ${changed} file(s).`);
