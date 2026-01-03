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
        tooltip.className = 'derivation-tooltip node-popup graph-tooltip';

        // Build content with badges and chips
        let content = '<div class="popup-content">';

        // Header
        content += `<div class="popup-header">
            <span class="node-type-badge">🔗 Derivation</span>
            <strong>${atom}</strong>
        </div>`;

        // Find the rule that derives this atom
        let found = false;

        console.log('Searching through rules:', parsed.rules);
        for (const [ruleId, rule] of parsed.rules.entries()) {
            console.log(`  Checking rule ${ruleId}:`, rule);
            if (rule.head === atom) {
                found = true;

                // Rule section
                content += '<div class="popup-section">';
                content += '<div class="popup-label">📜 Rule:</div>';
                content += '<div class="derivation-rule">';
                content += `<span class="element-chip target">${atom}</span>`;
                content += '<span class="arrow">←</span>';

                if (rule.body.length > 0) {
                    content += '<div class="popup-chips">';
                    rule.body.forEach(bodyAtom => {
                        content += `<span class="assumption-chip">${bodyAtom}</span>`;
                    });
                    content += '</div>';
                } else {
                    content += '<span class="element-chip source">⊤</span>';
                }
                content += '</div></div>';

                // Weights section
                const bodyWithWeights = rule.body.filter(bodyAtom => {
                    const weight = parsed.weights.get(bodyAtom);
                    return weight !== undefined;
                });

                if (bodyWithWeights.length > 0) {
                    content += '<div class="popup-section">';
                    content += '<div class="popup-label">⚖️ Weights:</div>';
                    content += '<div class="weight-list">';
                    bodyWithWeights.forEach(bodyAtom => {
                        const weight = parsed.weights.get(bodyAtom);
                        content += `<div class="weight-item">
                            <span class="assumption-chip">${bodyAtom}</span>
                            <span class="weight-badge">${weight}</span>
                        </div>`;
                    });
                    content += '</div></div>';
                }

                console.log('✅ Found derivation rule:', ruleId);
                break;
            }
        }

        if (!found) {
            content += '<div class="popup-section">';
            content += '<div class="popup-info">ℹ️ No derivation found (fact or assumption)</div>';
            content += '</div>';
            console.warn('⚠️ No derivation rule found for atom:', atom);
        }

        content += '</div>';
        tooltip.innerHTML = content;
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

        // Build content with badges and special characters
        let content = '<div class="popup-content">';

        // Header with node type badge
        const nodeType = node.isAssumption ? '🔷 Assumption' :
                        node.isJunction ? '⋈ Junction' :
                        node.isTop ? '⊤ Top' : '⚪ Node';
        content += `<div class="popup-header">
            <span class="node-type-badge">${nodeType}</span>
            <strong>${node.label || node.id}</strong>
        </div>`;

        // Assumptions list with chips
        if (node.assumptions && node.assumptions.length > 0) {
            content += '<div class="popup-section">';
            content += '<div class="popup-label">📋 Contains:</div>';
            content += '<div class="popup-chips">';
            node.assumptions.forEach(a => {
                content += `<span class="assumption-chip">${a}</span>`;
            });
            content += '</div></div>';
        }

        // Status badges
        if (node.isIn !== undefined || node.isSupported !== undefined) {
            content += '<div class="popup-section">';
            content += '<div class="popup-label">Status:</div>';
            content += '<div class="status-badges">';
            if (node.isIn === true) {
                content += '<span class="status-badge in">✓ In</span>';
            } else if (node.isIn === false) {
                content += '<span class="status-badge out">✗ Out</span>';
            }
            if (node.isSupported) {
                content += '<span class="status-badge supported">⬆ Supported</span>';
            }
            content += '</div></div>';
        }

        // Additional info
        if (node.title && !node.isJunction) {
            content += `<div class="popup-section"><div class="popup-info">ℹ️ ${node.title}</div></div>`;
        }

        content += '</div>';
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

        // Build content with badges and special characters
        let content = '<div class="popup-content">';

        // Header with attack type badge
        const attackType = edge.attackType === 'direct' ? '⚡ Direct' :
                          edge.attackType === 'derived' ? '🔗 Derived' :
                          edge.attackType === 'joint' ? '🤝 Joint' :
                          edge.attackType === 'fact' ? '📌 Fact-based' :
                          '⚔️ Attack';
        content += `<div class="popup-header">
            <span class="attack-type-badge">${attackType}</span>
            <strong>Attack Details</strong>
        </div>`;

        // Weight badge
        let displayWeight = 'N/A';
        if (edge.weight !== undefined) {
            if (edge.weight === Infinity || edge.weight === '#sup') {
                displayWeight = '#sup';
            } else if (edge.weight === -Infinity || edge.weight === '#inf') {
                displayWeight = '#inf';
            } else {
                displayWeight = edge.weight;
            }
        } else if (edge.label) {
            displayWeight = edge.label;
        }

        content += '<div class="popup-section">';
        content += '<div class="popup-label">⚖️ Weight:</div>';
        content += `<span class="weight-badge">${displayWeight}</span>`;
        content += '</div>';

        // Attack relationship
        content += '<div class="popup-section">';
        content += '<div class="popup-label">🎯 Attack:</div>';
        if (edge.attackingElement && edge.attackedAssumption) {
            content += `<div class="attack-relationship">
                <span class="element-chip source">${edge.attackingElement}</span>
                <span class="arrow">→</span>
                <span class="element-chip target">${edge.attackedAssumption}</span>
            </div>`;
        } else if (edge.contrary && edge.targetAssumption) {
            content += `<div class="attack-relationship">
                <span class="element-chip source">${edge.contrary}</span>
                <span class="arrow">→</span>
                <span class="element-chip target">${edge.targetAssumption}</span>
            </div>`;
        } else if (edge.from && edge.to) {
            content += `<div class="attack-relationship">
                <span class="element-chip source">${edge.from}</span>
                <span class="arrow">→</span>
                <span class="element-chip target">${edge.to}</span>
            </div>`;
        }
        content += '</div>';

        // Joint attack participants
        if (edge.jointWith && edge.jointWith.length > 1) {
            content += '<div class="popup-section">';
            content += '<div class="popup-label">🤝 Joint with:</div>';
            content += '<div class="popup-chips">';
            edge.jointWith.filter(a => a !== edge.attackingElement).forEach(a => {
                content += `<span class="participant-chip">${a}</span>`;
            });
            content += '</div></div>';
        }

        // Additional info
        if (edge.title) {
            content += `<div class="popup-section"><div class="popup-info">ℹ️ ${edge.title}</div></div>`;
        }

        content += '</div>';
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
