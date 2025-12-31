# 🧮 WABA Playground

An interactive web-based environment for experimenting with **Weighted Assumption-Based Argumentation (WABA)** directly in your browser.

Try it live: [https://yourusername.github.io/waba-playground](https://yourusername.github.io/waba-playground)

## Features

- **🎮 Interactive Editor**: Write and edit WABA frameworks with syntax highlighting
- **⚙️ Configurable Algebraic Structures**:
  - 5 Semirings: Gödel, Tropical, Arctic, Łukasiewicz, Bottleneck-Cost
  - 5 Monoids (each with minimization/maximization): MAX, SUM, MIN, COUNT, LEX
  - 21 Semantics: Core (stable, cf, admissible, complete, grounded), Extension-based (ideal, naive, preferred, semi-stable, staged), Heuristic variants, OptN variants
- **📊 Interactive Graph Visualization** (powered by vis.js):
  - **Three visualization modes**:
    - **Standard**: Set-based view showing all possible assumption sets
    - **Assumption-Direct**: Assumption-level view with individual dashed edges for joint attacks
    - **Assumption-Branching**: Assumption-level view with junction nodes (⊗) showing attack convergence
  - Click nodes/edges for detailed attack information
  - Click extensions to highlight in/out assumptions and discarded attacks
  - Live physics simulation with customizable layout
  - Fullscreen mode and reset layout controls
- **📚 Preloaded Examples**: 7 topology-focused examples (linear, cycle, tree, complete, mixed, isolated)
- **⚡ Instant Execution**: Powered by clingo-wasm (WebAssembly)
- **📋 Sorted Results**: Extensions automatically sorted by cost (lowest to highest)
- **🎨 Dark/Light Themes**: Toggle between dark and light color schemes
- **🔍 Font Size Controls**: Adjust text size for better readability
- **📖 Built-in Documentation**: Quick reference for syntax and semantics

## Quick Start

### Online Usage

1. Visit the [WABA Playground](https://yourusername.github.io/waba-playground)
2. Select a semiring and monoid configuration
3. Choose a preloaded example or write your own framework
4. Click "Run WABA" to compute extensions
5. Explore the interactive graph visualization with different modes
6. Click extensions in the results to see them highlighted in the graph
7. Experiment with different algebraic choices to see how they affect reasoning!

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/waba-playground.git
cd waba-playground

# Install dependencies (http-server)
npm install

# Sync WABA modules from parent repository
npm run sync

# Start development server (syncs modules + serves on :8080)
npm run dev

# Or serve manually using Python
python3 -m http.server 8000

# Open browser to http://localhost:8080 (or :8000)
```

**Development Workflow**:
- `npm run sync` - Regenerate `waba-modules.js` from WABA .lp files
- `npm run build` - Alias for `npm run sync`
- `npm run dev` - Sync modules + start local server

See `modules/README.md` for detailed module architecture documentation.

## Architecture

### Modular ES6 Design (December 2024 Refactoring)

The playground uses a **modular ES6 architecture** with 10 specialized manager modules:

**Core Files**:
- **`index.html`** - Main UI structure with editor, controls, graph container, and output panels
- **`style.css`** - Modern dark/light theme styling with responsive design
- **`app.js`** - Main orchestration (565 lines, 90% reduction from original 5,417-line monolith)
- **`examples.js`** - Preloaded topology-focused WABA framework examples
- **`waba-modules.js`** - Auto-generated embeddings of all 49 WABA .lp modules

**Modules** (in `modules/` directory):
- **`theme-manager.js`** - Dark/light theme switching and graph color updates
- **`font-manager.js`** - Font size controls (60%-200%)
- **`ui-manager.js`** - UI interactions (modals, overlays, fullscreen, empty states)
- **`file-manager.js`** - File I/O and format conversion (.lp ↔ .waba)
- **`parser-utils.js`** - Shared regex-based parsing utilities (removes duplication)
- **`graph-utils.js`** - Shared graph styling utilities (removes ~500 lines duplication)
- **`graph-manager.js`** - Graph infrastructure and extension highlighting
- **`popup-manager.js`** - Popup displays and tooltips (removes duplication)
- **`clingo-manager.js`** - Clingo WASM integration (73% smaller, no hardcoded .lp strings)
- **`output-manager.js`** - Result display, parsing, and logging

**Scripts** (in `scripts/` directory):
- **`sync-modules.js`** - Build script that generates `waba-modules.js` from WABA .lp files

**Code Reduction**: ~90% reduction in main app.js (5,417 → 565 lines), ~680 lines of duplication removed

See **`modules/README.md`** for detailed module architecture documentation.

### How It Works

1. **Modular Composition**: Combines WABA core, semiring, monoid, and semantics modules at runtime
2. **Automated Sync**: `npm run sync` regenerates `waba-modules.js` from WABA .lp source files
3. **WebAssembly Execution**: Runs full clingo solver in the browser via [clingo-wasm](https://github.com/domoritz/clingo-wasm)
4. **No Backend Required**: Pure client-side application, works offline after initial load

## Example Frameworks

The playground includes 7 topology-focused examples demonstrating different argumentation structures:

1. **Simple** - Mixed attacks (derived and non-derived)
2. **Linear** - Chain topology: a → b → c → d (sequential attack propagation)
3. **Cycle** - Circular topology: a → b → c → a (mutual defeat cycles)
4. **Tree** - Hierarchical topology: root branches to multiple levels
5. **Complete** - Fully connected topology: all assumptions attack each other jointly *(default)*
6. **Mixed** - Complex topology combining linear chains, cycles, and branching
7. **Isolated** - Disconnected components: separate argumentation islands

Each example demonstrates both **derived attacks** (via rules with bodies) and **non-derived attacks** (via facts), highlighting how different topologies affect extension computation and cost aggregation.

## Graph Visualization Modes

The playground offers three complementary visualization modes, accessible via the selector at the top of the graph:

### 1. Standard Mode (Set-Based View)
- Shows **all possible assumption sets** as nodes
- Edges represent **attacks between sets**
- Best for understanding the complete extension space
- Useful for small frameworks (2-5 assumptions)

### 2. Assumption-Direct Mode *(default)*
- Shows **individual assumptions** as nodes
- **Joint attacks** displayed as multiple dashed edges converging on the target
- Cleaner visualization for assumption-level reasoning
- Best for understanding direct attack relationships

### 3. Assumption-Branching Mode
- Shows **individual assumptions** as nodes
- **Junction nodes** (⊗) represent joint attacks with branching edges
- Visual convergence shows which assumptions collaborate to attack
- Best for complex frameworks with many joint attacks

### Interactive Features
- **Click nodes** to see detailed information (weights, types, connections)
- **Click edges** to see attack details (direct/derived/joint, weights)
- **Click extensions** in the results panel to highlight them in the graph:
  - Green nodes = assumptions IN the extension
  - Gray nodes = assumptions OUT of the extension
  - Gray dashed edges = discarded attacks
- **Double-click** the graph background to reset highlighting
- **Reset Layout** button to re-center the graph
- **Fullscreen** button for detailed exploration

## Semiring & Monoid Combinations

### Semirings (Weight Propagation)

- **Gödel (min/max)**: Weakest-link reasoning, fuzzy logic
- **Tropical (+/min)**: Cost minimization, additive accumulation
- **Arctic (+/max)**: Reward maximization (dual of Tropical)
- **Łukasiewicz**: Bounded sum logic with normalization
- **Bottleneck-Cost (max/min)**: Worst-case optimization

### Monoids (Cost Aggregation)

- **MAX**: Extension cost = maximum discarded attack
- **SUM**: Extension cost = sum of all discarded attacks
- **MIN**: Extension cost = minimum discarded attack
- **COUNT**: Extension cost = number of discarded attacks

## Framework Syntax

```prolog
%% Assumptions
assumption(a).

%% Weights (0-100 or custom range)
weight(a, 80).

%% Rules (separate head and body predicates)
% r1: conclusion <- premise1, premise2
head(r1, conclusion). body(r1, premise1; r1, premise2).

%% Contraries (total function from assumptions)
% Format: contrary(attacked_assumption, attacking_element)
contrary(a, c_a).
```

**Note:** Budget is controlled via the UI, not in framework files.

## Deploying to GitHub Pages

1. **Create GitHub Repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: WABA Playground"
   git branch -M main
   git remote add origin https://github.com/yourusername/waba-playground.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from branch `main`
   - Folder: `/ (root)`
   - Click Save

3. **Access Your Playground**:
   - Visit `https://yourusername.github.io/waba-playground`
   - Share with collaborators and students!

## Technical Details

### Dependencies

- [clingo-wasm](https://github.com/domoritz/clingo-wasm) v1.3.0 - Clingo compiled to WebAssembly
- [vis.js Network](https://visjs.github.io/vis-network/) - Interactive graph visualization with physics simulation
- [Google Fonts](https://fonts.google.com) - Inter (UI) and JetBrains Mono (code)

### Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ⚠️ Limited (requires landscape mode for best UX)

### Performance

- **Cold start**: ~2-3s (WASM loading)
- **Execution**: 0.01s - 10s depending on framework complexity
- **Memory**: ~50MB WASM runtime

## Syncing with WABA Implementation

The playground automatically embeds all WABA logic modules from the parent repository. When you update the main WABA implementation, sync is fully automated:

```bash
# After updating WABA .lp files in ../WABA/
cd waba-playground
npm run sync

# This regenerates waba-modules.js with all 49 WABA modules
# Then commit and push to deploy
git add waba-modules.js
git commit -m "Sync WABA modules: <description of changes>"
git push origin main
```

### What Gets Synced (49 Modules Total)

**Synced from `../WABA/` directory:**
- **Core Base** (1): `core/base.lp` → `wabaModules.core.base`
- **Semirings** (5): `semiring/*.lp` → `wabaModules.semiring.*`
  - godel, tropical, arctic, lukasiewicz, bottleneck_cost
- **Monoids** (10): `monoid/*_{minimization,maximization}.lp` → `wabaModules.monoid.*`
  - max, sum, min, count, lex (each with minimization and maximization)
- **Semantics** (21): `semantics/**/*.lp` → `wabaModules.semantics.*`
  - Core: stable, cf, admissible, complete, grounded
  - Extension-based: ideal, naive, preferred, semi-stable, staged
  - Heuristic: heuristic-{naive, preferred, semi-stable, staged, grounded}
  - OptN: optN-{preferred, semi-stable, staged, ideal, eager, grounded}
- **Constraints** (10): `constraint/*.lp` → `wabaModules.constraint.*`
  - Upper bounds: ub_max, ub_sum, ub_min, ub_count
  - Lower bounds: lb_max, lb_sum, lb_min, lb_count
  - Special: ub_lex, lb_lex
- **Filters** (2): `filter/*.lp` → `wabaModules.filter.*`
  - standard, projection

### How Auto-Sync Works

1. **Build Script**: `scripts/sync-modules.js` reads all .lp files from `../WABA/`
2. **Generation**: Creates `waba-modules.js` with embedded modules as JavaScript strings
3. **Import**: `clingo-manager.js` imports `wabaModules` and assembles programs at runtime
4. **No Manual Editing**: Never edit `waba-modules.js` manually (it's auto-generated)

### Sync Process Details

**Input**: WABA .lp files in `../WABA/` directory
**Output**: `waba-modules.js` (auto-generated ES6 module)
**Trigger**: Run `npm run sync` after WABA updates
**Validation**: Script reports missing files and exits on error

See **`modules/README.md`** → "WABA Module Sync Process" for complete technical details.

## Customization

### Adding New Examples

Edit `examples.js`:

```javascript
const examples = {
    myExample: `%% My Custom Example
assumption(x).
weight(x, 50).
contrary(x, c_x).
`,
    // ... other examples
};
```

**Note:** Don't include `budget()` facts - budget is controlled via UI.

Update `index.html` example selector:
```html
<option value="myExample">My Custom Example</option>
```

### Changing Semirings/Monoids

To add new algebraic structures, edit the corresponding methods in `app.js`:
- `getSemiringModule(semiring)`
- `getMonoidModule(monoid)`

## Related Resources

- [WABA GitHub Repository](https://github.com/yourusername/WABA) - Full implementation
- [Clingo Documentation](https://potassco.org/clingo/) - Answer Set Programming
- [Original Paper](link-to-paper) - Theoretical foundations

## License

MIT License - See main WABA repository for details

## Credits

- Built with [clingo-wasm](https://github.com/domoritz/clingo-wasm) by Dominik Moritz
- WABA framework by [Your Name]
- Playground interface designed for educational and research use

## Support

- 🐛 Report bugs via [GitHub Issues](https://github.com/yourusername/waba-playground/issues)
- 💬 Ask questions in [Discussions](https://github.com/yourusername/waba-playground/discussions)
- 📧 Contact: your.email@domain.com

---

**Have fun exploring weighted argumentation! 🎮**
