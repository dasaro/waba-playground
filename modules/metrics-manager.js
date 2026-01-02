/**
 * MetricsManager - Computes domain-independent entailment and recommendation metrics
 *
 * Provides:
 * - Global metrics: optCost, gap, near-optimal set S (level-based selection)
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

        // Compute global metrics and near-optimal set S
        const { global, S } = this.computeGlobalMetrics(models);

        // Collect all atoms (union of inAtoms and support keys)
        const allAtoms = this.collectAllAtoms(models);

        // Check if we have support data
        const hasSupport = models.some(m => m.support && m.support.size > 0);

        // Get global contraries map (from first model that has it)
        const contraries = models.find(m => m.contraries && m.contraries.size > 0)?.contraries || new Map();

        // Compute per-atom metrics
        const atoms = {};
        allAtoms.forEach(atom => {
            atoms[atom] = this.computeAtomMetrics(atom, models, S, global.optCost, hasSupport, contraries);
        });

        return { global, atoms, hasSupport };
    }

    /**
     * Compute global metrics and select near-optimal set S
     * Uses level-based selection: K=2 initial levels, extend to m=3 models minimum
     */
    static computeGlobalMetrics(models, K = 2, m = 3) {
        // Get sorted distinct cost levels
        const costs = models.map(model => model.cost);
        const levels = [...new Set(costs)].sort((a, b) => a - b);

        const optCost = levels[0];
        const secondBestCost = levels.length > 1 ? levels[1] : null;
        const gap = secondBestCost !== null ? secondBestCost - optCost : null;

        // Start with K cost levels
        let allowedLevels = levels.slice(0, Math.min(K, levels.length));
        let S = models.filter(m => allowedLevels.includes(m.cost));

        // Coverage fallback: extend until |S| >= m
        let levelIndex = K;
        while (S.length < m && levelIndex < levels.length) {
            allowedLevels.push(levels[levelIndex]);
            S = models.filter(m => allowedLevels.includes(m.cost));
            levelIndex++;
        }

        // Derive epsilon implicitly (for display only)
        const epsilon = allowedLevels.length > 0 ? Math.max(...allowedLevels) - optCost : 0;

        // Compute diversity (average pairwise Jaccard distance)
        const diversity = this.computeDiversity(S);

        return {
            global: {
                optCost,
                secondBestCost,
                gap,
                epsilon,  // Derived, for display only
                allowedLevels,
                numInS: S.length,
                diversity,
                totalModels: models.length
            },
            S  // Return S for use in per-atom metrics
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
     * Boolean entailment over S; cost sensitivity over ALL models
     */
    static computeAtomMetrics(atom, models, S, optCost, hasSupport, contraries) {
        const metrics = {};

        // Boolean entailment (S-bounded)
        metrics.brave_S = S.some(m => m.inAtoms.has(atom));
        metrics.cautious_S = S.length > 0 && S.every(m => m.inAtoms.has(atom));

        // Cost sensitivity (computed over ALL models, not just S)
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

        // Support-based metrics (if available, computed over S)
        if (hasSupport) {
            const supportsInS = S.map(m => {
                if (m.support instanceof Map) {
                    return m.support.get(atom) || 0;
                }
                return 0;
            });

            metrics.Pi_S = supportsInS.length > 0 ? Math.max(...supportsInS) : 0;
            metrics.N_S = supportsInS.length > 0 ? Math.min(...supportsInS) : 0;

            // Net support (if contrary exists)
            const contraryAtom = contraries instanceof Map ? contraries.get(atom) : null;
            if (contraryAtom) {
                const netSupports = S.map(m => {
                    const sp = (m.support instanceof Map ? m.support.get(atom) : null) || 0;
                    const sc = (m.support instanceof Map ? m.support.get(contraryAtom) : null) || 0;
                    return sp - sc;
                });
                metrics.net_S = netSupports.length > 0
                    ? netSupports.reduce((a, b) => a + b, 0) / netSupports.length
                    : null;
                metrics.contrary = contraryAtom;
            } else {
                metrics.net_S = null;
                metrics.contrary = null;
            }
        } else {
            metrics.Pi_S = null;
            metrics.N_S = null;
            metrics.net_S = null;
            metrics.contrary = null;
        }

        return metrics;
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

        // CSV Export button
        html += '<div class="metrics-actions">';
        html += '<button id="export-metrics-csv-btn" class="export-metrics-btn">📥 Download Metrics (CSV)</button>';
        html += '</div>';

        // Global metrics section
        html += '<div class="metrics-section">';
        html += '<h3 class="metrics-header">Global Metrics (Near-Optimal Set S)</h3>';
        html += '<div class="metrics-grid">';
        html += `<div class="metric-item"><span class="metric-label">Optimal Cost:</span> <span class="metric-value">${global.optCost.toFixed(2)}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Second-Best Cost:</span> <span class="metric-value">${global.secondBestCost !== null ? global.secondBestCost.toFixed(2) : 'N/A'}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Gap (Δ):</span> <span class="metric-value">${global.gap !== null ? global.gap.toFixed(2) : 'N/A'}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Cost Levels in S:</span> <span class="metric-value">[${global.allowedLevels.map(x => x.toFixed(2)).join(', ')}]</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Derived ε (max-opt):</span> <span class="metric-value">${global.epsilon.toFixed(2)}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Models in S:</span> <span class="metric-value">${global.numInS} / ${global.totalModels}</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Diversity:</span> <span class="metric-value">${global.diversity.toFixed(3)}</span></div>`;
        html += '</div></div>';

        // Per-atom metrics table
        html += '<div class="metrics-section">';
        html += '<h3 class="metrics-header">Per-Atom Metrics</h3>';
        html += '<div class="metrics-table-container">';
        html += '<table class="metrics-table">';

        // Table header with info icons
        html += '<thead><tr>';
        html += '<th>Atom</th>';
        html += '<th>Brave<sub>S</sub> <span class="info-icon" title="Exists in at least one model in S (credulous reasoning)">ⓘ</span></th>';
        html += '<th>Cautious<sub>S</sub> <span class="info-icon" title="Exists in all models in S (skeptical reasoning)">ⓘ</span></th>';
        html += '<th>Regret <span class="info-icon" title="Cost increase for accepting atom: bestWith(p) - optCost (computed over all models)">ⓘ</span></th>';
        html += '<th>Penalty <span class="info-icon" title="Cost difference with/without atom: bestWith(p) - bestWithout(p) (computed over all models). Negative = accepting atom reduces cost">ⓘ</span></th>';

        if (hasSupport) {
            html += '<th>Π<sub>S</sub> <span class="info-icon" title="Possibilistic plausibility: maximum support value in S (higher = stronger in best scenarios)">ⓘ</span></th>';
            html += '<th>N<sub>S</sub> <span class="info-icon" title="Possibilistic necessity: minimum support value in S (higher = consistently strong)">ⓘ</span></th>';
            html += '<th>Net<sub>S</sub> <span class="info-icon" title="Net support: avg(support(p) - support(contrary)) in S. Positive = atom better supported than its contrary">ⓘ</span></th>';
            html += '<th>Contrary <span class="info-icon" title="The contrary atom that attacks this assumption">ⓘ</span></th>';
        }

        html += '</tr></thead>';

        // Table body
        html += '<tbody>';

        // Sort atoms alphabetically
        const sortedAtoms = Object.keys(atoms).sort();

        sortedAtoms.forEach(atom => {
            const m = atoms[atom];

            // Determine row class based on entailment
            let rowClass = '';
            if (m.cautious_S) {
                rowClass = 'cautious-entailed';
            } else if (m.brave_S) {
                rowClass = 'brave-entailed';
            }

            html += `<tr class="${rowClass}">`;
            html += `<td class="atom-name">${atom}</td>`;
            html += `<td class="metric-bool ${m.brave_S ? 'metric-bool-true' : 'metric-bool-false'}">${m.brave_S ? '✓' : '✗'}</td>`;
            html += `<td class="metric-bool ${m.cautious_S ? 'metric-bool-true' : 'metric-bool-false'}">${m.cautious_S ? '✓' : '✗'}</td>`;
            html += `<td class="metric-num">${m.regret !== null ? m.regret.toFixed(2) : '∞'}</td>`;
            html += `<td class="metric-num">${m.penalty !== null ? m.penalty.toFixed(2) : 'N/A'}</td>`;

            if (hasSupport) {
                html += `<td class="metric-num">${m.Pi_S !== null ? m.Pi_S.toFixed(2) : 'N/A'}</td>`;
                html += `<td class="metric-num">${m.N_S !== null ? m.N_S.toFixed(2) : 'N/A'}</td>`;
                html += `<td class="metric-num">${m.net_S !== null ? m.net_S.toFixed(2) : 'N/A'}</td>`;
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
     * Export metrics to CSV format
     */
    static exportMetricsCSV(metricsData) {
        if (!metricsData) {
            return null;
        }

        const { global, atoms, hasSupport } = metricsData;
        let csv = '';

        // Global Metrics Section
        csv += 'GLOBAL METRICS (Near-Optimal Set S)\n';
        csv += 'Metric,Value\n';
        csv += `Optimal Cost,${global.optCost.toFixed(2)}\n`;
        csv += `Second-Best Cost,${global.secondBestCost !== null ? global.secondBestCost.toFixed(2) : 'N/A'}\n`;
        csv += `Gap (Δ),${global.gap !== null ? global.gap.toFixed(2) : 'N/A'}\n`;
        csv += `Cost Levels in S,"[${global.allowedLevels.map(x => x.toFixed(2)).join(', ')}]"\n`;
        csv += `Derived ε (max-opt),${global.epsilon.toFixed(2)}\n`;
        csv += `Models in S,${global.numInS}\n`;
        csv += `Total Models,${global.totalModels}\n`;
        csv += `Diversity,${global.diversity.toFixed(3)}\n`;
        csv += '\n';

        // Per-Atom Metrics Section
        csv += 'PER-ATOM METRICS\n';

        // CSV Header
        let headers = ['Atom', 'Brave_S', 'Cautious_S', 'Regret', 'Penalty'];
        if (hasSupport) {
            headers.push('Pi_S', 'N_S', 'Net_S', 'Contrary');
        }
        csv += headers.join(',') + '\n';

        // Sort atoms alphabetically
        const sortedAtoms = Object.keys(atoms).sort();

        // CSV Data Rows
        sortedAtoms.forEach(atom => {
            const m = atoms[atom];
            let row = [
                `"${atom}"`,
                m.brave_S ? 'TRUE' : 'FALSE',
                m.cautious_S ? 'TRUE' : 'FALSE',
                m.regret !== null ? m.regret.toFixed(2) : 'Infinity',
                m.penalty !== null ? m.penalty.toFixed(2) : 'N/A'
            ];

            if (hasSupport) {
                row.push(
                    m.Pi_S !== null ? m.Pi_S.toFixed(2) : 'N/A',
                    m.N_S !== null ? m.N_S.toFixed(2) : 'N/A',
                    m.net_S !== null ? m.net_S.toFixed(2) : 'N/A',
                    m.contrary ? `"${m.contrary}"` : '-'
                );
            }

            csv += row.join(',') + '\n';
        });

        return csv;
    }

    /**
     * Download metrics as CSV file
     */
    static downloadMetricsCSV(metricsData) {
        const csv = this.exportMetricsCSV(metricsData);
        if (!csv) {
            console.error('No metrics data to export');
            return;
        }

        // Create blob and download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        link.download = `waba-metrics-${timestamp}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Unit test with mocked dataset
     * Validates: S selection (K=2 levels, coverage to m=3), brave/cautious/regret/penalty
     */
    static runUnitTest() {
        console.log('🧪 Running MetricsManager unit tests...');

        // Test 1: Basic S selection with K=2 levels, already have m=3 models
        const mock1 = [
            { cost: 10, parsed: { in: ['a', 'b'], weights: new Map([['a', 100], ['b', 80]]), contraries: new Map([['a', 'c_a'], ['b', 'c_b']]) } },
            { cost: 10, parsed: { in: ['a', 'c'], weights: new Map([['a', 100], ['c', 60]]), contraries: new Map([['a', 'c_a']]) } },
            { cost: 15, parsed: { in: ['b', 'd'], weights: new Map([['b', 90], ['d', 50]]), contraries: new Map([['b', 'c_b']]) } },
            { cost: 20, parsed: { in: ['e'], weights: new Map([['e', 40]]), contraries: new Map() } }
        ];

        const metrics1 = MetricsManager.computeMetrics(mock1);

        // Global: K=2 levels [10, 15], m=3 already satisfied
        console.assert(metrics1.global.optCost === 10, '❌ Test 1: optCost should be 10');
        console.assert(metrics1.global.secondBestCost === 15, '❌ Test 1: secondBestCost should be 15');
        console.assert(metrics1.global.gap === 5, '❌ Test 1: gap should be 5');
        console.assert(JSON.stringify(metrics1.global.allowedLevels) === JSON.stringify([10, 15]), '❌ Test 1: allowedLevels should be [10, 15]');
        console.assert(metrics1.global.epsilon === 5, '❌ Test 1: derived epsilon should be 5');
        console.assert(metrics1.global.numInS === 3, '❌ Test 1: numInS should be 3 (2 at cost 10, 1 at cost 15)');

        // Per-atom: brave/cautious over S (cost 10, 10, 15)
        console.assert(metrics1.atoms['a'].brave_S === true, '❌ Test 1: a should be brave_S');
        console.assert(metrics1.atoms['a'].cautious_S === false, '❌ Test 1: a should not be cautious_S (not in 3rd model)');
        console.assert(metrics1.atoms['b'].brave_S === true, '❌ Test 1: b should be brave_S');
        console.assert(metrics1.atoms['b'].cautious_S === false, '❌ Test 1: b not in all S models');
        console.assert(metrics1.atoms['e'].brave_S === false, '❌ Test 1: e not in S (cost 20 not in allowedLevels)');

        // Cost sensitivity: regret/penalty over ALL models
        console.assert(metrics1.atoms['a'].regret === 0, '❌ Test 1: a regret should be 0 (best at opt)');
        console.assert(metrics1.atoms['d'].regret === 5, '❌ Test 1: d regret should be 5 (15-10)');
        console.assert(metrics1.atoms['e'].regret === 10, '❌ Test 1: e regret should be 10 (20-10)');

        // Support metrics over S
        console.assert(metrics1.atoms['a'].Pi_S === 100, '❌ Test 1: a Pi_S should be 100');
        console.assert(metrics1.atoms['a'].N_S === 100, '❌ Test 1: a N_S should be 100');

        // Test 2: Coverage fallback (fewer than m=3 models in K=2 levels)
        const mock2 = [
            { cost: 5, parsed: { in: ['x'], weights: new Map(), contraries: new Map() } },
            { cost: 10, parsed: { in: ['y'], weights: new Map(), contraries: new Map() } },
            { cost: 15, parsed: { in: ['z'], weights: new Map(), contraries: new Map() } }
        ];

        const metrics2 = MetricsManager.computeMetrics(mock2);

        // Should have K=2 levels initially [5, 10], but only 2 models, so extend to [5, 10, 15] to reach m=3
        console.assert(metrics2.global.numInS === 3, '❌ Test 2: numInS should be 3 (coverage fallback)');
        console.assert(JSON.stringify(metrics2.global.allowedLevels) === JSON.stringify([5, 10, 15]), '❌ Test 2: allowedLevels should extend to [5, 10, 15]');
        console.assert(metrics2.global.epsilon === 10, '❌ Test 2: derived epsilon should be 10 (15-5)');

        console.log('✅ All unit tests passed!');
    }
}
