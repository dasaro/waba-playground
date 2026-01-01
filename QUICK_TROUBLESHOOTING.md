# Quick Troubleshooting Checklist

Run through this checklist to quickly identify where the problem is.

## ✅ Pre-Flight Checks

### 1. Clear Browser Cache
```
Chrome/Edge: Ctrl+Shift+R (Cmd+Shift+R on Mac)
Firefox: Ctrl+F5 (Cmd+Shift+R on Mac)
Safari: Cmd+Option+R
```

### 2. Open Developer Console
```
All browsers: F12 (or Cmd+Option+I on Mac)
Then click "Console" tab
```

### 3. Check for RED Errors
Look in console for any red error messages. Common ones:

❌ `Failed to load module` → Module files not loading (deployment issue)
❌ `Uncaught SyntaxError` → JavaScript syntax error (code issue)
❌ `Uncaught ReferenceError: X is not defined` → Missing variable/function
❌ `Cannot read property of undefined` → Trying to use null/undefined object

**If you see ANY red errors**: Copy the FULL error message (including line numbers) and report it.

## ✅ Module Loading Test

### Open: `/module-test.html`

You should see:
```
✓ ThemeManager loaded successfully
✓ FontManager loaded successfully
✓ UIManager loaded successfully
✓ FileManager loaded successfully
✓ ParserUtils loaded successfully
✓ GraphUtils loaded successfully
✓ GraphManager loaded successfully
✓ PopupManager loaded successfully
✓ ClingoManager loaded successfully
✓ OutputManager loaded successfully
✓ PopupManager.showDerivationChain exists and is a function
Test Summary: 10 passed, 0 failed
```

**Result**:
- ✅ All green checkmarks → Modules working, issue is in logic
- ❌ Any red X marks → Module loading broken, check browser console for errors

## ✅ Feature Tests

For EACH feature, check if console logs appear:

### 1. Edge Dimming
**Action**: Run WABA → Click extension header
**Look for**: `🔍 [highlightExtension] CALLED`
- ✅ Appears → Feature executes, check if edges actually update
- ❌ Doesn't appear → Click handler not attached

### 2. Derived Atoms
**Action**: Run WABA → Click blue chip (derived atom)
**Look for**: `📖 [showDerivationChain] CALLED`
- ✅ Appears → Popup code executes, check if tooltip visible
- ❌ Doesn't appear → Click handler not attached or no derived atoms

### 3. Isolated Banner
**Action**: Load any example
**Look for**: `🏝️ [updateIsolatedAssumptionsOverlay] CALLED`
- ✅ Appears → Check if `Banner element: found` (should see banner if nodes exist)
- ❌ Doesn't appear → Function not being called after graph update

### 4. Fullscreen
**Action**: Click "⛶ Fullscreen" button
**Look for**: `🖥️ [updateFullscreenButton] CALLED`
- ✅ Appears → Check if callback executes after 300ms
- ❌ Doesn't appear → Event listener not attached

### 5. Extension Persistence
**Action**: Click extension → Change graph mode
**Look for**: `🔄 [regenerateGraph] CALLED`
- ✅ Appears → Check if `Active extension ID: X` (should show number)
- ❌ Doesn't appear → Graph mode change not triggering regeneration

## ✅ Quick Diagnostic Script

Paste this in browser console (on main app page):

```javascript
// Basic checks
console.log('=== BASIC CHECKS ===');
console.log('Playground exists:', typeof window.playground);
console.log('Graph manager exists:', typeof window.playground?.graphManager);
console.log('Network exists:', typeof window.playground?.network);
console.log('Output manager exists:', typeof window.playground?.outputManager);

// Module check
console.log('\n=== MODULE CHECK ===');
import('./modules/popup-manager.js')
  .then(m => {
    console.log('PopupManager loaded:', !!m.PopupManager);
    console.log('showDerivationChain exists:', typeof m.PopupManager.showDerivationChain === 'function');
  })
  .catch(e => console.error('Failed to load PopupManager:', e));

// DOM check
console.log('\n=== DOM CHECK ===');
console.log('Banner element:', !!document.getElementById('isolated-assumptions-banner'));
console.log('Banner list element:', !!document.getElementById('isolated-assumptions-list'));
console.log('Graph canvas:', !!document.getElementById('cy'));
console.log('Output div:', !!document.getElementById('output'));

// Check for derived atoms in current output
console.log('\n=== CURRENT STATE ===');
const derivedChips = document.querySelectorAll('[id^="derived-"]');
console.log('Derived atom chips in DOM:', derivedChips.length);
if (derivedChips.length > 0) {
  console.log('First chip ID:', derivedChips[0].id);
  console.log('First chip has click listener:', derivedChips[0].onclick !== null);
}
```

**Expected output**:
```
=== BASIC CHECKS ===
Playground exists: object
Graph manager exists: object
Network exists: object
Output manager exists: object

=== MODULE CHECK ===
PopupManager loaded: true
showDerivationChain exists: true

=== DOM CHECK ===
Banner element: true
Banner list element: true
Graph canvas: true
Output div: true

=== CURRENT STATE ===
Derived atom chips in DOM: X (number, could be 0)
```

**If ANY of these are false/undefined**: That's your problem!

## 📊 Summary Decision Tree

```
Start Here
    ↓
Are there RED errors in console?
    ├─ YES → Copy error and report (deployment/syntax issue)
    └─ NO → Continue
         ↓
Does module-test.html show all green?
    ├─ NO → Module loading broken (check browser/CORS)
    └─ YES → Continue
         ↓
Do console emoji logs appear when testing features?
    ├─ NO → Event handlers not attached (timing issue)
    └─ YES → Continue
         ↓
Does diagnostic script show all true?
    ├─ NO → Missing DOM elements or objects
    └─ YES → Feature executes but logic/CSS issue
```

## 🎯 Common Fixes

### If nothing works at all
1. Hard refresh (Ctrl+Shift+R)
2. Try different browser
3. Check if GitHub Pages deployed (wait 5 minutes after push)
4. Check if HTTPS is working (not mixed content)

### If modules don't load
1. Check browser version (need Chrome 61+, Firefox 60+, Safari 11+)
2. Check network tab for 404 errors
3. Check if files exist in `/modules/` directory
4. Try opening module files directly (should download, not 404)

### If logs appear but features don't work
1. Check for ❌ error logs in the detailed output
2. Look for "NOT FOUND" messages
3. Check if CSS is hiding elements
4. Check if click handlers report "FOUND" for elements

## 📝 What to Report

Include ALL of these:

1. **Browser**: Chrome 120.0.6099.109 (exact version)
2. **URL**: https://dasaro.github.io/waba-playground/ (or localhost)
3. **Module test**: Pass/Fail (screenshot if fail)
4. **Console errors**: Full red error messages (copy/paste)
5. **Diagnostic script output**: Copy/paste all of it
6. **Feature test results**: Which emoji logs appear, which don't

Example good report:
```
Browser: Chrome 120.0.6099.109
URL: https://dasaro.github.io/waba-playground/
Module test: PASS (all green)
Console errors: None
Diagnostic script: All true except "showDerivationChain exists: false"
Feature tests:
  - Edge dimming: ✅ Logs appear, edges don't update
  - Derived atoms: ❌ No logs appear
  - Isolated banner: ✅ Logs appear, says "Banner element: NOT FOUND"
  - Fullscreen: ✅ Logs appear, callback executes
  - Extension persistence: ✅ Logs appear, restoration fails
```

This tells us exactly where to look!

## 🔧 Emergency Fallback

If absolutely nothing works and you need the old version:

```bash
git checkout <previous-commit-hash>
git push -f origin main
```

(But report the issue first so we can fix it properly!)
