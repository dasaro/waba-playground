function processLines(lines) {
    const result = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        if (trimmed.startsWith('% //')) {
            continue;
        }
        result.push(trimmed);
    }

    return result;
}

/**
 * Build ASP code from simple editor fields.
 *
 * @param {{
 *   description: string,
 *   assumptions: string,
 *   rules: string,
 *   contraries: string,
 *   weights: string
 * }} fields
 */
export function buildClingoFromSimpleFields(fields) {
    const description = fields.description
        ? fields.description.split('\n').filter((line) => line.trim())
        : [];
    const assumptionsLines = processLines(fields.assumptions.split('\n'));
    const rulesLines = processLines(fields.rules.split('\n'));
    const contrariesLines = processLines(fields.contraries.split('\n'));
    const weightsLines = processLines(fields.weights.split('\n'));

    let clingoCode = '%% Auto-generated from Simple Editor\n';

    if (description.length > 0) {
        description.forEach((line) => {
            clingoCode += `% // ${line}\n`;
        });
        clingoCode += '\n';
    }

    clingoCode += '\n';

    if (assumptionsLines.length > 0) {
        clingoCode += '%% Assumptions\n';
        assumptionsLines.forEach((line) => {
            if (line.startsWith('%')) {
                clingoCode += `${line}\n`;
            } else {
                clingoCode += `assumption(${line}).\n`;
            }
        });
        clingoCode += '\n';
    }

    if (weightsLines.length > 0) {
        clingoCode += '%% Weights\n';
        weightsLines.forEach((line) => {
            if (line.startsWith('%')) {
                clingoCode += `${line}\n`;
            } else {
                const match = line.match(/^([a-z_][a-z0-9_]*)\s*:\s*(\d+)$/i);
                if (match) {
                    const [, atom, weight] = match;
                    clingoCode += `weight(${atom}, ${weight}).\n`;
                }
            }
        });
        clingoCode += '\n';
    }

    if (rulesLines.length > 0) {
        clingoCode += '%% Rules\n';
        let ruleCounter = 1;
        rulesLines.forEach((line) => {
            if (line.startsWith('%')) {
                clingoCode += `${line}\n`;
            } else {
                const match = line.match(/^([a-z_][a-z0-9_]*)\s*<-\s*(.*)$/i);
                if (match) {
                    const [, head, bodyStr] = match;
                    const ruleId = `r${ruleCounter++}`;

                    if (bodyStr.trim() === '') {
                        clingoCode += `% ${ruleId}: ${head} <- (fact)\n`;
                        clingoCode += `head(${ruleId}, ${head}).\n`;
                    } else {
                        const bodyAtoms = bodyStr.split(',').map((value) => value.trim()).filter(Boolean);
                        clingoCode += `% ${ruleId}: ${head} <- ${bodyAtoms.join(', ')}\n`;
                        clingoCode += `head(${ruleId}, ${head}). body(${ruleId}, ${bodyAtoms.join(`; ${ruleId}, `)}).\n`;
                    }
                }
            }
        });
        clingoCode += '\n';
    }

    if (contrariesLines.length > 0) {
        clingoCode += '%% Contraries\n';
        contrariesLines.forEach((line) => {
            if (line.startsWith('%')) {
                clingoCode += `${line}\n`;
            } else {
                const match = line.match(/^\(\s*([a-z_][a-z0-9_]*)\s*,\s*([a-z_][a-z0-9_]*)\s*\)$/i);
                if (match) {
                    const [, assumption, contrary] = match;
                    clingoCode += `contrary(${assumption}, ${contrary}).\n`;
                }
            }
        });
    }

    return clingoCode;
}

/**
 * Parse ASP back into simple editor fields.
 *
 * @param {string} clingoCode
 */
export function extractSimpleFields(clingoCode) {
    const lines = clingoCode.split('\n').map((line) => line.trim());
    const descriptionLines = [];
    const assumptionLines = [];
    const ruleLines = [];
    const contraryLines = [];
    const weightLines = [];
    const processedRules = new Set();

    for (const line of lines) {
        if (!line) {
            continue;
        }

        if (line.startsWith('% //')) {
            descriptionLines.push(line.substring(4).trim());
            continue;
        }

        if (line.match(/%+\s*(Assumptions|Rules|Contraries|Weights)/i)) {
            continue;
        }

        // Full-line comments contribute nothing (description handled above).
        if (line.startsWith('%')) {
            continue;
        }

        // Strip a trailing inline comment, then split into individual statements:
        // a single source line may hold several facts, e.g. "assumption(a). weight(a,5).".
        const commentIndex = line.indexOf('%');
        const cleanLine = commentIndex !== -1 ? line.substring(0, commentIndex).trim() : line;
        const statements = cleanLine
            .split('.')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => `${part}.`);

        for (const stmt of statements) {
            let match = stmt.match(/^assumption\(([^)]+)\)\.$/);
            if (match) {
                assumptionLines.push(match[1].trim());
                continue;
            }

            match = stmt.match(/^weight\(([^,]+),\s*(\d+)\)\.$/);
            if (match) {
                weightLines.push(`${match[1].trim()}: ${match[2]}`);
                continue;
            }

            match = stmt.match(/^contrary\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                contraryLines.push(`(${match[1].trim()}, ${match[2].trim()})`);
                continue;
            }

            match = stmt.match(/^head\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                const ruleId = match[1].trim();
                const head = match[2].trim();
                if (processedRules.has(ruleId)) {
                    continue;
                }
                processedRules.add(ruleId);

                const commentMatch = clingoCode.match(new RegExp(`%\\s*${ruleId}:\\s*([^\\n]+)`, 'i'));
                if (commentMatch) {
                    ruleLines.push(`% ${commentMatch[1]}`);
                }

                const bodyRegex = new RegExp(`body\\(\\s*${ruleId}\\s*,\\s*([^)]*)\\)`, 'g');
                const bodyAtoms = [];
                for (const bodyMatch of clingoCode.matchAll(bodyRegex)) {
                    // Handle both separate `body(r,X).` facts and the compact pool
                    // form `body(r, a; r, b; r, c)` that buildClingoFromSimpleFields
                    // emits: split on ';', and within each segment the atom is the
                    // part after the rule id (a bare first segment is just the atom).
                    bodyMatch[1].split(';').forEach((segment) => {
                        const parts = segment.split(',').map((part) => part.trim()).filter(Boolean);
                        const atom = parts.length > 1 ? parts[parts.length - 1] : parts[0];
                        if (atom && atom !== ruleId) {
                            bodyAtoms.push(atom);
                        }
                    });
                }
                const bodyStr = bodyAtoms.length > 0 ? bodyAtoms.join(', ') : '';
                ruleLines.push(`${head} <- ${bodyStr}`);
            }
        }
    }

    return {
        description: descriptionLines.join('\n'),
        assumptions: assumptionLines.join('\n'),
        rules: ruleLines.join('\n'),
        contraries: contraryLines.join('\n'),
        weights: weightLines.join('\n')
    };
}
