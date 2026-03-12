/**
 * MetricsManager - Decision-oriented analysis for ranked WABA extensions.
 *
 * The primary recommendation score is a normalized Borda-style aggregation over
 * unique extension ranks: better-ranked extensions contribute more score to the
 * assumptions they contain.
 */

const POS_INF = '#sup';
const NEG_INF = '#inf';

export class MetricsManager {
    static getAnalysisContext(config = {}) {
        const optimization = config.optimization || 'minimize';
        const supportHigherBetter = config.polarity === 'higher' || config.polarity === 'strength';
        const budgetThresholdMode = config.budgetMode === 'none' && config.budgetIntent === 'explore';

        return {
            optimization,
            objectiveHigherBetter: optimization === 'maximize',
            supportHigherBetter,
            budgetThresholdMode,
            scoreLabel: budgetThresholdMode ? 'Minimum β' : 'Objective score',
            bestLabel: budgetThresholdMode ? 'Best threshold' : 'Best objective',
            gapLabel: budgetThresholdMode ? 'Threshold gap' : 'Objective gap',
            summaryText: budgetThresholdMode
                ? 'Extensions are first grouped by accepted assumptions, then ranked by their minimum observed β*.'
                : 'Extensions are first grouped by accepted assumptions, then ranked by the active objective.'
        };
    }

    static computeMetrics(entries, config = {}) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return null;
        }

        const context = this.getAnalysisContext(config);
        const extensions = this.buildUniqueExtensions(entries);
        if (extensions.length === 0) {
            return null;
        }

        extensions.sort((left, right) => {
            const tupleComparison = this.compareTuples(left.objectiveTuple, right.objectiveTuple);
            if (tupleComparison !== 0) {
                return tupleComparison;
            }
            return left.label.localeCompare(right.label);
        });

        const levelKeys = [];
        const levelMap = new Map();
        extensions.forEach((extension) => {
            const levelKey = JSON.stringify(extension.objectiveTuple);
            if (!levelMap.has(levelKey)) {
                levelMap.set(levelKey, levelKeys.length);
                levelKeys.push(levelKey);
            }
            extension.levelIndex = levelMap.get(levelKey);
        });

        const totalLevels = levelKeys.length;
        extensions.forEach((extension) => {
            extension.levelNumber = extension.levelIndex + 1;
            extension.bordaPoints = this.getLevelPoints(extension.levelIndex, totalLevels);
        });

        const totalPoints = extensions.reduce((sum, extension) => sum + extension.bordaPoints, 0);
        const nearBest = this.selectNearBestExtensions(extensions);
        const assumptions = this.collectAssumptions(extensions);
        const metrics = assumptions.map((atom) => this.computeAssumptionMetrics(atom, extensions, nearBest, context, totalPoints));
        metrics.sort((left, right) => {
            if (left.decisionScore !== right.decisionScore) {
                return right.decisionScore - left.decisionScore;
            }
            if (left.robustness !== right.robustness) {
                return right.robustness - left.robustness;
            }
            if ((left.levelAdvantage ?? -Infinity) !== (right.levelAdvantage ?? -Infinity)) {
                return (right.levelAdvantage ?? -Infinity) - (left.levelAdvantage ?? -Infinity);
            }
            if ((left.bestLevel ?? Infinity) !== (right.bestLevel ?? Infinity)) {
                return (left.bestLevel ?? Infinity) - (right.bestLevel ?? Infinity);
            }
            return left.atom.localeCompare(right.atom);
        });

        const hasSupport = metrics.some((metric) => metric.supportBest !== null || metric.supportMargin !== null);
        const global = this.computeGlobalMetrics(extensions, nearBest, context);

        return {
            context,
            global,
            extensions,
            nearBest,
            atoms: metrics,
            hasSupport
        };
    }

    static buildUniqueExtensions(entries) {
        const grouped = new Map();

        entries.forEach((entry) => {
            if (!entry?.parsed) {
                return;
            }

            const assumptions = (entry.parsed.in || []).slice().sort();
            const key = assumptions.join(',') || '∅';
            const objectiveTuple = Array.isArray(entry.objectiveTuple) ? entry.objectiveTuple.slice() : [0, 0, 0];
            const displayScore = this.getDisplayScore(entry);
            const budgetValue = entry.parsed.budgetValue ?? null;

            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    label: assumptions.length > 0 ? `{${assumptions.join(', ')}}` : '∅',
                    assumptions,
                    representative: entry,
                    objectiveTuple,
                    displayScore,
                    budgetValues: budgetValue !== null ? [budgetValue] : [],
                    occurrences: 1
                });
                return;
            }

            const current = grouped.get(key);
            current.occurrences += 1;
            if (budgetValue !== null) {
                current.budgetValues.push(budgetValue);
            }

            if (this.compareTuples(objectiveTuple, current.objectiveTuple) < 0) {
                current.representative = entry;
                current.objectiveTuple = objectiveTuple;
                current.displayScore = displayScore;
            }
        });

        return Array.from(grouped.values()).map((group) => ({
            key: group.key,
            label: group.label,
            assumptions: group.assumptions,
            representative: group.representative,
            parsed: group.representative.parsed,
            objectiveTuple: group.objectiveTuple,
            displayScore: group.displayScore,
            occurrences: group.occurrences,
            budgetValues: group.budgetValues
        }));
    }

    static computeGlobalMetrics(extensions, nearBest, context) {
        const bestExtension = extensions[0];
        const secondBest = extensions.find((extension) => extension.levelIndex !== bestExtension.levelIndex) || null;
        const numericBest = this.asFiniteNumber(bestExtension.displayScore);
        const numericSecond = secondBest ? this.asFiniteNumber(secondBest.displayScore) : null;

        return {
            totalExtensions: extensions.length,
            totalScoreLevels: new Set(extensions.map((extension) => extension.levelIndex)).size,
            bestScore: bestExtension.displayScore,
            secondBestScore: secondBest ? secondBest.displayScore : null,
            numericGap: numericBest !== null && numericSecond !== null
                ? Math.abs(numericSecond - numericBest)
                : null,
            nearBestSize: nearBest.length,
            diversity: this.computeDiversity(nearBest),
            topExtensions: extensions.slice(0, 3),
            summaryText: context.summaryText
        };
    }

    static selectNearBestExtensions(extensions, initialLevels = 2, minimumCoverage = 3) {
        const levelOrder = [...new Set(extensions.map((extension) => extension.levelIndex))].sort((left, right) => left - right);
        const allowed = new Set(levelOrder.slice(0, Math.min(initialLevels, levelOrder.length)));
        let nearBest = extensions.filter((extension) => allowed.has(extension.levelIndex));
        let cursor = allowed.size;
        const targetCoverage = Math.min(minimumCoverage, extensions.length);

        while (nearBest.length < targetCoverage && cursor < levelOrder.length) {
            allowed.add(levelOrder[cursor]);
            nearBest = extensions.filter((extension) => allowed.has(extension.levelIndex));
            cursor += 1;
        }

        return nearBest;
    }

    static collectAssumptions(extensions) {
        const assumptions = new Set();

        extensions.forEach((extension) => {
            if (extension.parsed?.assumptions instanceof Set && extension.parsed.assumptions.size > 0) {
                extension.parsed.assumptions.forEach((atom) => assumptions.add(atom));
            } else {
                extension.assumptions.forEach((atom) => assumptions.add(atom));
            }
        });

        return Array.from(assumptions);
    }

    static computeAssumptionMetrics(atom, extensions, nearBest, context, totalPoints) {
        const withAtom = extensions.filter((extension) => extension.assumptions.includes(atom));
        const withoutAtom = extensions.filter((extension) => !extension.assumptions.includes(atom));
        const nearBestWithAtom = nearBest.filter((extension) => extension.assumptions.includes(atom));

        const scoreFromLevels = withAtom.reduce((sum, extension) => sum + extension.bordaPoints, 0);
        const decisionScore = totalPoints > 0 ? (100 * scoreFromLevels) / totalPoints : 0;
        const acceptanceRate = extensions.length > 0 ? (100 * withAtom.length) / extensions.length : 0;
        const robustness = nearBest.length > 0 ? (100 * nearBestWithAtom.length) / nearBest.length : 0;

        const bestWith = withAtom[0] || null;
        const bestWithout = withoutAtom[0] || null;
        const bestLevel = bestWith ? bestWith.levelNumber : null;
        const levelAdvantage = (bestWith && bestWithout)
            ? bestWithout.levelNumber - bestWith.levelNumber
            : null;

        const bestWithNumeric = bestWith ? this.asFiniteNumber(bestWith.displayScore) : null;
        const globalBestNumeric = this.asFiniteNumber(extensions[0].displayScore);
        const objectiveGap = bestWithNumeric !== null && globalBestNumeric !== null
            ? Math.abs(bestWithNumeric - globalBestNumeric)
            : null;

        const supportMetrics = this.computeSupportMetrics(atom, nearBest, context);

        return {
            atom,
            decisionScore,
            acceptanceRate,
            robustness,
            braveNearBest: nearBestWithAtom.length > 0,
            cautiousNearBest: nearBest.length > 0 && nearBestWithAtom.length === nearBest.length,
            bestLevel,
            levelAdvantage,
            objectiveGap,
            supportBest: supportMetrics.best,
            supportWorst: supportMetrics.worst,
            supportMargin: supportMetrics.margin,
            contrary: supportMetrics.contrary
        };
    }

    static computeSupportMetrics(atom, nearBest, context) {
        const rawValues = [];
        const marginValues = [];
        let contrary = null;

        nearBest.forEach((extension) => {
            const contraries = extension.parsed?.contraries;
            if (!contrary && contraries instanceof Map && contraries.has(atom)) {
                contrary = contraries.get(atom);
            }

            const weightMap = extension.parsed?.weights;
            if (!(weightMap instanceof Map)) {
                return;
            }

            const raw = this.normalizeWeightValue(weightMap.get(atom));
            if (raw !== null) {
                rawValues.push(raw);
            }

            if (contrary) {
                const contraryRaw = this.normalizeWeightValue(weightMap.get(contrary));
                const atomNumeric = this.asFiniteNumber(raw);
                const contraryNumeric = this.asFiniteNumber(contraryRaw);
                if (atomNumeric !== null && contraryNumeric !== null) {
                    marginValues.push(
                        context.supportHigherBetter
                            ? atomNumeric - contraryNumeric
                            : contraryNumeric - atomNumeric
                    );
                }
            }
        });

        if (rawValues.length === 0) {
            return { best: null, worst: null, margin: null, contrary };
        }

        let best = rawValues[0];
        let worst = rawValues[0];
        rawValues.slice(1).forEach((value) => {
            if (this.compareOrderedValues(value, best) > 0) {
                best = value;
            }
            if (this.compareOrderedValues(value, worst) < 0) {
                worst = value;
            }
        });

        if (!context.supportHigherBetter) {
            const originalBest = best;
            best = worst;
            worst = originalBest;
        }

        return {
            best,
            worst,
            margin: marginValues.length > 0
                ? marginValues.reduce((sum, value) => sum + value, 0) / marginValues.length
                : null,
            contrary
        };
    }

    static computeDiversity(extensions) {
        if (extensions.length <= 1) {
            return 0;
        }

        let totalDistance = 0;
        let pairs = 0;

        for (let i = 0; i < extensions.length; i += 1) {
            for (let j = i + 1; j < extensions.length; j += 1) {
                const left = new Set(extensions[i].assumptions);
                const right = new Set(extensions[j].assumptions);
                const intersection = new Set([...left].filter((atom) => right.has(atom)));
                const union = new Set([...left, ...right]);
                if (union.size > 0) {
                    totalDistance += 1 - (intersection.size / union.size);
                    pairs += 1;
                }
            }
        }

        return pairs > 0 ? totalDistance / pairs : 0;
    }

    static getLevelPoints(levelIndex, totalLevels) {
        if (totalLevels <= 1) {
            return 1;
        }
        return Math.max(totalLevels - levelIndex - 1, 0);
    }

    static getDisplayScore(entry) {
        if (entry?.parsed?.budgetValue !== null && entry?.parsed?.budgetValue !== undefined) {
            return entry.parsed.budgetValue;
        }
        if (entry?.cost !== null && entry?.cost !== undefined) {
            return entry.cost;
        }
        return entry?.aggregateValue ?? null;
    }

    static compareTuples(left = [], right = []) {
        const maxLength = Math.max(left.length, right.length);
        for (let index = 0; index < maxLength; index += 1) {
            const leftValue = left[index] ?? 0;
            const rightValue = right[index] ?? 0;
            if (leftValue < rightValue) {
                return -1;
            }
            if (leftValue > rightValue) {
                return 1;
            }
        }
        return 0;
    }

    static compareOrderedValues(left, right) {
        if (left === right) {
            return 0;
        }
        if (left === POS_INF) {
            return 1;
        }
        if (right === POS_INF) {
            return -1;
        }
        if (left === NEG_INF) {
            return -1;
        }
        if (right === NEG_INF) {
            return 1;
        }
        return left < right ? -1 : 1;
    }

    static normalizeWeightValue(value) {
        if (value === undefined || value === null) {
            return null;
        }
        if (value === POS_INF || value === NEG_INF) {
            return value;
        }
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    static asFiniteNumber(value) {
        if (value === undefined || value === null || value === POS_INF || value === NEG_INF) {
            return null;
        }
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    static formatMetricsHTML(metricsData) {
        if (!metricsData) {
            return '<div class="info-message">No analysis available. Run WABA first.</div>';
        }

        const { context, global, atoms, hasSupport } = metricsData;
        const topAtoms = atoms.slice(0, 3);
        const topExtensions = global.topExtensions;

        let html = '<div class="metrics-container">';
        html += '<div class="metrics-actions">';
        html += '<button id="export-metrics-csv-btn" class="analysis-action-btn">📥 Download Decision Analysis</button>';
        html += '</div>';

        html += '<div class="metrics-section">';
        html += '<h3 class="metrics-header">Decision Summary</h3>';
        html += `<p class="metrics-note">${context.summaryText}</p>`;
        html += '<div class="metrics-grid">';
        html += this.renderSummaryCard('Unique Extensions', String(global.totalExtensions));
        html += this.renderSummaryCard('Score Levels', String(global.totalScoreLevels));
        html += this.renderSummaryCard(context.bestLabel, this.formatValue(global.bestScore));
        html += this.renderSummaryCard('Second Best', this.formatValue(global.secondBestScore));
        html += this.renderSummaryCard(context.gapLabel, global.numericGap !== null ? this.formatNumber(global.numericGap) : 'rank-only');
        html += this.renderSummaryCard('Near-Best Set S', String(global.nearBestSize));
        html += this.renderSummaryCard('Diversity in S', this.formatNumber(global.diversity, 3));
        html += '</div>';
        html += '<div class="analysis-callouts">';
        html += '<div class="analysis-card">';
        html += '<h4>Top Recommended Assumptions</h4>';
        html += '<div class="analysis-chip-list">';
        topAtoms.forEach((atomMetric, index) => {
            html += `
                <div class="analysis-chip-card ${index === 0 ? 'primary' : ''}">
                    <div class="analysis-chip-name">${atomMetric.atom}</div>
                    <div class="analysis-chip-score">${this.formatNumber(atomMetric.decisionScore)} score</div>
                    <div class="analysis-chip-meta">Robustness ${this.formatPercent(atomMetric.robustness)}</div>
                </div>
            `;
        });
        html += '</div></div>';
        html += '<div class="analysis-card">';
        html += '<h4>Best Courses of Action</h4>';
        html += '<div class="analysis-ranked-list">';
        topExtensions.forEach((extension) => {
            html += `
                <div class="analysis-ranked-item">
                    <div class="analysis-ranked-heading">Level ${extension.levelNumber} · ${this.formatValue(extension.displayScore)}</div>
                    <div class="analysis-ranked-body">${extension.label}</div>
                </div>
            `;
        });
        html += '</div></div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="metrics-section">';
        html += '<h3 class="metrics-header">Assumption Ranking</h3>';
        html += '<p class="metrics-note">Decision score is a Borda-style share of ranked extension quality. Better-ranked unique extensions contribute more points to the assumptions they contain. Robustness measures how often an assumption survives in the near-best set S.</p>';
        html += '<div class="metrics-table-container">';
        html += '<table class="metrics-table">';
        html += '<thead><tr>';
        html += '<th>Assumption</th>';
        html += '<th title="Borda-style score aggregated over unique extensions">Decision Score</th>';
        html += '<th title="Presence rate inside the near-best set S">Robustness</th>';
        html += '<th title="Presence rate across all unique extensions">Coverage</th>';
        html += '<th title="Best rank level that contains the assumption">Best Level</th>';
        html += '<th title="Positive means the best extension with the assumption outranks the best extension without it">Level Advantage</th>';
        html += `<th title="Numeric ${context.gapLabel.toLowerCase()} from the global best, when comparable">${context.gapLabel}</th>`;
        if (hasSupport) {
            html += '<th title="Best support observed in S, interpreted using the current ordered-semiring polarity">Best Support</th>';
            html += '<th title="Worst support observed in S, interpreted using the current ordered-semiring polarity">Worst Support</th>';
            html += '<th title="Average support margin against the contrary when both are finite">Support Margin</th>';
            html += '<th>Contrary</th>';
        }
        html += '</tr></thead>';
        html += '<tbody>';

        atoms.forEach((metric, index) => {
            const rowClass = metric.cautiousNearBest
                ? 'decision-core'
                : metric.braveNearBest
                    ? 'decision-contender'
                    : '';
            html += `<tr class="${rowClass}">`;
            html += `<td class="atom-name">${index < 3 ? `<span class="analysis-rank-badge">#${index + 1}</span>` : ''}${metric.atom}</td>`;
            html += `<td class="metric-num">${this.formatNumber(metric.decisionScore)}</td>`;
            html += `<td class="metric-num">${this.formatPercent(metric.robustness)}</td>`;
            html += `<td class="metric-num">${this.formatPercent(metric.acceptanceRate)}</td>`;
            html += `<td class="metric-num">${metric.bestLevel !== null ? metric.bestLevel : '–'}</td>`;
            html += `<td class="metric-num ${metric.levelAdvantage > 0 ? 'metric-positive' : metric.levelAdvantage < 0 ? 'metric-negative' : ''}">${metric.levelAdvantage !== null ? this.formatSignedNumber(metric.levelAdvantage) : '–'}</td>`;
            html += `<td class="metric-num">${metric.objectiveGap !== null ? this.formatNumber(metric.objectiveGap) : '–'}</td>`;
            if (hasSupport) {
                html += `<td class="metric-num">${metric.supportBest !== null ? this.formatValue(metric.supportBest) : '–'}</td>`;
                html += `<td class="metric-num">${metric.supportWorst !== null ? this.formatValue(metric.supportWorst) : '–'}</td>`;
                html += `<td class="metric-num ${metric.supportMargin > 0 ? 'metric-positive' : metric.supportMargin < 0 ? 'metric-negative' : ''}">${metric.supportMargin !== null ? this.formatSignedNumber(metric.supportMargin) : '–'}</td>`;
                html += `<td class="contrary-name">${metric.contrary || '–'}</td>`;
            }
            html += '</tr>';
        });

        html += '</tbody></table></div></div></div>';
        return html;
    }

    static renderSummaryCard(label, value) {
        return `
            <div class="metric-item">
                <span class="metric-label">${label}</span>
                <span class="metric-value">${value}</span>
            </div>
        `;
    }

    static exportSummaryCSV(metricsData) {
        const { context, global, extensions } = metricsData;
        let csv = 'Metric,Value\n';
        csv += `Unique Extensions,${global.totalExtensions}\n`;
        csv += `Score Levels,${global.totalScoreLevels}\n`;
        csv += `${context.bestLabel},"${this.formatValue(global.bestScore)}"\n`;
        csv += `Second Best,"${this.formatValue(global.secondBestScore)}"\n`;
        csv += `${context.gapLabel},${global.numericGap !== null ? this.formatNumber(global.numericGap) : 'rank-only'}\n`;
        csv += `Near-Best Set S,${global.nearBestSize}\n`;
        csv += `Diversity in S,${this.formatNumber(global.diversity, 3)}\n`;
        csv += '\nLevel,Score,Assumptions\n';
        extensions.forEach((extension) => {
            csv += `${extension.levelNumber},"${this.formatValue(extension.displayScore)}","${extension.label}"\n`;
        });
        return csv;
    }

    static exportAssumptionCSV(metricsData) {
        const { atoms, hasSupport, context } = metricsData;
        const headers = [
            'Assumption',
            'DecisionScore',
            'Robustness',
            'Coverage',
            'BestLevel',
            'LevelAdvantage',
            context.gapLabel.replace(/\s+/g, '')
        ];

        if (hasSupport) {
            headers.push('BestSupport', 'WorstSupport', 'SupportMargin', 'Contrary');
        }

        let csv = `${headers.join(',')}\n`;
        atoms.forEach((metric) => {
            const row = [
                `"${metric.atom}"`,
                this.formatNumber(metric.decisionScore),
                this.formatPercent(metric.robustness),
                this.formatPercent(metric.acceptanceRate),
                metric.bestLevel ?? '',
                metric.levelAdvantage ?? '',
                metric.objectiveGap !== null ? this.formatNumber(metric.objectiveGap) : ''
            ];

            if (hasSupport) {
                row.push(
                    metric.supportBest !== null ? this.formatValue(metric.supportBest) : '',
                    metric.supportWorst !== null ? this.formatValue(metric.supportWorst) : '',
                    metric.supportMargin !== null ? this.formatNumber(metric.supportMargin) : '',
                    metric.contrary || ''
                );
            }

            csv += `${row.join(',')}\n`;
        });
        return csv;
    }

    static downloadMetricsCSV(metricsData) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const files = [
            ['waba-decision-summary', this.exportSummaryCSV(metricsData)],
            ['waba-assumption-ranking', this.exportAssumptionCSV(metricsData)]
        ];

        files.forEach(([name, content], index) => {
            setTimeout(() => {
                const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${name}-${timestamp}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, index * 100);
        });
    }

    static formatValue(value) {
        if (value === null || value === undefined) {
            return '–';
        }
        if (value === POS_INF || value === NEG_INF) {
            return value;
        }
        if (typeof value === 'number') {
            return this.formatNumber(value);
        }
        const numeric = Number.parseFloat(value);
        return Number.isFinite(numeric) ? this.formatNumber(numeric) : String(value);
    }

    static formatNumber(value, digits = 2) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return String(value);
        }
        return numeric.toFixed(digits).replace(/\.00$/, '');
    }

    static formatSignedNumber(value, digits = 2) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return String(value);
        }
        const prefix = numeric > 0 ? '+' : '';
        return `${prefix}${this.formatNumber(numeric, digits)}`;
    }

    static formatPercent(value) {
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) {
            return '–';
        }
        return `${Math.round(numeric)}%`;
    }

    static runUnitTest() {
        const mockEntries = [
            {
                parsed: {
                    in: ['a', 'b'],
                    assumptions: new Set(['a', 'b', 'c']),
                    contraries: new Map([['a', 'c_a']]),
                    weights: new Map([['a', 90], ['b', 70], ['c_a', 20]])
                },
                cost: 0,
                objectiveTuple: [0, 0, 0]
            },
            {
                parsed: {
                    in: ['a'],
                    assumptions: new Set(['a', 'b', 'c']),
                    contraries: new Map([['a', 'c_a']]),
                    weights: new Map([['a', 80], ['c_a', 15]])
                },
                cost: 1,
                objectiveTuple: [0, 0, 1]
            },
            {
                parsed: {
                    in: ['a', 'b'],
                    assumptions: new Set(['a', 'b', 'c']),
                    contraries: new Map([['a', 'c_a']]),
                    weights: new Map([['a', 75], ['b', 65], ['c_a', 15]])
                },
                cost: 2,
                objectiveTuple: [0, 0, 2]
            },
            {
                parsed: {
                    in: ['c'],
                    assumptions: new Set(['a', 'b', 'c']),
                    contraries: new Map(),
                    weights: new Map([['c', 40]])
                },
                cost: 2,
                objectiveTuple: [0, 0, 2]
            }
        ];

        const analysis = this.computeMetrics(mockEntries, {
            optimization: 'minimize',
            polarity: 'higher',
            budgetMode: 'ub',
            budgetIntent: 'bounded'
        });

        console.assert(analysis.global.totalExtensions === 3, 'Unique extension grouping should collapse duplicates');
        console.assert(analysis.atoms[0].atom === 'a', 'a should rank first');
        console.assert(analysis.atoms[0].decisionScore > analysis.atoms[1].decisionScore, 'Top atom should outrank the next one');
        console.assert(analysis.atoms.find((metric) => metric.atom === 'c').decisionScore === 0, 'Worst-only atom should get zero Borda score');
        console.assert(analysis.global.nearBestSize >= 2, 'Near-best selection should keep at least two levels');
    }
}
