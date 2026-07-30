/**
 * OutputManager - Handles result display, parsing, and logging
 */
import { PopupManager } from './popup-manager.js?v=20260730-4';
import { MetricsManager } from './metrics-manager.js?v=20260730-4';
import { parseAnswerSet, splitTopLevelArgs } from '../runtime/answer-set-parser.js?v=20260730-4';
import { ParserUtils, escapeHtml } from './parser-utils.js?v=20260730-4';
import { compareTuples, computeAggregateFromDiscarded, displayValue, getObjectiveTuple, normalizeAggregateValue } from '../runtime/objective-utils.js?v=20260730-4';

/**
 * Split a `discarded_attack(from, target, weight)` predicate string into its
 * three top-level arguments, respecting nested-term parens so atoms like
 * `p(x,y)` are not mis-split on their inner comma.
 * @param {string} predicate
 * @returns {{from: string, target: string, weight: string} | null}
 */
function parseDiscardedAttackArgs(predicate) {
    const match = predicate.match(/^discarded_attack\((.*)\)$/s);
    if (!match) {
        return null;
    }
    const args = splitTopLevelArgs(match[1]);
    if (args.length !== 3) {
        return null;
    }
    return { from: args[0], target: args[1], weight: args[2] };
}

export class OutputManager {
    constructor(dom, getConfig = null) {
        this.dom = dom;
        this.output = dom.output;
        this.stats = dom.stats;
        this.semiringSelect = dom.semiringSelect;
        this.getConfig = getConfig;
        this.activeExtensionId = null;  // Track currently highlighted extension
        // Static framework structure (rules + assumptions) for attack provenance,
        // populated per run in displayResults(). Needed because projection mode's
        // #show omits head/body/assumption, so the witness alone cannot trace an
        // attack back to its supporting assumptions.
        this.frameworkRules = new Map();
        this.frameworkAssumptions = new Set();
        this.renderAnalysisHome();
    }

    renderAnalysisHome() {
        const exportSection = this.dom.exportSection;
        if (!exportSection) {
            return;
        }

        exportSection.innerHTML = `
            <div class="analysis-empty-state">
                <div class="analysis-empty-card">
                    <h4>Decision Analysis</h4>
                    <p>Run a framework to populate ranked extensions, best-assumption summaries, and CSV export.</p>
                </div>
                <div class="analysis-empty-card">
                    <h4>Graph Export</h4>
                    <p>The current graph view can always be exported from here, even before a solver run.</p>
                    <div class="analysis-button-group">
                        <button type="button" id="analysis-export-png-proxy" class="analysis-action-btn analysis-action-btn-secondary">💾 Export PNG</button>
                        <button type="button" id="analysis-export-pdf-proxy" class="analysis-action-btn analysis-action-btn-secondary">📄 Export PDF</button>
                    </div>
                </div>
            </div>
        `;

        const pngProxy = this.dom.document.getElementById('analysis-export-png-proxy');
        if (pngProxy && this.dom.exportPngBtn) {
            pngProxy.addEventListener('click', () => this.dom.exportPngBtn.click());
        }

        const pdfProxy = this.dom.document.getElementById('analysis-export-pdf-proxy');
        if (pdfProxy && this.dom.exportPdfBtn) {
            pdfProxy.addEventListener('click', () => this.dom.exportPdfBtn.click());
        }
    }

    // ===================================
    // Display Results
    /**
     * The effective run config. Every control now lives behind ConfigController, so there is
     * no per-select fallback to reconstruct; without a config we report the no-discard shape.
     */
    readConfig() {
        return this.getConfig
            ? this.getConfig()
            : { monoid: 'sum', optimization: 'minimize', budgetMode: 'none', budgetIntent: 'no_discard' };
    }

    semiringLabel() {
        const select = this.semiringSelect;
        return select?.options?.[select.selectedIndex]?.text || select?.value || 'godel';
    }

    static describeReading(config) {
        if (config.abaRecovery) return 'no discarding (ABA recovery)';
        if (config.budgetMode === 'none') return 'no discarding';
        const bound = config.budgetMode === 'lb' ? '\u2265' : '\u2264';
        return `${config.monoid} of concessions ${bound} \u03b2`;
    }

    // ===================================
    displayResults(result, elapsed, onHighlightExtension, onResetGraph, effectiveConfig = null, frameworkCode = '', defenceCosts = null) {
        // Handle clingo-wasm object format
        const witnesses = result.Call?.[0]?.Witnesses || [];
        const isSuccessful = result.Result === 'SATISFIABLE' ||
                            result.Result === 'OPTIMUM FOUND';
        const config = effectiveConfig || this.readConfig();
        this.lastRunConfig = config;

        // Parse the static framework structure for attack provenance. In projection
        // mode the witness omits head/body/assumption (#show is minimal), so the
        // attacking element cannot be traced to its supporting assumptions from the
        // witness alone — fall back to the framework source.
        this.frameworkRules = new Map();
        this.frameworkAssumptions = new Set();
        if (frameworkCode) {
            for (const rule of ParserUtils.parseRules(frameworkCode)) {
                this.frameworkRules.set(rule.id, { head: rule.head, body: rule.body });
            }
            for (const a of ParserUtils.parseAssumptions(frameworkCode)) {
                this.frameworkAssumptions.add(a);
            }
        }

        // Reset active extension when displaying new results
        this.activeExtensionId = null;

        this.log(`\n${result.Result}`, 'info');

        if (!isSuccessful || witnesses.length === 0) {
            // Non-flat frameworks are rejected by the core (UNSAT), which otherwise
            // surfaces as a bare "no extensions". Detect it and explain.
            const nonFlat = [...this.frameworkAssumptions].filter((assumption) =>
                [...this.frameworkRules.values()].some((rule) => rule.head === assumption));
            if (nonFlat.length > 0) {
                const plural = nonFlat.length > 1;
                this.log(`⚠️ No extensions: this framework is NOT flat — the assumption${plural ? 's' : ''} ${nonFlat.join(', ')} appear${plural ? '' : 's'} as a rule head.`, 'warning');
                this.log('Weighted ABA is defined for FLAT frameworks only: an assumption must never be derivable by a rule. Remove the rule(s) deriving the assumption(s) above (or rename them to ordinary atoms).', 'info');
            } else {
                this.log('⚠️ No extensions found', 'warning');
                this.log('Try adjusting the budget or framework constraints', 'info');
            }
        } else {
            // Advisory: the core flags an explicit weight placed on a DERIVED atom whose
            // semiring-propagated value ended up different — i.e. the declared weight did not
            // take effect. Weights belong on the leaves; surface it so the modeller can move it.
            const dominated = new Map();
            for (const witness of witnesses) {
                for (const atom of (witness.Value || [])) {
                    const m = /^weight_on_derived_dominated\(([^,]+),\s*([^,]+),\s*([^)]+)\)$/.exec(atom);
                    if (m) {
                        dominated.set(m[1], { declared: m[2].trim(), effective: m[3].trim() });
                    }
                }
            }
            if (dominated.size > 0) {
                const list = [...dominated.entries()]
                    .map(([x, w]) => `${x} (declared ${w.declared} → resolves to ${w.effective})`).join(', ');
                this.log(`⚠️ Explicit weight on a derived atom had no effect: ${list}.`, 'warning');
                this.log('In WABA weights belong on the leaves (assumptions / facts); a weight on a derived atom is combined with its derivation via the semiring and can be dominated. Move the weight to a leaf — e.g. a weighted fact — or let it propagate. See README, "Where weights live".', 'info');
            }

            const witnessesWithCosts = witnesses.map((witness) => {
                const predicates = witness.Value || [];
                const parsed = this.parseAnswerSet(predicates);
                const aggregateValue = parsed.budgetValueRaw !== null
                    ? normalizeAggregateValue(parsed.budgetValueRaw)
                    : computeAggregateFromDiscarded(parsed.discarded, config.monoid);
                // The defence semantics carry no discarded_attack/3 at all, so the monoid
                // aggregate is meaningless for them; their cost is the separately probed
                // minimum concession (see ClingoManager.computeDefenceCosts).
                const defenceCost = defenceCosts
                    ? defenceCosts.get(parsed.in.slice().sort().join(','))
                    : undefined;
                const cost = defenceCost !== undefined
                    ? displayValue(defenceCost)
                    : ((config.budgetMode === 'none' && config.budgetIntent === 'no_discard')
                        ? null
                        : this.extractDisplayCost(witness, aggregateValue, config.monoid, config.optimization));

                return {
                    witness,
                    parsed,
                    cost,
                    aggregateValue,
                    objectiveTuple: getObjectiveTuple(config, aggregateValue)
                };
            });

            witnessesWithCosts.sort((a, b) => {
                const tupleComparison = compareTuples(a.objectiveTuple, b.objectiveTuple);
                if (tupleComparison !== 0) {
                    return tupleComparison;
                }
                return a.parsed.in.join(',').localeCompare(b.parsed.in.join(','));
            });

            // Display all witnesses in sorted order
            witnessesWithCosts.forEach((item, index) => {
                this.appendAnswerSet(
                    item.witness,
                    index + 1,
                    onHighlightExtension,
                    onResetGraph,
                    item.cost
                );
            });

            if (result.Result === 'OPTIMUM FOUND') {
                this.log(`\n✓ Found ${witnesses.length} optimal extension(s)`, 'success');
            }

            // Store witnesses for download
            this.storedWitnesses = witnessesWithCosts;

            // Add download and metrics buttons if there are extensions
            this.addDownloadButton();
            this.addMetricsButton();
        }

        // Display statistics
        this.stats.innerHTML = `
            <strong>Execution Stats:</strong>
            ${witnesses.length} extension(s) found |
            Computed in ${elapsed}s |
            Algebra: ${this.semiringLabel()} |
            Reading: ${OutputManager.describeReading(config)}
        `;
    }

    addDownloadButton() {
        // Check if button already exists
        if (this.dom.document.getElementById('download-all-extensions-btn')) {
            return;
        }

        // Create download button with unified styling
        const button = document.createElement('button');
        button.id = 'download-all-extensions-btn';
        button.className = 'analysis-action-btn';
        button.innerHTML = '💾 Download All Extensions';
        button.addEventListener('click', () => this.downloadAllExtensions());

        // Get or create button group container
        let buttonGroup = this.dom.document.getElementById('analysis-button-group');
        const exportSection = this.dom.exportSection;

        if (!buttonGroup && exportSection) {
            buttonGroup = document.createElement('div');
            buttonGroup.id = 'analysis-button-group';
            buttonGroup.className = 'analysis-button-group';
            exportSection.appendChild(buttonGroup);
        }

        if (buttonGroup) {
            buttonGroup.appendChild(button);
        } else {
            // Fallback: insert at top of output if export section not found
            this.output.insertBefore(button, this.output.firstChild);
        }
    }

    downloadAllExtensions() {
        if (!this.storedWitnesses || this.storedWitnesses.length === 0) {
            return;
        }

        let textContent = '';

        this.storedWitnesses.forEach((item, index) => {
            const parsed = item.parsed;
            const extensionNumber = index + 1;

            // Build textual representation for this extension
            let extensionText = `${extensionNumber}: `;
            let parts = [];

            // In assumptions
            if (parsed.in && parsed.in.length > 0) {
                parts.push(parsed.in.map(a => `in(${a})`).join('. ') + '.');
            }

            // Supported atoms with weights
            if (parsed.supported && parsed.supported.length > 0) {
                const supportedPredicates = parsed.supported.map(a => {
                    const weight = parsed.weights.get(a);
                    if (weight !== undefined) {
                        return `supported_with_weight(${a}, ${weight})`;
                    }
                    return `supported(${a})`;
                }).join('. ') + '.';
                parts.push(supportedPredicates);
            }

            // Discarded attacks
            if (parsed.discarded && parsed.discarded.length > 0) {
                const discardedPredicates = parsed.discarded.map(attack => {
                    const args = parseDiscardedAttackArgs(attack);
                    if (args) {
                        return `discarded_attack(${args.from}, ${args.target}, ${args.weight})`;
                    }
                    return attack;
                }).join('. ') + '.';
                parts.push(discardedPredicates);
            }

            // Cost
            if (item.cost !== null) {
                parts.push(`cost(${item.cost}).`);
            }

            extensionText += parts.join(' ');
            textContent += extensionText + '\n';
        });

        // Create and download file
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        link.download = `waba-extensions-${timestamp}.txt`;

        link.click();
        URL.revokeObjectURL(url);
    }

    addMetricsButton() {
        // Check if button already exists
        if (this.dom.document.getElementById('metrics-toggle-btn')) {
            return;
        }

        // Create metrics toggle button with unified styling
        const button = document.createElement('button');
        button.id = 'metrics-toggle-btn';
        button.className = 'analysis-action-btn';
        button.innerHTML = '<span class="toggle-icon">▶</span> Show Decision Analysis';
        button.addEventListener('click', () => this.toggleMetrics(button));

        // Add to the same button group as download button
        let buttonGroup = this.dom.document.getElementById('analysis-button-group');
        const exportSection = this.dom.exportSection;

        if (!buttonGroup && exportSection) {
            buttonGroup = document.createElement('div');
            buttonGroup.id = 'analysis-button-group';
            buttonGroup.className = 'analysis-button-group';
            exportSection.appendChild(buttonGroup);
        }

        if (buttonGroup) {
            buttonGroup.appendChild(button);
        } else {
            // Fallback: insert after download button if button group not found
            const downloadBtn = this.dom.document.getElementById('download-all-extensions-btn');
            if (downloadBtn && downloadBtn.nextSibling) {
                this.output.insertBefore(button, downloadBtn.nextSibling);
            } else {
                this.output.insertBefore(button, this.output.firstChild);
            }
        }
    }

    toggleMetrics(button) {
        const metricsDiv = this.dom.document.getElementById('metrics-display');

        if (metricsDiv) {
            // Toggle visibility
            const isHidden = metricsDiv.style.display === 'none';
            metricsDiv.style.display = isHidden ? 'block' : 'none';
            button.innerHTML = isHidden
                ? '<span class="toggle-icon">▼</span> Hide Decision Analysis'
                : '<span class="toggle-icon">▶</span> Show Decision Analysis';
            button.classList.toggle('expanded', isHidden);
        } else {
            // Compute and display metrics for the first time
            this.displayMetrics(button);
        }
    }

    displayMetrics(button) {
        if (!this.storedWitnesses || this.storedWitnesses.length === 0) {
            return;
        }

        // Build config for metrics computation
        const config = this.lastRunConfig || this.readConfig();

        // Compute metrics with config
        const metricsData = MetricsManager.computeMetrics(this.storedWitnesses, config);

        if (!metricsData) {
            this.log('⚠️ Could not compute metrics', 'warning');
            return;
        }

        // Store metrics data for CSV export
        this.storedMetricsData = metricsData;

        // Create metrics display div
        let metricsDiv = this.dom.document.getElementById('metrics-display');
        if (!metricsDiv) {
            metricsDiv = document.createElement('div');
            metricsDiv.id = 'metrics-display';
            metricsDiv.style.display = 'block';

            // Insert into export section after button group
            const exportSection = this.dom.exportSection;
            const buttonGroup = this.dom.document.getElementById('analysis-button-group');

            if (exportSection && buttonGroup && buttonGroup.parentNode === exportSection) {
                // Insert after button group
                if (buttonGroup.nextSibling) {
                    exportSection.insertBefore(metricsDiv, buttonGroup.nextSibling);
                } else {
                    exportSection.appendChild(metricsDiv);
                }
            } else {
                // Fallback: insert after button
                if (button.nextSibling) {
                    button.parentNode.insertBefore(metricsDiv, button.nextSibling);
                } else {
                    button.parentNode.appendChild(metricsDiv);
                }
            }
        }

        // Render metrics HTML
        metricsDiv.innerHTML = MetricsManager.formatMetricsHTML(metricsData);

        // Wire up CSV export button
        const csvButton = this.dom.document.getElementById('export-metrics-csv-btn');
        if (csvButton) {
            csvButton.addEventListener('click', () => {
                MetricsManager.downloadMetricsCSV(this.storedMetricsData);
            });
        }

        // Update button text
        button.innerHTML = '<span class="toggle-icon">▼</span> Hide Decision Analysis';
        button.classList.add('expanded');
    }

    // `precomputedCost` defaults to undefined, NOT null: displayResults deliberately passes
    // null to mean "no cost applies" (no-discard mode, where nothing can be discarded). With
    // a null default the two were indistinguishable, so the suppression was silently undone
    // and the cost recomputed from an EMPTY discard set - rendering #inf (max) or #sup (min).
    appendAnswerSet(witness, answerNumber, onHighlightExtension, onResetGraph, precomputedCost = undefined) {
        // witness is an object with Time and Value properties
        // Value is an array of predicate strings
        const predicates = witness.Value || [];

        // Parse the predicates
        const parsed = this.parseAnswerSet(predicates);

        // Use pre-computed cost if available, otherwise compute it
        let cost;
        if (precomputedCost !== undefined) {
            cost = precomputedCost;
        } else {
            const config = this.lastRunConfig || this.readConfig();
            const aggregateValue = parsed.budgetValueRaw !== null
                ? normalizeAggregateValue(parsed.budgetValueRaw)
                : computeAggregateFromDiscarded(parsed.discarded, config.monoid);
            cost = this.extractDisplayCost(witness, aggregateValue, config.monoid);
        }
        parsed.cost = cost;

        const answerDiv = document.createElement('div');
        answerDiv.className = 'answer-set';

        // Build HTML with chips/badges
        let contentHTML = '<div class="answer-content">';

        // Assumptions with chips
        if (parsed.in.length > 0 || parsed.out.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Assumptions:</span>';

            // In assumptions (green chips)
            parsed.in.forEach(a => {
                contentHTML += `<span class="chip in"><span class="chip-icon">✓</span>${escapeHtml(a)}</span>`;
            });

            // Out assumptions (greyed out chips)
            parsed.out.forEach(a => {
                contentHTML += `<span class="chip out"><span class="chip-icon">✗</span>${escapeHtml(a)}</span>`;
            });

            contentHTML += '</div>';
        }

        // Successful attacks
        if (parsed.successful.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Active Attacks:</span>';
            contentHTML += '<div class="attacks-list">';
            parsed.successful.forEach(attack => {
                const match = attack.match(/attacks_successfully_with_weight\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const [, attackingElement, targetAssumption] = match;

                    // Find assumptions that support the attacking element (contrary)
                    const supportingAssumptions = this.findSupportingAssumptions(attackingElement, parsed);

                    // Format as "a1, a2, ..., an ⊢ c [target]"
                    if (supportingAssumptions.length > 0) {
                        const assumptions = supportingAssumptions.join(', ');
                        contentHTML += `<div class="attack-item">${escapeHtml(assumptions)} <span class="attack-arrow">⊢</span> ${escapeHtml(attackingElement)} <span style="color: var(--text-muted); font-size: 0.9em;">[${escapeHtml(targetAssumption)}]</span></div>`;
                    } else {
                        // Non-derived attack (no supporting assumptions)
                        contentHTML += `<div class="attack-item">⊤ <span class="attack-arrow">⊢</span> ${escapeHtml(attackingElement)} <span style="color: var(--text-muted); font-size: 0.9em;">[${escapeHtml(targetAssumption)}]</span></div>`;
                    }
                }
            });
            contentHTML += '</div></div>';
        }

        // Discarded attacks
        if (parsed.discarded.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Discarded Attacks:</span>';
            contentHTML += '<div class="attacks-list">';
            parsed.discarded.forEach(attack => {
                const args = parseDiscardedAttackArgs(attack);
                if (args) {
                    const attackingElement = args.from;
                    const targetAssumption = args.target;
                    const weight = args.weight;

                    // Find assumptions that support the attacking element (contrary)
                    const supportingAssumptions = this.findSupportingAssumptions(attackingElement, parsed);

                    // Format as "a1, a2, ..., an ⊬ c [target] (w: weight)"
                    if (supportingAssumptions.length > 0) {
                        const assumptions = supportingAssumptions.join(', ');
                        contentHTML += `<div class="attack-item discarded">${escapeHtml(assumptions)} <span class="attack-arrow">⊬</span> ${escapeHtml(attackingElement)} <span style="color: var(--text-muted); font-size: 0.9em;">[${escapeHtml(targetAssumption)}]</span> <span style="color: var(--text-muted)">(w: ${displayValue(weight)})</span></div>`;
                    } else {
                        // Non-derived attack (no supporting assumptions)
                        contentHTML += `<div class="attack-item discarded">⊤ <span class="attack-arrow">⊬</span> ${escapeHtml(attackingElement)} <span style="color: var(--text-muted); font-size: 0.9em;">[${escapeHtml(targetAssumption)}]</span> <span style="color: var(--text-muted)">(w: ${displayValue(weight)})</span></div>`;
                    }
                }
            });
            contentHTML += '</div></div>';
        }

        // Derived atoms (non-assumption supported atoms)
        if (parsed.derived && parsed.derived.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Derived Atoms:</span>';
            contentHTML += '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
            parsed.derived.forEach(atom => {
                const weight = parsed.weights.get(atom);
                const weightDisplay = weight !== undefined ? ` <span style="color: var(--warning-color); font-size: 0.85em;">(w: ${displayValue(weight)})</span>` : '';
                const atomId = `derived-${answerNumber}-${atom.replace(/[^a-zA-Z0-9]/g, '_')}`;
                contentHTML += `<span class="chip" style="background: var(--info-color, #3b82f6); border-color: var(--info-color, #3b82f6); cursor: pointer;" id="${atomId}" data-atom="${escapeHtml(atom)}" data-extension="${answerNumber}">${escapeHtml(atom)}${weightDisplay}</span>`;
            });
            contentHTML += '</div></div>';
        }

        // Active contraries (contrary atoms that are supported)
        if (parsed.activeContraries && parsed.activeContraries.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Active Contraries:</span>';
            contentHTML += '<div class="contraries-list" style="display: flex; flex-direction: column; gap: 4px;">';
            parsed.activeContraries.forEach(({ assumption, contrary }) => {
                const isDefeated = !parsed.in.includes(assumption);
                contentHTML += `<div style="font-family: monospace; font-size: 0.9em;">`;
                contentHTML += `<span style="color: var(--warning-color)">${escapeHtml(contrary)}</span> `;
                contentHTML += `<span style="color: var(--text-muted)">attacks</span> `;
                contentHTML += `<span style="color: ${isDefeated ? 'var(--error-color)' : 'var(--success-color)'}">${escapeHtml(assumption)}</span>`;
                contentHTML += isDefeated ? ' <span style="color: var(--error-color)">✗</span>' : '';
                contentHTML += `</div>`;
            });
            contentHTML += '</div></div>';
        }

        // Textual Result (Clingo-like format) - Collapsible
        contentHTML += '<div class="assumption-section textual-result-section">';
        contentHTML += '<span class="section-label textual-result-toggle" data-extension="${answerNumber}" style="cursor: pointer; user-select: none;">';
        contentHTML += '<span class="toggle-icon">▶</span> Textual Result';
        contentHTML += '</span>';
        contentHTML += '<div class="textual-result" data-extension="${answerNumber}" style="display: none;">';

        // Build textual representation
        let textualLines = [];

        // In assumptions
        if (parsed.in.length > 0) {
            const inPredicates = parsed.in.map(a => `in(${a})`).join('. ') + '.';
            textualLines.push(inPredicates);
        }

        // Supported atoms with weights
        if (parsed.supported && parsed.supported.length > 0) {
            const supportedPredicates = parsed.supported.map(a => {
                const weight = parsed.weights.get(a);
                if (weight !== undefined) {
                    return `supported_with_weight(${a}, ${weight})`;
                }
                return `supported(${a})`;
            }).join('. ') + '.';
            textualLines.push(supportedPredicates);
        }

        // Discarded attacks
        if (parsed.discarded && parsed.discarded.length > 0) {
            const discardedPredicates = parsed.discarded.map(attack => {
                const args = parseDiscardedAttackArgs(attack);
                if (args) {
                    return `discarded_attack(${args.from}, ${args.target}, ${args.weight})`;
                }
                return attack;
            }).join('. ') + '.';
            textualLines.push(discardedPredicates);
        }

        if (parsed.budgetValue !== null) {
            textualLines.push(`budget_value(${parsed.budgetValue}).`);
        }

        // Cost information
        if (parsed.cost !== null) {
            textualLines.push(`cost(${parsed.cost}).`);
        }

        // Join all lines with newlines
        const textualResult = textualLines.join('\n');
        contentHTML += `<pre class="textual-result-content">${escapeHtml(textualResult)}</pre>`;
        contentHTML += '</div></div>';

        contentHTML += '</div>';

        // A single badge. `Cost` and `β*` used to be rendered side by side from the SAME
        // budget_value/1 atom -- one through displayValue, one raw -- which produced
        // contradictory pairs like "Cost: -inf   β*: #inf". The label now names the aggregate
        // so the number is self-describing instead of needing a legend.
        const costBadge = parsed.cost !== null
            ? `<span class="extension-cost-badge">${escapeHtml(this.costLabel())}: ${escapeHtml(String(parsed.cost))}</span>`
            : '';

        answerDiv.innerHTML = `
            <div class="answer-header clickable-extension" data-extension-id="${answerNumber}">
                <span class="answer-number">Extension ${answerNumber}</span>
                ${costBadge}
                <span class="click-hint" style="font-size: 0.85em; color: var(--text-muted); margin-left: 10px;">👆 Click to highlight</span>
            </div>
            ${contentHTML}
        `;

        // Store extension data for highlighting
        const extensionData = {
            inAssumptions: parsed.in,
            discardedAttacks: parsed.discarded.map(attack => {
                const args = parseDiscardedAttackArgs(attack);
                if (args) {
                    // Map to the format needed for filtering
                    return {
                        source: args.from,
                        target: args.target,
                        via: args.target, // The attacked assumption
                        weight: args.weight
                    };
                }
                return null;
            }).filter(a => a !== null),
            successfulAttacks: parsed.successful // Add successful attacks for highlighting
        };

        // Add click handler to toggle highlight for this extension
        const header = answerDiv.querySelector('.answer-header');
        header.addEventListener('click', () => {
            // Check if clicking the already-active extension (toggle off)
            if (this.activeExtensionId === answerNumber) {
                // Turn off highlighting
                this.dom.document.querySelectorAll('.answer-header').forEach(h => {
                    h.classList.remove('active-extension');
                });
                onResetGraph();
                this.activeExtensionId = null;
            } else {
                // Turn on highlighting for this extension (turn off others)
                this.dom.document.querySelectorAll('.answer-header').forEach(h => {
                    h.classList.remove('active-extension');
                });

                // Reset previous highlighting first
                onResetGraph();

                // Add highlight to this extension
                header.classList.add('active-extension');
                this.activeExtensionId = answerNumber;

                // Highlight in graph
                onHighlightExtension(extensionData.inAssumptions, extensionData.discardedAttacks, extensionData.successfulAttacks);
            }
        });

        // Add click handlers for derived atoms to show derivation chain
        this.output.appendChild(answerDiv);

        if (parsed.derived && parsed.derived.length > 0) {
            parsed.derived.forEach(atom => {
                const atomId = `derived-${answerNumber}-${atom.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const chipElement = answerDiv.querySelector(`#${atomId}`);
                if (chipElement) {
                    chipElement.addEventListener('click', (e) => {
                        e.stopPropagation(); // Don't trigger extension highlight
                        try {
                            PopupManager.showDerivationChain(atom, parsed, chipElement);
                        } catch (error) {
                            console.error('❌ Error calling showDerivationChain:', error);
                            console.error('Error stack:', error.stack);
                        }
                    });
                } else {
                    console.error(`  ❌ Could not find element with ID ${atomId}`);
                }
            });
        }

        // Add click handler for textual result toggle
        const toggleButton = answerDiv.querySelector('.textual-result-toggle');
        const textualContent = answerDiv.querySelector('.textual-result');
        if (toggleButton && textualContent) {
            toggleButton.addEventListener('click', () => {
                const isHidden = textualContent.style.display === 'none';
                textualContent.style.display = isHidden ? 'block' : 'none';

                // Update icon
                const icon = toggleButton.querySelector('.toggle-icon');
                if (icon) {
                    icon.textContent = isHidden ? '▼' : '▶';
                }
            });
        }
    }

    findSupportingAssumptions(element, parsed) {
        // If element is an assumption (declared in the witness or the framework), return it
        if (parsed.assumptions.has(element) || this.frameworkAssumptions.has(element)) {
            return [element];
        }

        // Find the rule that derives this element. Prefer the witness rules; fall back
        // to the static framework rules, since projection mode's #show omits head/body.
        const ruleMaps = this.frameworkRules.size > 0
            ? [parsed.rules, this.frameworkRules]
            : [parsed.rules];
        for (const rules of ruleMaps) {
            for (const [, rule] of rules.entries()) {
                if (rule.head === element) {
                    // Found the rule, recursively find assumptions supporting the body
                    const assumptions = new Set();
                    for (const bodyElement of rule.body) {
                        const supporting = this.findSupportingAssumptions(bodyElement, parsed);
                        supporting.forEach(a => assumptions.add(a));
                    }
                    return Array.from(assumptions).sort();
                }
            }
        }

        // Genuinely not derived from any rule (a fact with empty body) -> attack from ⊤
        return [];
    }

    parseAnswerSet(predicates) {
        return parseAnswerSet(predicates);
    }

    /**
     * What the per-extension number IS, so the badge does not need a legend. Reads the config
     * captured for the current run; falls back to a neutral word if none is available.
     */
    costLabel() {
        const config = this.lastRunConfig || this.readConfig();
        if (['admissible', 'complete', 'preferred'].includes(config.semantics)) {
            return 'β* needed';
        }
        return {
            sum: 'Σ conceded',
            max: 'worst conceded',
            min: 'least conceded'
        }[config.monoid] || 'conceded';
    }

    extractDisplayCost(witness, aggregateValue, _monoid, optimization) {
        // clingo-wasm reports the objective under `Costs` (see run.d.ts: `Costs?: number[]`),
        // NOT `Optimization`. Reading only the latter meant the branch never fired and
        // clingo's actual optimum was silently discarded in favour of the recomputed
        // aggregate. Prefer Costs; keep Optimization as a fallback for other wrappers.
        const objective = witness.Costs !== undefined ? witness.Costs : witness.Optimization;
        if (objective !== undefined) {
            const opt = objective;
            const raw = Array.isArray(opt) ? (opt.length > 0 ? opt[opt.length - 1] : null) : opt;
            // clingo compiles #maximize into #minimize{-W}, so it reports a negated
            // objective for maximize runs. Flip the sign back so the badge shows the
            // actual (positive) reward instead of a negative number.
            const signed = (optimization === 'maximize' && typeof raw === 'number') ? -raw : raw;
            return displayValue(signed);
        }

        if (aggregateValue !== null && aggregateValue !== undefined) {
            return displayValue(aggregateValue);
        }

        return null;
    }

    // ===================================
    // Logging
    // ===================================
    log(message, type = 'info') {
        const msgDiv = this.dom.document.createElement('div');
        msgDiv.className = type === 'error' ? 'error-message' :
                          type === 'warning' ? 'info-message' :
                          type === 'success' ? 'info-message' :
                          'info-message';
        msgDiv.textContent = message;
        this.output.appendChild(msgDiv);
        this.output.scrollTop = this.output.scrollHeight;
    }

    getActiveExtensionData() {
        // Return the active extension ID if one is highlighted
        return this.activeExtensionId;
    }

    restoreActiveExtension() {
        // Re-apply the highlight for the previously active extension. Clear the id
        // first so the click RE-highlights instead of toggling the (still-active)
        // extension off.
        if (this.activeExtensionId !== null) {
            const header = this.output.querySelector(`.answer-header[data-extension-id="${this.activeExtensionId}"]`);
            if (header) {
                this.activeExtensionId = null;
                header.click();
            }
        }
    }

    clearActiveExtension() {
        // Clear the active extension and remove visual highlights
        this.activeExtensionId = null;
        this.dom.document.querySelectorAll('.answer-header').forEach(h => {
            h.classList.remove('active-extension');
        });
    }

    clearOutput() {
        this.output.innerHTML = '';
        this.stats.innerHTML = '';

        // Clear analysis panel section
        this.renderAnalysisHome();

        // Restore the output empty-state placeholder after clearing (the old
        // window.showOutputEmptyState global never existed, so the panel was left blank).
        const emptyState = this.dom.document.getElementById('output-empty-state');
        if (emptyState) {
            emptyState.removeAttribute('hidden');
        }
        // Note: Don't clear isolatedNodes here - they're populated by updateGraph()
        // and needed for displayResults()
    }

    clearPreviousRun(onResetGraph) {
        // Clear all information from previous WABA run

        // Clear output and stats
        this.clearOutput();

        // Clear stored data
        this.storedWitnesses = null;
        this.storedMetricsData = null;
        this.activeExtensionId = null;

        // Reset graph highlighting
        if (onResetGraph) {
            onResetGraph();
        }

        this.log('🔄 Previous run cleared. Ready to load new framework.', 'info');
    }
}
