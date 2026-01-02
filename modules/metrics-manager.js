/**
 * MetricsManager - Computes domain-independent entailment and recommendation metrics
 *
 * Provides:
 * - Global metrics: optCost, gap, epsilon, diversity
 * - Per-atom metrics: brave/cautious entailment, regret, penalty, possibilistic measures
 */

export class MetricsManager {
    /**
     * Compute all metrics from stored witnesses
     * @param {Array} witnesses - Array of {cost, parsed: {in, weights, contraries}}
     * @returns {Object} {global, atoms, hasSupport}
     */
    static computeMetrics(witnesses) {
        if (!witnesses || witnesses.length === 0) {
            return null;
        }

        // Extract and normalize data
        const models = witnesses.map(w => ({
            cost: w.cost || 0,
            inAtoms: new Set(w.parsed.in || []),
            support: w.parsed.weights || new Map(),
            contraries: w.parsed.contraries || new Map()
        }));

        // Compute global metrics
        const global = this.computeGlobalMetrics(models);

        // Get epsilon-bounded set S
        const S = models.filter(m => m.cost <= global.optCost + global.epsilon);

        // Collect all atoms (union of inAtoms and support keys)
        const allAtoms = this.collectAllAtoms(models);

        // Check if we have support data
        const hasSupport = models.some(m => m.support && m.support.size > 0);

        // Compute per-atom metrics
        const atoms = {};
        allAtoms.forEach(atom => {
            atoms[atom] = this.computeAtomMetrics(atom, models, S, global.optCost, hasSupport);
        });

        return { global, atoms, hasSupport };
    }

    /**
     * Compute global metrics
     */
    static computeGlobalMetrics(models) {
        // Sort models by cost
        const costs = models.map(m => m.cost).sort((a, b) => a - b);
        const uniqueCosts = [...new Set(costs)].sort((a, b) => a - b);

        const optCost = uniqueCosts[0];
        const secondBestCost = uniqueCosts.length > 1 ? uniqueCosts[1] : null;
        const gap = secondBestCost !== null ? secondBestCost - optCost : null;

        // Choose epsilon
        let epsilon;
        if (gap !== null && gap > 0) {
            epsilon = Math.min(5, gap);
        } else {
            epsilon = 5;
        }

        // Get epsilon-bounded set S
        const S = models.filter(m => m.cost <= optCost + epsilon);

        // Compute diversity (average pairwise Jaccard distance)
        const diversity = this.computeDiversity(S);

        return {
            optCost,
            secondBestCost,
            gap,
            epsilon,
            numInS: S.length,
            diversity,
            totalModels: models.length
        };
    }

    /**
     * Compute diversity as 1 - avg(Jaccard similarity)
     */
    static computeDiversity(S) {
        if (S.length <= 1) return 0;

        let totalDistance = 0;
        let pairs = 0;

        for (let i = 0; i < S.length; i++) {
            for (let j = i + 1; j < S.length; j++) {
                const A = S[i].inAtoms;
                const B = S[j].inAtoms;

                // Jaccard distance = 1 - |A ∩ B| / |A ∪ B|
                const intersection = new Set([...A].filter(x => B.has(x)));
                const union = new Set([...A, ...B]);

                if (union.size > 0) {
                    const jaccard = intersection.size / union.size;
                    totalDistance += (1 - jaccard);
                    pairs++;
                }
            }
        }

        return pairs > 0 ? totalDistance / pairs : 0;
    }

    /**
     * Collect all atoms from models (union of inAtoms and support keys)
     */
    static collectAllAtoms(models) {
        const atoms = new Set();

        models.forEach(m => {
            // Add from inAtoms
            m.inAtoms.forEach(a => atoms.add(a));

            // Add from support (if Map)
            if (m.support instanceof Map) {
                m.support.forEach((_, atom) => atoms.add(atom));
            }
        });

        return atoms;
    }

    /**
     * Compute per-atom metrics
     */
    static computeAtomMetrics(atom, models, S, optCost, hasSupport) {
        const metrics = {};

        // Boolean entailment (epsilon-bounded)
        metrics.brave_eps = S.some(m => m.inAtoms.has(atom));
        metrics.cautious_eps = S.every(m => m.inAtoms.has(atom));

        // Cost sensitivity
        const costsWithAtom = models
            .filter(m => m.inAtoms.has(atom))
            .map(m => m.cost);
        const costsWithoutAtom = models
            .filter(m => !m.inAtoms.has(atom))
            .map(m => m.cost);

        metrics.bestWith = costsWithAtom.length > 0 ? Math.min(...costsWithAtom) : Infinity;
        metrics.bestWithout = costsWithoutAtom.length > 0 ? Math.min(...costsWithoutAtom) : Infinity;

        metrics.regret = metrics.bestWith !== Infinity ? metrics.bestWith - optCost : null;
        metrics.penalty = (metrics.bestWith !== Infinity && metrics.bestWithout !== Infinity)
            ? metrics.bestWith - metrics.bestWithout
            : null;

        // Support-based metrics (if available)
        if (hasSupport) {
            const supportsInS = S.map(m => {
                if (m.support instanceof Map) {
                    return m.support.get(atom) || 0;
                }
                return 0;
            });

            metrics.Pi_eps = supportsInS.length > 0 ? Math.max(...supportsInS) : 0;
            metrics.N_eps = supportsInS.length > 0 ? Math.min(...supportsInS) : 0;

            // Net support (if contrary exists)
            const contraryAtom = this.findContrary(atom, models);
            if (contraryAtom) {
                const netSupports = S.map(m => {
                    const sp = (m.support instanceof Map ? m.support.get(atom) : null) || 0;
                    const sc = (m.support instanceof Map ? m.support.get(contraryAtom) : null) || 0;
                    return sp - sc;
                });
                metrics.net_eps = netSupports.length > 0
                    ? netSupports.reduce((a, b) => a + b, 0) / netSupports.length
                    : null;
                metrics.contrary = contraryAtom;
            } else {
                metrics.net_eps = null;
                metrics.contrary = null;
            }
        } else {
            metrics.Pi_eps = null;
            metrics.N_eps = null;
            metrics.net_eps = null;
            metrics.contrary = null;
        }

        return metrics;
    }

    /**
     * Find the contrary atom for a given atom
     */
    static findContrary(atom, models) {
        for (const m of models) {
            if (m.contraries instanceof Map) {
                const contrary = m.contraries.get(atom);
                if (contrary) return contrary;
            }
        }
        return null;
    }

    /**
     * Format metrics for display
     */
    static formatMetricsHTML(metricsData) {
        if (!metricsData) {
            return '<div class="info-message">No metrics available. Run WABA first.</div>';
        }

        const { global, atoms, hasSupport } = metricsData;

        let html = '<div class="metrics-container">';

        // Global metrics section
        html += '<div class="metrics-section">';
        html += '<h3 class="metrics-header">Global Metrics</h3>';
        html += '<div class="metrics-grid">';
        html += `<div class="metric-item"><span class="metric-label">Optimal Cost:</span> <span class="metric-value">${global.optCost.toFixed(2)}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Second-Best Cost:</span> <span class="metric-value">${global.secondBestCost !== null ? global.secondBestCost.toFixed(2) : 'N/A'}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Gap (Δ):</span> <span class="metric-value">${global.gap !== null ? global.gap.toFixed(2) : 'N/A'}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Epsilon (ε):</span> <span class="metric-value">${global.epsilon.toFixed(2)}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Models in S (≤ opt+ε):</span> <span class="metric-value">${global.numInS} / ${global.totalModels}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Diversity:</span> <span class="metric-value">${global.diversity.toFixed(3)}</span></div>`;
        html += '</div></div>';

        // Per-atom metrics table
        html += '<div class="metrics-section">';
        html += '<h3 class="metrics-header">Per-Atom Metrics</h3>';
        html += '<div class="metrics-table-container">';
        html += '<table class="metrics-table">';

        // Table header
        html += '<thead><tr>';
        html += '<th>Atom</th>';
        html += '<th title="Exists in at least one model in S">Brave (ε)</th>';
        html += '<th title="Exists in all models in S">Cautious (ε)</th>';
        html += '<th title="Best cost with atom - optimal cost">Regret</th>';
        html += '<th title="Best cost with atom - best cost without atom">Penalty</th>';

        if (hasSupport) {
            html += '<th title="Max support in S (possibilistic plausibility)">Π<sub>ε</sub></th>';
            html += '<th title="Min support in S (necessity)">N<sub>ε</sub></th>';
            html += '<th title="Avg(support(p) - support(contrary)) in S">Net<sub>ε</sub></th>';
            html += '<th>Contrary</th>';
        }

        html += '</tr></thead>';

        // Table body
        html += '<tbody>';

        // Sort atoms alphabetically
        const sortedAtoms = Object.keys(atoms).sort();

        sortedAtoms.forEach(atom => {
            const m = atoms[atom];

            html += '<tr>';
            html += `<td class="atom-name">${atom}</td>`;
            html += `<td class="metric-bool">${m.brave_eps ? '✓' : '✗'}</td>`;
            html += `<td class="metric-bool">${m.cautious_eps ? '✓' : '✗'}</td>`;
            html += `<td class="metric-num">${m.regret !== null ? m.regret.toFixed(2) : '∞'}</td>`;
            html += `<td class="metric-num">${m.penalty !== null ? m.penalty.toFixed(2) : 'N/A'}</td>`;

            if (hasSupport) {
                html += `<td class="metric-num">${m.Pi_eps !== null ? m.Pi_eps.toFixed(2) : 'N/A'}</td>`;
                html += `<td class="metric-num">${m.N_eps !== null ? m.N_eps.toFixed(2) : 'N/A'}</td>`;
                html += `<td class="metric-num">${m.net_eps !== null ? m.net_eps.toFixed(2) : 'N/A'}</td>`;
                html += `<td class="contrary-name">${m.contrary || '-'}</td>`;
            }

            html += '</tr>';
        });

        html += '</tbody>';
        html += '</table>';
        html += '</div></div>';

        html += '</div>';

        return html;
    }

    /**
     * Unit test with mocked dataset
     */
    static runUnitTest() {
        console.log('🧪 Running MetricsManager unit tests...');

        // Mock dataset
        const mockWitnesses = [
            {
                cost: 10,
                parsed: {
                    in: ['a', 'b'],
                    weights: new Map([['a', 100], ['b', 80], ['c', 0]]),
                    contraries: new Map([['a', 'c_a'], ['b', 'c_b']])
                }
            },
            {
                cost: 10,
                parsed: {
                    in: ['a', 'c'],
                    weights: new Map([['a', 100], ['c', 60]]),
                    contraries: new Map([['a', 'c_a'], ['c', 'c_c']])
                }
            },
            {
                cost: 15,
                parsed: {
                    in: ['b', 'd'],
                    weights: new Map([['b', 90], ['d', 50]]),
                    contraries: new Map([['b', 'c_b'], ['d', 'c_d']])
                }
            }
        ];

        const metrics = MetricsManager.computeMetrics(mockWitnesses);

        // Test global metrics
        console.assert(metrics.global.optCost === 10, '❌ optCost should be 10');
        console.assert(metrics.global.secondBestCost === 15, '❌ secondBestCost should be 15');
        console.assert(metrics.global.gap === 5, '❌ gap should be 5');
        console.assert(metrics.global.epsilon === 5, '❌ epsilon should be 5');
        console.assert(metrics.global.numInS === 3, '❌ numInS should be 3');

        // Test per-atom metrics
        console.assert(metrics.atoms['a'].brave_eps === true, '❌ a should be brave');
        console.assert(metrics.atoms['a'].cautious_eps === false, '❌ a should not be cautious');
        console.assert(metrics.atoms['a'].regret === 0, '❌ a regret should be 0');

        console.assert(metrics.atoms['d'].brave_eps === true, '❌ d should be brave');
        console.assert(metrics.atoms['d'].regret === 5, '❌ d regret should be 5');

        // Test support metrics
        console.assert(metrics.atoms['a'].Pi_eps === 100, '❌ a Pi_eps should be 100');
        console.assert(metrics.atoms['a'].N_eps === 100, '❌ a N_eps should be 100');

        console.log('✅ All unit tests passed!');
    }
}
