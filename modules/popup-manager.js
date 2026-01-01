/**
 * PopupManager - Handles popup displays for nodes, edges, and derivation chains
 */
export class PopupManager {
    /**
     * Show derivation chain popup for a derived atom
     * @param {string} atom - The derived atom
     * @param {Object} parsed - Parsed answer set data
     * @param {HTMLElement} element - The element that triggered the popup
     */
    static showDerivationChain(atom, parsed, element) {
        console.log('📖 [showDerivationChain] CALLED');
        console.log('Atom:', atom);
        console.log('Element:', element);
        console.log('Parsed data:', parsed);

        // Remove existing tooltips
        document.querySelectorAll('.derivation-tooltip').forEach(t => t.remove());

        const tooltip = document.createElement('div');
        tooltip.className = 'derivation-tooltip';

        // Find the rule that derives this atom
        let derivationHTML = `<strong>Derivation of ${atom}:</strong><br>`;
        let found = false;

        console.log('Searching through rules:', parsed.rules);
        for (const [ruleId, rule] of parsed.rules.entries()) {
            console.log(`  Checking rule ${ruleId}:`, rule);
            if (rule.head === atom) {
                found = true;
                const bodyStr = rule.body.length > 0 ? rule.body.join(', ') : '⊤';
                derivationHTML += `${atom} ← ${bodyStr}<br>`;

                // Show weights if available
                rule.body.forEach(bodyAtom => {
                    const weight = parsed.weights.get(bodyAtom);
                    if (weight !== undefined) {
                        derivationHTML += `&nbsp;&nbsp;• ${bodyAtom}: ${weight}<br>`;
                    }
                });
                console.log('✅ Found derivation rule:', ruleId);
                break;
            }
        }

        if (!found) {
            derivationHTML += `<em>No derivation found (fact or assumption)</em>`;
            console.warn('⚠️ No derivation rule found for atom:', atom);
        }

        tooltip.innerHTML = derivationHTML;
        document.body.appendChild(tooltip);
        console.log('✅ Tooltip appended to body');

        // Position near the element
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;
        console.log('📍 Tooltip positioned at:', { left: rect.left, top: rect.bottom + 5 });

        // Auto-remove on click outside
        setTimeout(() => {
            const removeTooltip = (e) => {
                if (!tooltip.contains(e.target) && e.target !== element) {
                    tooltip.remove();
                    document.removeEventListener('click', removeTooltip);
                    console.log('🗑️ Tooltip removed');
                }
            };
            document.addEventListener('click', removeTooltip);
            console.log('✅ Click-outside handler attached');
        }, 100);
    }

    /**
     * Show attack tooltip with derivation information
     * @param {Object} edge - Edge data from vis.js
     * @param {string} frameworkCode - The framework code
     * @returns {string} - Tooltip HTML content
     */
    static createAttackDerivationTooltip(edge, frameworkCode) {
        const attackingElement = edge.attackingElement;
        const attackedAssumption = edge.attackedAssumption;
        const derivedBy = edge.derivedBy || [];

        let content = `<strong>Attack:</strong> ${attackingElement} → ${attackedAssumption}<br>`;

        if (derivedBy.length > 0) {
            content += `<strong>Derived by rules:</strong> ${derivedBy.join(', ')}<br>`;
        }

        return content;
    }

    /**
     * Position a popup element near a coordinate
     * @param {HTMLElement} popup - The popup element
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    static positionPopup(popup, x, y) {
        // Ensure popup doesn't go off-screen
        const rect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = x;
        let top = y;

        // Adjust horizontal position
        if (left + rect.width > viewportWidth) {
            left = viewportWidth - rect.width - 10;
        }
        if (left < 0) {
            left = 10;
        }

        // Adjust vertical position
        if (top + rect.height > viewportHeight) {
            top = viewportHeight - rect.height - 10;
        }
        if (top < 0) {
            top = 10;
        }

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    /**
     * Show node popup with details
     * @param {Object} node - Node data from vis.js
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} data - Additional data (frameworkCode, graphMode)
     */
    static showNodePopup(node, x, y, data) {
        // Remove existing popups
        PopupManager.clearAllPopups();

        const popup = document.createElement('div');
        popup.className = 'node-popup graph-tooltip';

        let content = `<strong>Node: ${node.label || node.id}</strong><br>`;

        // Add node-specific information
        if (node.title) {
            content += `${node.title}<br>`;
        }

        if (node.assumptions && node.assumptions.length > 0) {
            content += `<strong>Assumptions:</strong> ${node.assumptions.join(', ')}<br>`;
        }

        if (node.size !== undefined) {
            content += `<strong>Size:</strong> ${node.size}<br>`;
        }

        popup.innerHTML = content;
        document.body.appendChild(popup);

        // Position the popup
        PopupManager.positionPopup(popup, x + 10, y + 10);

        // Auto-remove on click outside
        setTimeout(() => {
            const removePopup = (e) => {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', removePopup);
                }
            };
            document.addEventListener('click', removePopup);
        }, 100);
    }

    /**
     * Show edge/weight popup with details (legacy method)
     * @param {number|string} weight - Edge weight
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    static showWeightPopup(weight, x, y) {
        // Remove existing popups
        PopupManager.clearAllPopups();

        const popup = document.createElement('div');
        popup.className = 'node-popup graph-tooltip';

        let displayWeight = weight;
        if (weight === Infinity || weight === '#sup') {
            displayWeight = '#sup (supremum)';
        } else if (weight === -Infinity || weight === '#inf') {
            displayWeight = '#inf (infimum)';
        }

        popup.innerHTML = `<strong>Attack Weight:</strong> ${displayWeight}`;
        document.body.appendChild(popup);

        // Position the popup
        PopupManager.positionPopup(popup, x + 10, y + 10);

        // Auto-remove on click outside
        setTimeout(() => {
            const removePopup = (e) => {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', removePopup);
                }
            };
            document.addEventListener('click', removePopup);
        }, 100);
    }

    /**
     * Show edge popup with comprehensive attack information
     * @param {Object} edge - Edge data from vis.js
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    static showEdgePopup(edge, x, y) {
        // Remove existing popups
        PopupManager.clearAllPopups();

        const popup = document.createElement('div');
        popup.className = 'node-popup graph-tooltip';

        let content = '<strong>Attack Details</strong><br>';

        // Extract weight information
        let displayWeight = 'N/A';
        if (edge.weight !== undefined) {
            if (edge.weight === Infinity || edge.weight === '#sup') {
                displayWeight = '#sup (supremum)';
            } else if (edge.weight === -Infinity || edge.weight === '#inf') {
                displayWeight = '#inf (infimum)';
            } else {
                displayWeight = edge.weight;
            }
        } else if (edge.label) {
            // Try to extract weight from label
            displayWeight = edge.label;
        }

        content += `<strong>Weight:</strong> ${displayWeight}<br>`;

        // Show attack relationship
        if (edge.attackingElement && edge.attackedAssumption) {
            content += `<strong>Attack:</strong> ${edge.attackingElement} → ${edge.attackedAssumption}<br>`;
        } else if (edge.contrary && edge.targetAssumption) {
            content += `<strong>Attack:</strong> ${edge.contrary} → ${edge.targetAssumption}<br>`;
        } else if (edge.from && edge.to) {
            content += `<strong>From:</strong> ${edge.from}<br>`;
            content += `<strong>To:</strong> ${edge.to}<br>`;
        }

        // Show derivation info if available
        if (edge.derivedBy && edge.derivedBy.length > 0) {
            content += `<strong>Derived by:</strong> ${edge.derivedBy.join(', ')}<br>`;
        }

        // Show edge type if available
        if (edge.title) {
            content += `<em>${edge.title}</em><br>`;
        }

        popup.innerHTML = content;
        document.body.appendChild(popup);

        // Position the popup
        PopupManager.positionPopup(popup, x + 10, y + 10);

        // Auto-remove on click outside
        setTimeout(() => {
            const removePopup = (e) => {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', removePopup);
                }
            };
            document.addEventListener('click', removePopup);
        }, 100);
    }

    /**
     * Remove all popups/tooltips from the page
     */
    static clearAllPopups() {
        document.querySelectorAll('.derivation-tooltip, .graph-tooltip, .node-popup').forEach(p => p.remove());
    }
}
