# WABA Playground - Debugging Guide

This guide explains how to debug each visualization feature using the enhanced console logging.

## Prerequisites

1. Open the WABA Playground in your browser
2. Open Developer Tools (F12 or Cmd+Option+I on Mac)
3. Go to the Console tab
4. Run a WABA example (e.g., "Medical Triage")

## Features to Test

### 1. Edge Dimming (Highlighting Extensions)

**What it does:** When you click an extension header, edges should be colored based on their status:
- **Red solid**: Successful attacks
- **Gray dashed**: Discarded attacks
- **Light gray semi-transparent**: Non-matched edges (dimmed)

**How to test:**
1. Run WABA and get some extensions
2. Click on an extension header (e.g., "Extension 1")
3. Look for console output:
   ```
   🔍 [highlightExtension] CALLED
   === HIGHLIGHTING EXTENSION ===
   In assumptions: [...]
   Discarded attacks: [...]
   Successful attacks: [...]
   ```

**Expected console output:**
- ✅ `[highlightExtension] CALLED` should appear
- ✅ Should show `Total edges in graph: X`
- ✅ Should show edge checking logs for each edge
- ✅ Should show `✓ MATCHED DISCARDED` or `✓ MATCHED SUCCESSFUL` for matching edges
- ✅ Should show `Highlighting: N discarded, M successful attacks`
- ✅ Should show `📊 [highlightExtension] Updating edges with new styles...`
- ✅ Should show `✅ [highlightExtension] Edge updates applied successfully`

**If it fails:**
- ❌ If you see `❌ [highlightExtension] Network not initialized!` → Network object is null
- ❌ If you see `⚠️ [highlightExtension] No edge updates to apply` → No edges matched the attacks
- ❌ If you see no console output at all → Click handler not attached or highlightExtension not called

### 2. Derived Atoms Popups

**What it does:** Clicking on a blue "derived atom" chip should show a tooltip with its derivation rule.

**How to test:**
1. Run WABA and get extensions with derived atoms (blue chips)
2. Click on a blue chip
3. Look for console output:
   ```
   🔗 [appendAnswerSet] Checking for derived atoms...
   📌 [appendAnswerSet] Attaching click handlers to X derived atoms
   ```

**Expected console output when setting up:**
- ✅ `🔗 [appendAnswerSet] Checking for derived atoms...`
- ✅ `Parsed derived atoms: [...]` (should show array of atoms)
- ✅ For each atom: `Looking for element with ID: derived-X-Y FOUND`
- ✅ For each atom: `✅ Click handler attached to derived-X-Y`

**Expected console output when clicking:**
- ✅ `✅ [Derived atom click] Atom clicked: X`
- ✅ `Calling PopupManager.showDerivationChain...`
- ✅ `📖 [showDerivationChain] CALLED`
- ✅ `Searching through rules: Map(...)`
- ✅ `✅ Found derivation rule: rX` (if rule exists)
- ✅ `✅ Tooltip appended to body`
- ✅ `📍 Tooltip positioned at: {...}`
- ✅ `✅ Click-outside handler attached`

**If it fails:**
- ❌ If you see `ℹ️ [appendAnswerSet] No derived atoms to attach handlers to` → No derived atoms detected
- ❌ If you see `❌ Could not find element with ID derived-X-Y` → HTML element not created or ID mismatch
- ❌ If clicking does nothing and no console output → Click handler not attached
- ❌ If you see `⚠️ No derivation rule found for atom: X` → Rule not in parsed data

### 3. Isolated Nodes Banner

**What it does:** Shows a banner at the top of the graph listing assumptions with no incoming/outgoing attacks.

**How to test:**
1. Load an example with isolated assumptions (e.g., create a framework with an assumption that has no attacks)
2. Look for console output after graph update:
   ```
   🏝️ [updateIsolatedAssumptionsOverlay] CALLED
   ```

**Expected console output:**
- ✅ `🏝️ [updateIsolatedAssumptionsOverlay] CALLED`
- ✅ `Banner element: found`
- ✅ `List element: found`
- ✅ `Isolated nodes count: X`
- ✅ `Isolated nodes: [...]`
- ✅ If nodes exist: `📋 [updateIsolatedAssumptionsOverlay] Setting labels: [...]`
- ✅ If nodes exist: `✅ [updateIsolatedAssumptionsOverlay] Banner shown with X items`
- ✅ If no nodes: `✅ [updateIsolatedAssumptionsOverlay] Banner hidden (no isolated nodes)`

**If it fails:**
- ❌ If you see `Banner element: NOT FOUND` → HTML element `#isolated-assumptions-banner` missing from DOM
- ❌ If you see `List element: NOT FOUND` → HTML element `#isolated-assumptions-list` missing from DOM
- ❌ If you see `❌ [updateIsolatedAssumptionsOverlay] Required elements not found in DOM` → Check index.html for these elements
- ❌ If banner doesn't appear but console says it should → Check CSS (might be styled to be invisible)

### 4. Fullscreen Callback

**What it does:** When entering/exiting fullscreen, the graph should resize and refit to the new viewport.

**How to test:**
1. Click the "⛶ Fullscreen" button
2. Look for console output:
   ```
   🖥️ [updateFullscreenButton] CALLED
   ```

**Expected console output:**
- ✅ `🖥️ [updateFullscreenButton] CALLED`
- ✅ `Fullscreen element: YES` (when entering) or `NO` (when exiting)
- ✅ `Button text set to: Exit Fullscreen` or `Fullscreen`
- ✅ `✅ [updateFullscreenButton] Callback exists, scheduling execution...`
- ✅ After 300ms: `📞 [updateFullscreenButton] Executing callback now...`
- ✅ `✅ [updateFullscreenButton] Canvas height recalculated: X`
- ✅ `✅ [updateFullscreenButton] Callback execution complete`

**If it fails:**
- ❌ If you see `⚠️ [updateFullscreenButton] No callback set! Graph will not be resized.` → Callback not registered in app.js initialization
- ❌ If callback executes but graph doesn't resize → Network redraw/fit might be failing (check network object)

### 5. Extension Persistence (Regenerating Graph)

**What it does:** When you change graph mode or semiring/semantics, the currently highlighted extension should remain highlighted.

**How to test:**
1. Run WABA and get extensions
2. Click an extension header to highlight it
3. Change the graph mode or semiring
4. Look for console output:
   ```
   🔄 [regenerateGraph] CALLED
   ```

**Expected console output:**
- ✅ `🔄 [regenerateGraph] CALLED`
- ✅ `📊 [regenerateGraph] Active extension ID: X` (should show the number)
- ✅ `⏱️ [regenerateGraph] Scheduling extension restoration in 500ms...`
- ✅ After 500ms: `🔍 [regenerateGraph] Looking for header with ID: X`
- ✅ `Header element: FOUND`
- ✅ `✅ [regenerateGraph] Restoring active extension: X`

**If it fails:**
- ❌ If you see `📊 [regenerateGraph] Active extension ID: null` → No extension was previously highlighted
- ❌ If you see `ℹ️ [regenerateGraph] No active extension to restore` → Same as above
- ❌ If you see `Header element: NOT FOUND` → Extension headers cleared before restoration attempt
- ❌ If you see `❌ [regenerateGraph] Could not restore extension - header not found: X` → Timing issue or headers not recreated
- ❌ Console will also show `Available headers in output: [...]` to help debug

## Common Issues

### Module Loading Errors
If you see errors like `Cannot import module` or `X is not defined`:
- Check browser console for any 404 errors on module files
- Verify all module files exist in `/modules/` directory
- Check that app.js has correct import paths

### PopupManager Not Found
If you see `PopupManager is not defined`:
- Check that `modules/popup-manager.js` exists
- Check that `output-manager.js` imports PopupManager correctly
- Check browser console for any import errors

### Network Object Null
If you see network-related errors:
- Check that `graphManager.initGraph()` was called successfully
- Check that `this.network = this.graphManager.network` assignment happened
- Look for any errors during graph initialization

## How to Report Issues

If a feature isn't working, include:

1. **Which feature** (edge dimming, derived atoms, etc.)
2. **All console output** related to that feature (copy/paste from console)
3. **Expected behavior** vs **actual behavior**
4. **Steps to reproduce** (which example, which buttons clicked)
5. **Browser and version** (Chrome 120, Firefox 121, etc.)

## Next Steps

After identifying the issue from console logs:
1. Check if the DOM elements exist (use browser inspector)
2. Check if click handlers are being attached (console should confirm)
3. Check if functions are being called (console should confirm)
4. Check if data is in the expected format (console shows the data)
5. Report findings so fixes can be targeted to the specific failure point
