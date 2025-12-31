# WABA Playground Modules

This directory contains the modular ES6 architecture for WABA Playground, extracted from the original 5,417-line monolithic `app.js` (December 2024 refactoring).

## Architecture Overview

The playground is built using the **Manager Pattern**, where each manager class handles a specific domain of functionality. The main `app.js` (565 lines) orchestrates these managers and handles framework-specific logic.

**Code Reduction**: ~90% reduction from original monolith (5,417 → 565 lines)
**Duplication Removed**: ~680 lines (graph logic, parsing, popups)
**Module Count**: 10 specialized managers

## Module Descriptions

### 1. theme-manager.js (~80 lines)
**Purpose**: Theme switching and graph color updates

**Responsibilities**:
- Dark/light theme toggle
- Theme persistence (localStorage)
- Graph color updates for vis.js network
- Theme-aware color schemes

**Key Methods**:
- `initTheme()` - Initialize theme from localStorage
- `setTheme(theme)` - Apply theme (updates DOM and graph)
- `toggleTheme()` - Switch between dark/light
- `updateGraphTheme()` - Update vis.js graph colors

**Dependencies**: vis.js network reference (lazy getter)

---

### 2. font-manager.js (~45 lines)
**Purpose**: Font size controls (60%-200%)

**Responsibilities**:
- Font size increase/decrease
- Font size persistence (localStorage)
- CSS custom property updates

**Key Methods**:
- `initFontSize()` - Initialize from localStorage
- `setFontSize(percentage)` - Apply font size (60-200%)
- `increaseFontSize()` - Increase by 10%
- `decreaseFontSize()` - Decrease by 10%

**Dependencies**: None

---

### 3. ui-manager.js (~110 lines)
**Purpose**: UI interactions (modals, overlays, fullscreen, empty states)

**Responsibilities**:
- Syntax guide modal
- Loading overlay display
- Fullscreen toggle
- Empty state management (graph/output)
- Fullscreen button updates

**Key Methods**:
- `openSyntaxGuide()` / `closeSyntaxGuide()`
- `static showLoadingOverlay(text, subtext)` - Display loading screen
- `static hideLoadingOverlay()` - Hide loading screen
- `toggleFullscreen()` - Toggle fullscreen mode
- `static showGraphEmptyState()` / `hideGraphEmptyState()`
- `static showOutputEmptyState()` / `hideOutputEmptyState()`
- `static initializeEmptyStates()` - Setup empty states

**Dependencies**: DOM elements only

---

### 4. file-manager.js (~290 lines)
**Purpose**: File I/O and format conversion (.lp ↔ .waba)

**Responsibilities**:
- File upload handling (.lp and .waba formats)
- File download (save as .lp or .waba)
- Format conversion (Clingo ASP ↔ WABA format)
- WABA format parsing

**Key Methods**:
- `downloadAsLp(frameworkCode, onLog)` - Download as .lp file
- `downloadAsWaba(wabaContent, onLog)` - Download as .waba file
- `generateWabaFormat()` - Convert Simple Mode fields to WABA format
- `convertLpToWaba(clingoCode)` - Parse .lp to .waba format
- `async handleFileUpload(event, onGraphUpdate, parseSimpleABA, onLog)` - Handle file upload
- `parseWabaFile(content)` - Parse .waba file to structured data

**Dependencies**: `parseSimpleABA` from app.js (callback)

---

### 5. parser-utils.js (~130 lines) **[REMOVES DUPLICATION]**
**Purpose**: Shared regex-based parsing utilities

**Responsibilities**:
- Parse assumptions from .lp code
- Parse contraries from .lp code
- Parse rules (head/body) from .lp code
- Parse weights from .lp code

**Key Methods** (all static):
- `parseAssumptions(code)` - Extract `assumption(X).` predicates
- `parseContraries(code)` - Extract `contrary(X,Y).` predicates
- `parseRules(code)` - Extract `head(R,H)` and `body(R,B)` predicates
- `parseWeights(code)` - Extract `weight(X,W)` predicates

**Impact**: Consolidates 4 duplicate parsing methods from 3 graph update variants (~50 lines saved)

**Dependencies**: None

---

### 6. graph-utils.js (~240 lines) **[REMOVES DUPLICATION]**
**Purpose**: Shared graph styling and utilities

**Responsibilities**:
- Node color generation (theme-aware)
- Edge styling (weight-based)
- Weight parsing (#sup, #inf handling)
- Isolated node detection
- Layout options
- vis.js network configuration

**Key Methods** (all static):
- `createNodeColor(type, isIn, isSupported)` - Generate node colors based on type and state
- `createEdgeStyle(weight)` - Generate edge styling based on weight
- `parseWeight(weightStr)` - Parse "#sup" → Infinity, "#inf" → -Infinity, numbers
- `isDarkTheme()` - Check current theme
- `getFontColor()` / `getEdgeFontColor()` - Theme-aware font colors
- `filterIsolatedNodes(nodes, edges)` - Find isolated assumptions (no connections)
- `getLayoutOptions(quickMode)` - Physics/layout configuration for vis.js
- `getNetworkOptions()` - Default vis.js network options

**Impact**: Removes ~500 lines of duplication from 3 graph update variants

**Dependencies**: None (pure utilities)

---

### 7. graph-manager.js (~130 lines)
**Purpose**: Graph infrastructure and highlighting

**Responsibilities**:
- vis.js network initialization
- Graph layout control
- Extension highlighting
- Graph color reset
- Isolated assumptions overlay

**Key Methods**:
- `initGraph()` - Create vis.js network
- `runGraphLayout(quickMode)` - Trigger physics layout
- `resetGraphColors()` - Reset all nodes/edges to original colors
- `highlightExtension(inAssumptions, discardedAttacks, successfulAttacks)` - Highlight extension in graph
- `updateIsolatedAssumptionsOverlay()` - Show/hide isolated assumptions banner

**Note**: Full graph update methods (`updateGraphStandard`, `updateGraphAssumptionLevelDirect`, `updateGraphAssumptionLevelBranching`) remain in `app.js` as simplified stubs. Full implementations (~1500 lines) can be migrated from `app.js.backup` in future refactoring.

**Dependencies**: `graph-utils.js`, `parser-utils.js`, vis.js

---

### 8. popup-manager.js (~130 lines) **[REMOVES DUPLICATION]**
**Purpose**: Popup displays and tooltips

**Responsibilities**:
- Derivation chain popups (show how atoms are derived)
- Attack derivation tooltips (show attack details)
- Popup positioning (prevent off-screen)
- Popup cleanup

**Key Methods** (all static):
- `showDerivationChain(atom, parsed, element)` - Show derivation for atom (rules, weights)
- `createAttackDerivationTooltip(edge, frameworkCode)` - Generate attack tooltip HTML
- `positionPopup(popup, x, y)` - Position popup, keep on-screen
- `clearAllPopups()` - Remove all popups/tooltips

**Impact**: Consolidates ~100 lines of duplicate popup positioning logic

**Dependencies**: None

---

### 9. clingo-manager.js (~180 lines)
**Purpose**: Clingo WASM integration

**Responsibilities**:
- Clingo WASM initialization
- WABA program assembly (core + semiring + monoid + semantics + constraints)
- Clingo execution
- Module loading from `waba-modules.js`

**Key Methods**:
- `async initClingo()` - Wait for clingo global to load
- `async runWABA(framework, config, onLog)` - Execute WABA framework with config
- `buildProgram(framework, config)` - Assemble complete WABA program
- `getCoreModule()` - Load core/base.lp
- `getSemiringModule(semiring)` - Load semiring module
- `getMonoidModule(monoid, direction)` - Load monoid module (minimization/maximization)
- `getSemanticsModule(semantics)` - Load semantics module
- `getConstraintModule(monoid, bound)` - Load constraint module (ub_/lb_)
- `getFilterModule(filterType)` - Load filter module (standard/projection)

**Module Sources**: All .lp files loaded from auto-generated `waba-modules.js` (not hardcoded)

**Impact**: 73% smaller than original (no hardcoded .lp strings)

**Dependencies**: `waba-modules.js`, Clingo WASM

---

### 10. output-manager.js (~480 lines)
**Purpose**: Result display, parsing, and logging

**Responsibilities**:
- Display Clingo results (answer sets, costs, timing)
- Parse answer sets (in/out, attacks, weights)
- Compute extension cost (from discarded attacks)
- Find supporting assumptions (recursive derivation)
- Logging (info/warning/error/success)
- Output clearing

**Key Methods**:
- `displayResults(result, elapsed, onHighlightExtension, onResetGraph)` - Display full results
- `appendAnswerSet(witness, answerNumber, onHighlightExtension, onResetGraph)` - Append single answer set
- `parseAnswerSet(predicates)` - Parse `in()`, `out()`, `discarded_attack()`, etc.
- `findSupportingAssumptions(element, parsed)` - Recursive derivation chain
- `extractCost(witness)` - Extract cost from witness.Optimization
- `computeCostFromDiscarded(discardedAttacks)` - Fallback cost computation
- `log(message, type)` - Styled console logging
- `clearOutput()` - Clear output panel

**Dependencies**: `popup-manager.js` (for derivation chain popups)

---

## Main App (app.js)

**Size**: 565 lines (was 5,417 lines, 90% reduction)

**Responsibilities**:
- Manager orchestration
- Event listener attachment
- Framework-specific logic:
  - `parseSimpleABA()` - Parse Simple Mode to Clingo ASP
  - `populateSimpleModeFromClingo()` - Reverse parse Clingo ASP to Simple Mode
  - `initSimpleMode()` - Initialize Simple Mode UI
- Graph update orchestration (simplified stubs)
- Example loading
- WABA execution workflow

**Key Patterns**:
- **Lazy Getters**: Network references passed as getters to handle async initialization
- **Callback Pattern**: Cross-module communication (e.g., `onHighlightExtension`, `onResetGraph`)
- **Delegation**: All domain-specific logic delegated to managers

---

## WABA Module Sync Process

### Overview

WABA Playground embeds all WABA .lp files (ASP logic programs) as JavaScript strings for browser execution. The sync process keeps these embeddings up-to-date with the main WABA codebase.

### File Structure

```
waba-playground/
├── waba-modules.js          # AUTO-GENERATED - all 49 WABA modules embedded
├── scripts/
│   └── sync-modules.js      # Build script - generates waba-modules.js
└── modules/
    └── clingo-manager.js    # Imports and uses waba-modules.js
```

### How It Works

1. **Source**: WABA .lp files in `../WABA/` directory (parent repository)
2. **Build Script**: `scripts/sync-modules.js` reads all .lp files and generates `waba-modules.js`
3. **Generated File**: `waba-modules.js` exports `wabaModules` object with all modules as strings
4. **Usage**: `clingo-manager.js` imports `wabaModules` and assembles programs at runtime

### WABA Module Categories

**Total**: 49 modules across 6 categories

| Category | Count | Location | Examples |
|----------|-------|----------|----------|
| **Core** | 1 | `core/base.lp` | Base argumentation logic |
| **Semirings** | 5 | `semiring/*.lp` | godel, tropical, arctic, lukasiewicz, bottleneck_cost |
| **Monoids** | 10 | `monoid/*.lp` | max_minimization, sum_minimization, min_minimization, count_minimization, lex_minimization (+ maximization variants) |
| **Semantics** | 21 | `semantics/**/*.lp` | stable, cf, admissible, complete, grounded, ideal, naive, preferred, semi-stable, staged (+ heuristic/* and optN/* variants) |
| **Constraints** | 10 | `constraint/*.lp` | ub_max, ub_sum, lb_max, lb_min, ub_count, lb_count (+ ub_min, lb_sum) |
| **Filters** | 2 | `filter/*.lp` | standard, projection |

### Running the Sync

```bash
# From waba-playground/ directory
npm run sync
```

**What happens**:
1. Reads all .lp files from `../WABA/`
2. Converts each file to a JavaScript string
3. Writes `waba-modules.js` with all modules embedded
4. Console output shows files processed

**When to run**:
- After pulling WABA updates
- After modifying WABA .lp files
- Before testing new semantics/monoids/semirings

### waba-modules.js Structure

```javascript
// AUTO-GENERATED by scripts/sync-modules.js
// DO NOT EDIT MANUALLY

export const wabaModules = {
  core: {
    base: `% WABA Core Base Logic\n...`
  },
  semiring: {
    godel: `% Gödel Semiring\n...`,
    tropical: `% Tropical Semiring\n...`,
    // ... 3 more
  },
  monoid: {
    max_minimization: `% Max Monoid (Minimize)\n...`,
    max_maximization: `% Max Monoid (Maximize)\n...`,
    // ... 8 more
  },
  semantics: {
    stable: `% Stable Semantics\n...`,
    cf: `% Conflict-Free Semantics\n...`,
    admissible: `% Admissible Semantics\n...`,
    // ... 18 more (including heuristic/*, optN/*)
  },
  constraint: {
    ub_max: `% Upper Bound: Max Monoid\n...`,
    lb_max: `% Lower Bound: Max Monoid\n...`,
    // ... 8 more
  },
  filter: {
    standard: `% Standard Output Filtering\n...`,
    projection: `% Projection Mode Filtering\n...`
  }
};
```

### Usage in clingo-manager.js

```javascript
import { wabaModules } from '../waba-modules.js';

class ClingoManager {
  buildProgram(framework, config) {
    const program = [
      wabaModules.core.base,
      wabaModules.semiring[config.semiring],
      wabaModules.monoid[`${config.monoid}_${config.direction}`],
      wabaModules.filter[config.filterType],
      wabaModules.semantics[config.semantics],
      framework
    ];

    if (config.constraint !== 'none') {
      program.push(wabaModules.constraint[`${config.constraint}_${config.monoid}`]);
    }

    return program.join('\n\n');
  }
}
```

### Sync Process Details

**File Mappings** (examples):

```javascript
// scripts/sync-modules.js

const monoidFiles = {
  max_minimization: '../WABA/monoid/max_minimization.lp',
  max_maximization: '../WABA/monoid/max_maximization.lp',
  sum_minimization: '../WABA/monoid/sum_minimization.lp',
  // ... 7 more
};

const semanticsFiles = {
  stable: '../WABA/semantics/stable.lp',
  cf: '../WABA/semantics/cf.lp',
  admissible: '../WABA/semantics/admissible.lp',
  // ... core semantics
  'heuristic-naive': '../WABA/semantics/heuristic/naive.lp',
  'heuristic-preferred': '../WABA/semantics/heuristic/preferred.lp',
  // ... heuristic variants
  'optN-preferred': '../WABA/semantics/optN/preferred.lp',
  'optN-semi-stable': '../WABA/semantics/optN/semi-stable.lp',
  // ... optN variants
};
```

**Error Handling**:
- Missing files: Script reports which files are missing and exits
- Malformed paths: Script validates paths before reading
- Write errors: Script reports write failures

---

## Cross-Module Communication

Modules communicate via **callbacks** to avoid circular dependencies.

### Pattern: Callbacks from Output Manager

```javascript
// In app.js:
this.outputManager.displayResults(
  result,
  elapsed,
  (inAssumptions, discardedAttacks, successfulAttacks) => {
    // Highlight extension in graph
    this.graphManager.highlightExtension(inAssumptions, discardedAttacks, successfulAttacks);
  },
  () => {
    // Reset graph colors
    this.graphManager.resetGraphColors();
  }
);
```

### Pattern: Lazy Getters for Network

```javascript
// In app.js initializeManagers():
this.themeManager = new ThemeManager(
  this.themeToggleBtn,
  this.themeIcon,
  () => this.network,        // Lazy getter
  () => this.networkData     // Lazy getter
);

// ThemeManager can access network after async init:
updateGraphTheme() {
  const network = this.getNetwork();
  if (network) {
    // Update colors...
  }
}
```

---

## Development Workflow

### Initial Setup

```bash
cd waba-playground
npm install          # Install dependencies (http-server)
npm run sync         # Generate waba-modules.js
npm run dev          # Start dev server on :8080
```

### After WABA Updates

```bash
cd ../WABA
git pull             # Update WABA codebase

cd ../waba-playground
npm run sync         # Regenerate waba-modules.js
# Test changes in browser
git add waba-modules.js
git commit -m "Sync WABA modules: <description>"
git push origin main # Deploy to GitHub Pages
```

### Adding a New Module

1. **Extract module** (e.g., `modules/new-manager.js`):
   ```javascript
   export class NewManager {
     constructor(...) { ... }
     someMethod() { ... }
   }
   ```

2. **Import in app.js**:
   ```javascript
   import { NewManager } from './modules/new-manager.js';

   class WABAPlayground {
     initializeManagers() {
       this.newManager = new NewManager(...);
     }
   }
   ```

3. **Update this README** (add module description)

4. **Test and commit**:
   ```bash
   git add modules/new-manager.js app.js modules/README.md
   git commit -m "Add NewManager module for <purpose>"
   git push origin main
   ```

---

## Testing

After making changes, test:

1. **ES6 Module Loading**: Check DevTools Network tab for module requests
2. **Theme Toggle**: Switch dark/light theme, verify graph updates
3. **Font Controls**: Increase/decrease font size
4. **File I/O**: Upload .lp/.waba files, download .lp/.waba files
5. **Clingo Execution**: Run WABA with different configs (semiring, monoid, semantics)
6. **Graph Modes**: Test all 3 graph modes (standard, assumption-level direct, assumption-level branching)
7. **Output Display**: Verify answer sets display correctly, costs shown
8. **Semantics**: Test newly unlocked semantics (admissible, complete, grounded, etc.)
9. **WABA Sync**: Run `npm run sync`, verify waba-modules.js updates

---

## Future Improvements

1. **Migrate Full Graph Updates**: Move full implementations of `updateGraphStandard()`, `updateGraphAssumptionLevelDirect()`, `updateGraphAssumptionLevelBranching()` from `app.js.backup` to `graph-manager.js` (~1500 lines)

2. **TypeScript**: Add type definitions for better IDE support and type safety

3. **Testing**: Add unit tests for parser-utils.js, graph-utils.js, popup-manager.js

4. **Performance**: Profile graph rendering for large frameworks (100+ nodes)

5. **Documentation**: Add JSDoc comments to all modules

6. **Caching**: Cache parsed frameworks to avoid re-parsing on config changes

---

## Module Dependency Graph

```
app.js (main)
├── theme-manager.js
│   └── (uses network via lazy getter)
├── font-manager.js
│   └── (standalone)
├── ui-manager.js
│   └── (standalone)
├── file-manager.js
│   └── (uses parseSimpleABA from app.js via callback)
├── parser-utils.js
│   └── (standalone utilities)
├── graph-utils.js
│   └── (standalone utilities)
├── graph-manager.js
│   ├── graph-utils.js
│   └── parser-utils.js
├── popup-manager.js
│   └── (standalone utilities)
├── clingo-manager.js
│   └── waba-modules.js (generated)
├── output-manager.js
│   └── popup-manager.js
└── examples.js
    └── (standalone data)
```

**No circular dependencies**: All modules are independent or depend on lower-level utilities. Cross-module communication uses callbacks.

---

## File Size Comparison

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| **app.js** | 5,417 lines | 565 lines | **-4,852 lines (90%)** |
| Duplicate graph logic | 850 lines | 350 lines | -500 lines |
| Duplicate parsing | 100 lines | 50 lines | -50 lines |
| Duplicate popups | 460 lines | 330 lines | -130 lines |
| **Total saved** | - | - | **~680 lines duplication removed** |

**New Modules Created**: 10 (1,795 lines total, focused and maintainable)

---

## Questions?

For questions about:
- **Module architecture**: See this README
- **WABA sync**: See "WABA Module Sync Process" section above
- **Development workflow**: See "Development Workflow" section above
- **WABA semantics/monoids**: See `../WABA/README.md` and `../WABA/CLAUDE.md`

---

**Last Updated**: 2024-12-31
