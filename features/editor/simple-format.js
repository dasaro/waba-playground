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

        let cleanLine = line;
        if (!line.startsWith('%')) {
            const commentIndex = line.indexOf('%');
            if (commentIndex !== -1) {
                cleanLine = line.substring(0, commentIndex).trim();
            }
        }

        let match = cleanLine.match(/^assumption\(([^)]+)\)\.$/);
        if (match) {
            assumptionLines.push(match[1].trim());
            continue;
        }

        match = cleanLine.match(/^weight\(([^,]+),\s*(\d+)\)\.$/);
        if (match) {
            weightLines.push(`${match[1].trim()}: ${match[2]}`);
            continue;
        }

        match = cleanLine.match(/^contrary\(([^,]+),\s*([^)]+)\)\.$/);
        if (match) {
            contraryLines.push(`(${match[1].trim()}, ${match[2].trim()})`);
            continue;
        }

        match = cleanLine.match(/^head\(([^,]+),\s*([^)]+)\)\./);
        if (match) {
            const ruleId = match[1];
            const head = match[2];
            if (processedRules.has(ruleId)) {
                continue;
            }
            processedRules.add(ruleId);

            const commentMatch = clingoCode.match(new RegExp(`%\\s*${ruleId}:\\s*([^\\n]+)`, 'i'));
            if (commentMatch) {
                ruleLines.push(`% ${commentMatch[1]}`);
            }

            const bodyRegex = new RegExp(`body\\(${ruleId},\\s*([^)]+)\\)`, 'g');
            const bodyMatches = [...clingoCode.matchAll(bodyRegex)];
            const bodyAtoms = bodyMatches.map((value) => value[1]);
            const bodyStr = bodyAtoms.length > 0 ? bodyAtoms.join(', ') : '';
            ruleLines.push(`${head} <- ${bodyStr}`);
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
