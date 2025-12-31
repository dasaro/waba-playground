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
        // Remove existing tooltips
        document.querySelectorAll('.derivation-tooltip').forEach(t => t.remove());

        const tooltip = document.createElement('div');
        tooltip.className = 'derivation-tooltip';

        // Find the rule that derives this atom
        let derivationHTML = `<strong>Derivation of ${atom}:</strong><br>`;
        let found = false;

        for (const [ruleId, rule] of parsed.rules.entries()) {
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
                break;
            }
        }

        if (!found) {
            derivationHTML += `<em>No derivation found (fact or assumption)</em>`;
        }

        tooltip.innerHTML = derivationHTML;
        document.body.appendChild(tooltip);

        // Position near the element
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;

        // Auto-remove on click outside
        setTimeout(() => {
            const removeTooltip = (e) => {
                if (!tooltip.contains(e.target) && e.target !== element) {
                    tooltip.remove();
                    document.removeEventListener('click', removeTooltip);
                }
            };
            document.addEventListener('click', removeTooltip);
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
     * Remove all popups/tooltips from the page
     */
    static clearAllPopups() {
        document.querySelectorAll('.derivation-tooltip, .graph-tooltip, .node-popup').forEach(p => p.remove());
    }
}
