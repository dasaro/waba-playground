# Deployment Checklist

## Before Pushing Changes

### 1. Update MODULE_VERSION in all files

Search for current version and replace with new version:

```bash
# Example: Update from v20260101-1 to v20260101-2
find . -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i '' 's/?v=20260101-1/?v=20260101-2/g' {} +
```

**Files affected:**
- [ ] `app.js` (line 2 comment + 11 import statements)
- [ ] `modules/graph-manager.js` (2 imports)
- [ ] `modules/output-manager.js` (1 import)
- [ ] `modules/clingo-manager.js` (1 import - CRITICAL for WABA modules)
- [ ] `modules/theme-manager.js` (1 import)
- [ ] `index.html` (script tag on line ~540)

**Total: 17 version parameters**

### 2. Version Format

Use format: `YYYYMMDD-N`
- **YYYYMMDD**: Today's date (e.g., 20260102 for Jan 2, 2026)
- **N**: Revision number (increment for multiple deployments same day)

Examples:
- First deployment on Jan 1, 2026: `20260101-1`
- Second deployment same day: `20260101-2`
- First deployment on Jan 2, 2026: `20260102-1`

### 3. Verify All Changes

Before committing, double-check:
```bash
# Search for old version pattern (should return 0 results)
grep -r "?v=20260101-1" . --include="*.js" --include="*.html"

# Search for new version pattern (should return 17 results)
grep -r "?v=20260101-2" . --include="*.js" --include="*.html"
```

### 4. Commit & Push

```bash
git add .
git commit -m "Update module cache version to 20260101-2"
git push origin main
```

### 5. Wait for Deployment

GitHub Pages typically takes 1-2 minutes to rebuild and deploy.

### 6. Verify Deployment

Visit the version check page:
```
https://dasaro.github.io/waba-playground/version-check.html
```

Should show:
- ✓ Green checkmarks for all methods
- ✓ Version matches deployment version

### 7. Test Changes

1. Visit https://dasaro.github.io/waba-playground/
2. Hard refresh **ONCE** (Cmd+Shift+R / Ctrl+Shift+R)
3. Verify all changes work as expected
4. Check browser console for any errors

---

## User Cache Clearing (First Time Only)

After implementing version parameters for the FIRST time, users may need to hard refresh **ONCE**:
- **Windows/Linux:** Ctrl + Shift + R
- **Mac:** Cmd + Shift + R

After that initial hard refresh, future version updates will auto-reload modules without user intervention.

---

## Troubleshooting

### Changes not appearing after deployment?

1. **Check version parameters:**
   ```bash
   grep "?v=" app.js modules/*.js index.html
   ```
   All should show the same version number.

2. **Verify GitHub Pages deployment:**
   - Check https://github.com/dasaro/waba-playground/deployments
   - Latest deployment should be within last few minutes

3. **Clear browser cache manually:**
   - Open DevTools (F12)
   - Right-click reload button → "Empty Cache and Hard Reload"
   - Or go to Settings → Clear browsing data → Cached images and files

4. **Check for JavaScript errors:**
   - Open browser console (F12)
   - Look for red error messages
   - Module loading errors indicate syntax issues

### Version mismatch errors?

If you see errors like "Failed to load module", you may have inconsistent versions across files.

**Fix:**
```bash
# Find all version references
grep -rn "?v=" . --include="*.js" --include="*.html"

# Update all to consistent version
find . -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i '' 's/?v=[0-9-]*/?v=20260101-3/g' {} +
```

---

## Automated Version Update Script

Save this as `update-version.sh` for easier deployments:

```bash
#!/bin/bash

# Get current date in YYYYMMDD format
DATE=$(date +%Y%m%d)

# Get revision number (default to 1)
REV=${1:-1}

# New version
NEW_VERSION="${DATE}-${REV}"

echo "Updating version to: $NEW_VERSION"

# Update all files
find . -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i '' "s/?v=[0-9-]*/?v=${NEW_VERSION}/g" {} +

echo "✓ Updated all version parameters to ?v=${NEW_VERSION}"
echo ""
echo "Next steps:"
echo "1. git add ."
echo "2. git commit -m 'Update module cache version to ${NEW_VERSION}'"
echo "3. git push origin main"
```

**Usage:**
```bash
chmod +x update-version.sh
./update-version.sh 1  # First deployment today
./update-version.sh 2  # Second deployment today
```

---

## Notes

- Module caching is the **#1 cause** of "changes not appearing" issues
- Always increment version after making code changes
- Version parameters force browser to fetch fresh modules
- Without version parameters, browsers cache modules indefinitely
- This is a manual process until project adopts build tools with automatic versioning
