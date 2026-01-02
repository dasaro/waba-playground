/**
 * OutputManager - Handles result display, parsing, and logging
 */
import { PopupManager } from './popup-manager.js?v=20260101-1';

export class OutputManager {
    constructor(output, stats, semiringSelect, monoidSelect, optimizeSelect) {
        this.output = output;
        this.stats = stats;
        this.semiringSelect = semiringSelect;
        this.monoidSelect = monoidSelect;
        this.optimizeSelect = optimizeSelect;
        this.activeExtensionId = null;  // Track currently highlighted extension
    }

    // ===================================
    // Display Results
    // ===================================
    displayResults(result, elapsed, onHighlightExtension, onResetGraph) {
        // Handle clingo-wasm object format
        const witnesses = result.Call?.[0]?.Witnesses || [];
        const isSuccessful = result.Result === 'SATISFIABLE' ||
                            result.Result === 'OPTIMUM FOUND';

        // Reset active extension when displaying new results
        this.activeExtensionId = null;

        // Debug logging
        console.log('Result:', result.Result);
        console.log('Witnesses count:', witnesses.length);
        console.log('All witnesses:', witnesses);

        this.log(`\n${result.Result}`, 'info');

        if (!isSuccessful || witnesses.length === 0) {
            this.log('⚠️ No extensions found', 'warning');
            this.log('Try adjusting the budget or framework constraints', 'info');
        } else {
            // Determine sort direction from optimization direction selector
            const optDirection = this.optimizeSelect.value;
            const isMinimization = optDirection === 'minimize' || optDirection === 'none';

            // Pre-compute costs for all witnesses (parse predicates to get discarded attacks)
            const witnessesWithCosts = witnesses.map(witness => {
                const predicates = witness.Value || [];
                const parsed = this.parseAnswerSet(predicates);

                // Extract cost from Optimization field, or compute from discarded attacks
                let cost = this.extractCost(witness);
                if (witness.Optimization === undefined && parsed.discarded.length > 0) {
                    cost = this.computeCostFromDiscarded(parsed.discarded);
                }

                return { witness, cost, parsed };
            });

            // Sort by pre-computed costs
            // Minimization: ascending order (0, 70, 90, 95 - lower cost first)
            // Maximization: descending order (95, 90, 70, 0 - higher reward first)
            witnessesWithCosts.sort((a, b) => {
                return isMinimization ? (a.cost - b.cost) : (b.cost - a.cost);
            });

            console.log('Optimization direction:', optDirection);
            console.log('Sort order:', isMinimization ? 'ascending (lower cost first)' : 'descending (higher reward first)');
            console.log('Sorted costs:');
            witnessesWithCosts.forEach((item, i) => {
                console.log(`  ${i+1}. Cost: ${item.cost}`);
            });

            // Display all witnesses in sorted order
            console.log('Displaying witnesses...');
            witnessesWithCosts.forEach((item, index) => {
                console.log(`Processing witness ${index + 1}:`, item.witness, 'cost:', item.cost);
                this.appendAnswerSet(item.witness, index + 1, onHighlightExtension, onResetGraph, item.cost);
            });

            if (result.Result === 'OPTIMUM FOUND') {
                this.log(`\n✓ Found ${witnesses.length} optimal extension(s)`, 'success');
            }

            // Store witnesses for download
            this.storedWitnesses = witnessesWithCosts;

            // Add download button if there are extensions
            this.addDownloadButton();
        }

        // Display statistics
        this.stats.innerHTML = `
            <strong>Execution Stats:</strong>
            ${witnesses.length} extension(s) found |
            Computed in ${elapsed}s |
            Semiring: ${this.semiringSelect.options[this.semiringSelect.selectedIndex].text} |
            Monoid: ${this.monoidSelect.options[this.monoidSelect.selectedIndex].text}
        `;
    }

    addDownloadButton() {
        // Check if button already exists
        if (document.getElementById('download-all-extensions-btn')) {
            return;
        }

        // Create download button
        const button = document.createElement('button');
        button.id = 'download-all-extensions-btn';
        button.className = 'download-all-btn';
        button.innerHTML = '💾 Download All Extensions';
        button.addEventListener('click', () => this.downloadAllExtensions());

        // Insert at the top of output
        this.output.insertBefore(button, this.output.firstChild);
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

            // Supported atoms
            if (parsed.supported && parsed.supported.length > 0) {
                parts.push(parsed.supported.map(a => `supported(${a})`).join('. ') + '.');
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

    appendAnswerSet(witness, answerNumber, onHighlightExtension, onResetGraph, precomputedCost = null) {
        // witness is an object with Time and Value properties
        // Value is an array of predicate strings
        const predicates = witness.Value || [];

        // Parse the predicates
        const parsed = this.parseAnswerSet(predicates);

        // Use pre-computed cost if available, otherwise compute it
        let cost;
        if (precomputedCost !== null) {
            cost = precomputedCost;
        } else {
            cost = this.extractCost(witness);
            if (witness.Optimization === undefined && parsed.discarded.length > 0) {
                cost = this.computeCostFromDiscarded(parsed.discarded);
            }
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
                contentHTML += `<span class="chip in"><span class="chip-icon">✓</span>${a}</span>`;
            });

            // Out assumptions (greyed out chips)
            parsed.out.forEach(a => {
                contentHTML += `<span class="chip out"><span class="chip-icon">✗</span>${a}</span>`;
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
                    const [, attackingElement, targetAssumption, weight] = match;

                    // Find assumptions that support the attacking element (contrary)
                    const supportingAssumptions = this.findSupportingAssumptions(attackingElement, parsed);

                    // Format as "a1, a2, ..., an ⊢ c [target]"
                    if (supportingAssumptions.length > 0) {
                        const assumptions = supportingAssumptions.join(', ');
                        contentHTML += `<div class="attack-item">${assumptions} <span class="attack-arrow">⊢</span> ${attackingElement} <span style="color: var(--text-muted); font-size: 0.9em;">[${targetAssumption}]</span></div>`;
                    } else {
                        // Non-derived attack (no supporting assumptions)
                        contentHTML += `<div class="attack-item">⊤ <span class="attack-arrow">⊢</span> ${attackingElement} <span style="color: var(--text-muted); font-size: 0.9em;">[${targetAssumption}]</span></div>`;
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
                const match = attack.match(/discarded_attack\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const [, attackingElement, targetAssumption, weight] = match;

                    // Find assumptions that support the attacking element (contrary)
                    const supportingAssumptions = this.findSupportingAssumptions(attackingElement, parsed);

                    // Format as "a1, a2, ..., an ⊬ c [target] (w: weight)"
                    if (supportingAssumptions.length > 0) {
                        const assumptions = supportingAssumptions.join(', ');
                        contentHTML += `<div class="attack-item discarded">${assumptions} <span class="attack-arrow">⊬</span> ${attackingElement} <span style="color: var(--text-muted); font-size: 0.9em;">[${targetAssumption}]</span> <span style="color: var(--text-muted)">(w: ${weight})</span></div>`;
                    } else {
                        // Non-derived attack (no supporting assumptions)
                        contentHTML += `<div class="attack-item discarded">⊤ <span class="attack-arrow">⊬</span> ${attackingElement} <span style="color: var(--text-muted); font-size: 0.9em;">[${targetAssumption}]</span> <span style="color: var(--text-muted)">(w: ${weight})</span></div>`;
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
                const weightDisplay = weight !== undefined ? ` <span style="color: var(--warning-color); font-size: 0.85em;">(w: ${weight})</span>` : '';
                const atomId = `derived-${answerNumber}-${atom.replace(/[^a-zA-Z0-9]/g, '_')}`;
                contentHTML += `<span class="chip" style="background: var(--info-color); border-color: var(--info-color); cursor: pointer;" id="${atomId}" data-atom="${atom}" data-extension="${answerNumber}">${atom}${weightDisplay}</span>`;
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
                contentHTML += `<span style="color: var(--warning-color)">${contrary}</span> `;
                contentHTML += `<span style="color: var(--text-muted)">attacks</span> `;
                contentHTML += `<span style="color: ${isDefeated ? 'var(--error-color)' : 'var(--success-color)'}">${assumption}</span>`;
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

        // Supported atoms (all of them, including assumptions)
        if (parsed.supported && parsed.supported.length > 0) {
            const supportedPredicates = parsed.supported.map(a => `supported(${a})`).join('. ') + '.';
            textualLines.push(supportedPredicates);
        }

        // Cost information
        if (parsed.cost !== null) {
            textualLines.push(`cost(${parsed.cost}).`);
        }

        // Join all lines with newlines
        const textualResult = textualLines.join('\n');
        contentHTML += `<pre class="textual-result-content">${textualResult}</pre>`;
        contentHTML += '</div></div>';

        contentHTML += '</div>';

        answerDiv.innerHTML = `
            <div class="answer-header clickable-extension" data-extension-id="${answerNumber}">
                <span class="answer-number">Extension ${answerNumber}</span>
                ${parsed.cost !== null ? `<span class="extension-cost-badge">💰 Cost: ${parsed.cost}</span>` : ''}
                <span class="click-hint" style="font-size: 0.85em; color: var(--text-muted); margin-left: 10px;">👆 Click to highlight</span>
            </div>
            ${contentHTML}
        `;

        // Store extension data for highlighting
        const extensionData = {
            inAssumptions: parsed.in,
            discardedAttacks: parsed.discarded.map(attack => {
                const match = attack.match(/discarded_attack\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const [, from, to, weight] = match;
                    // Map to the format needed for filtering
                    return {
                        source: from,
                        target: to,
                        via: to, // The attacked assumption
                        weight: weight
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
                document.querySelectorAll('.answer-header').forEach(h => {
                    h.classList.remove('active-extension');
                });
                onResetGraph();
                this.activeExtensionId = null;
            } else {
                // Turn on highlighting for this extension (turn off others)
                document.querySelectorAll('.answer-header').forEach(h => {
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

        // Attach event listeners to derived atom chips AFTER appending to DOM
        console.log('🔗 [appendAnswerSet] Checking for derived atoms...');
        console.log('Parsed derived atoms:', parsed.derived);
        if (parsed.derived && parsed.derived.length > 0) {
            console.log(`📌 [appendAnswerSet] Attaching click handlers to ${parsed.derived.length} derived atoms`);
            parsed.derived.forEach(atom => {
                const atomId = `derived-${answerNumber}-${atom.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const chipElement = answerDiv.querySelector(`#${atomId}`);
                console.log(`  Looking for element with ID: ${atomId}`, chipElement ? 'FOUND' : 'NOT FOUND');
                if (chipElement) {
                    chipElement.addEventListener('click', (e) => {
                        e.stopPropagation(); // Don't trigger extension highlight
                        console.log('✅ [Derived atom click] Atom clicked:', atom);
                        console.log('About to call showDerivationChain');
                        console.log('PopupManager available?', typeof PopupManager);
                        console.log('showDerivationChain exists?', typeof PopupManager.showDerivationChain);
                        try {
                            PopupManager.showDerivationChain(atom, parsed, chipElement);
                        } catch (error) {
                            console.error('❌ Error calling showDerivationChain:', error);
                            console.error('Error stack:', error.stack);
                        }
                    });
                    console.log(`  ✅ Click handler attached to ${atomId}`);
                } else {
                    console.error(`  ❌ Could not find element with ID ${atomId}`);
                }
            });
        } else {
            console.log('ℹ️ [appendAnswerSet] No derived atoms to attach handlers to');
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
        // If element is an assumption (in or out), return it
        if (parsed.assumptions.has(element)) {
            return [element];
        }

        // Find the rule that derives this element
        for (const [ruleId, rule] of parsed.rules.entries()) {
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

        // Not derived from any rule (fact with empty body)
        return [];
    }

    parseAnswerSet(predicates) {
        const result = {
            in: [],
            out: [],
            cost: null,
            discarded: [],
            successful: [],
            supported: [],
            assumptions: new Set(),
            contraries: new Map(),  // Map from assumption to contrary
            weights: new Map(),  // Map from atom to weight
            rules: new Map()  // Map from rule ID to {head, body[]}
        };

        // First pass: collect assumptions, contraries, and rules
        predicates.forEach(pred => {
            const assumptionMatch = pred.match(/^assumption\(([^)]+)\)$/);
            if (assumptionMatch) {
                result.assumptions.add(assumptionMatch[1]);
                return;
            }

            const contraryMatch = pred.match(/^contrary\(([^,]+),\s*([^)]+)\)$/);
            if (contraryMatch) {
                result.contraries.set(contraryMatch[1], contraryMatch[2]);
                return;
            }

            const headMatch = pred.match(/^head\(([^,]+),\s*([^)]+)\)$/);
            if (headMatch) {
                const ruleId = headMatch[1];
                const head = headMatch[2];
                if (!result.rules.has(ruleId)) {
                    result.rules.set(ruleId, { head, body: [] });
                } else {
                    result.rules.get(ruleId).head = head;
                }
                return;
            }

            const bodyMatch = pred.match(/^body\(([^,]+),\s*([^)]+)\)$/);
            if (bodyMatch) {
                const ruleId = bodyMatch[1];
                const bodyAtom = bodyMatch[2];
                if (!result.rules.has(ruleId)) {
                    result.rules.set(ruleId, { head: null, body: [bodyAtom] });
                } else {
                    result.rules.get(ruleId).body.push(bodyAtom);
                }
                return;
            }
        });

        // Second pass: collect everything else
        predicates.forEach(pred => {
            // Extract in() predicates
            const inMatch = pred.match(/^in\(([^)]+)\)$/);
            if (inMatch) {
                result.in.push(inMatch[1]);
                return;
            }

            // Extract out() predicates
            const outMatch = pred.match(/^out\(([^)]+)\)$/);
            if (outMatch) {
                result.out.push(outMatch[1]);
                return;
            }

            // Extract supported atoms (legacy - no longer in output)
            const supportedMatch = pred.match(/^supported\(([^)]+)\)$/);
            if (supportedMatch) {
                result.supported.push(supportedMatch[1]);
                return;
            }

            // Extract supported_with_weight predicates
            const weightMatch = pred.match(/^supported_with_weight\(([^,]+),\s*([^)]+)\)$/);
            if (weightMatch) {
                const atom = weightMatch[1];
                const weight = weightMatch[2];
                result.weights.set(atom, weight);
                // Also add to supported array since supported/1 is no longer in output
                if (!result.supported.includes(atom)) {
                    result.supported.push(atom);
                }
                return;
            }

            // Extract discarded attacks
            if (pred.startsWith('discarded_attack(')) {
                result.discarded.push(pred);
                return;
            }

            // Extract successful attacks
            if (pred.startsWith('attacks_successfully_with_weight(')) {
                result.successful.push(pred);
                return;
            }
        });

        // Compute derived atoms (supported but not assumptions)
        result.derived = result.supported.filter(atom => !result.assumptions.has(atom));

        // Compute active contraries (contrary atoms that are supported)
        result.activeContraries = [];
        result.contraries.forEach((contrary, assumption) => {
            if (result.supported.includes(contrary)) {
                result.activeContraries.push({ assumption, contrary });
            }
        });

        return result;
    }

    extractCost(witness) {
        // Try witness.Optimization field (weak constraint-based system)
        if (witness.Optimization !== undefined) {
            const opt = witness.Optimization;
            if (Array.isArray(opt)) {
                // MAX/MIN monoid: [0, 0, 80] → return 80 (last value)
                const lastValue = opt[opt.length - 1];
                if (lastValue === '#sup') return Infinity;
                if (lastValue === '#inf') return -Infinity;
                return parseFloat(lastValue) || 0;
            }
            // SUM/COUNT monoid: 210 → return 210
            if (opt === '#sup') return Infinity;
            if (opt === '#inf') return -Infinity;
            return parseFloat(opt) || 0;
        }
        return 0;
    }

    computeCostFromDiscarded(discardedAttacks) {
        // Manually compute cost from discarded attacks based on selected monoid
        if (discardedAttacks.length === 0) return 0;

        const monoid = this.monoidSelect.value;
        const weights = [];

        // Extract weights from discarded attacks
        discardedAttacks.forEach(attack => {
            const match = attack.match(/discarded_attack\([^,]+,\s*[^,]+,\s*([^)]+)\)/);
            if (match) {
                const weight = match[1];
                if (weight === '#sup') {
                    weights.push(Infinity);
                } else if (weight === '#inf') {
                    weights.push(-Infinity);
                } else {
                    weights.push(parseFloat(weight) || 0);
                }
            }
        });

        if (weights.length === 0) return 0;

        // Compute cost based on monoid
        switch (monoid) {
            case 'max':
            case 'max_minimization':
            case 'max_maximization':
                return Math.max(...weights);
            case 'sum':
            case 'sum_minimization':
            case 'sum_maximization':
                return weights.reduce((a, b) => a + b, 0);
            case 'min':
            case 'min_minimization':
            case 'min_maximization':
                return Math.min(...weights);
            case 'count':
            case 'count_minimization':
            case 'count_maximization':
                return weights.length;
            default:
                return 0;
        }
    }

    // ===================================
    // Logging
    // ===================================
    log(message, type = 'info') {
        const msgDiv = document.createElement('div');
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
        // Re-trigger the click on the previously active extension
        if (this.activeExtensionId !== null) {
            const header = this.output.querySelector(`.answer-header[data-extension-id="${this.activeExtensionId}"]`);
            if (header) {
                header.click();
            }
        }
    }

    clearActiveExtension() {
        // Clear the active extension and remove visual highlights
        this.activeExtensionId = null;
        document.querySelectorAll('.answer-header').forEach(h => {
            h.classList.remove('active-extension');
        });
    }

    clearOutput() {
        this.output.innerHTML = '';
        this.stats.innerHTML = '';
        // Show output empty state after clearing
        if (window.showOutputEmptyState) {
            window.showOutputEmptyState();
        }
        // Note: Don't clear isolatedNodes here - they're populated by updateGraph()
        // and needed for displayResults()
    }
}
