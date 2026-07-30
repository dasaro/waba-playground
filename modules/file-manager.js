/**
 * FileManager - Handles file upload/download and format conversion
 */
export class FileManager {
    constructor(fileUploadBtn, fileUploadInput, inputMode, simpleMode, editor,
                assumptionsInput, rulesInput, contrariesInput, weightsInput,
                descriptionInput = null) {
        this.fileUploadBtn = fileUploadBtn;
        this.fileUploadInput = fileUploadInput;
        this.inputMode = inputMode;
        this.simpleMode = simpleMode;
        this.editor = editor;
        this.assumptionsInput = assumptionsInput;
        this.rulesInput = rulesInput;
        this.contrariesInput = contrariesInput;
        this.weightsInput = weightsInput;
        this.descriptionInput = descriptionInput;
    }

    // ===================================
    // Download Files
    // ===================================
    downloadAsLp(frameworkCode, onLog) {
        if (!frameworkCode) {
            onLog('⚠️ No framework code to download', 'warning');
            return;
        }

        // Create blob and download
        const blob = new Blob([frameworkCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `waba-framework-${timestamp}.lp`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onLog(`💾 Downloaded framework as ${a.download}`, 'success');
    }

    downloadAsWaba(wabaContent, onLog) {
        if (!wabaContent) {
            onLog('⚠️ Could not generate .waba format', 'warning');
            return;
        }

        // Create blob and download
        const blob = new Blob([wabaContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `waba-framework-${timestamp}.waba`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onLog(`💾 Downloaded framework as ${a.download}`, 'success');
    }

    // ===================================
    // Format Generation
    // ===================================
    generateWabaFormat() {
        // Generate .waba format from Simple Mode fields
        let content = '';

        // Description. The .lp export preserves it as a "% //" line (see
        // features/editor/simple-format.js); .waba dropped it silently, so exporting and
        // re-importing lost the modeller's own notes. Same convention here, one line per
        // source line, so both formats survive a round trip.
        const description = this.descriptionInput?.value.trim();
        if (description) {
            content += description.split('\n').map((line) => `% // ${line}`).join('\n') + '\n\n';
        }

        // Assumptions
        const assumptions = this.assumptionsInput.value.trim();
        if (assumptions) {
            content += '% Assumptions:\n' + assumptions + '\n\n';
        }

        // Rules
        const rules = this.rulesInput.value.trim();
        if (rules) {
            content += '% Rules:\n' + rules + '\n\n';
        }

        // Contraries
        const contraries = this.contrariesInput.value.trim();
        if (contraries) {
            content += '% Contraries:\n' + contraries + '\n\n';
        }

        // Weights
        const weights = this.weightsInput.value.trim();
        if (weights) {
            content += '% Weights:\n' + weights + '\n';
        }

        return content.trim();
    }

    convertLpToWaba(clingoCode) {
        // Parse .lp format and convert to .waba Simple Mode format
        const preprocessed = clingoCode.replace(/\.\s+/g, '.\n');
        const allLines = preprocessed.split('\n').map(l => l.trim());
        // Capture the description BEFORE dropping comments: "% //" is the description
        // convention in both formats, and the blanket comment filter below used to discard it,
        // so converting an .lp to .waba silently lost it.
        const descriptionLines = allLines
            .filter((l) => l.startsWith('% //'))
            .map((l) => l.slice(4).trim());
        const lines = allLines.filter(l => l && !l.startsWith('%'));

        const assumptions = [];
        const weights = [];
        const contraries = [];
        const rules = new Map();

        // Parse each line
        lines.forEach(line => {
            // Parse assumptions
            let match = line.match(/^assumption\(([^)]+)\)\.$/);
            if (match) {
                assumptions.push(match[1]);
                return;
            }

            // Parse weights
            match = line.match(/^weight\(([^,]+),\s*(\d+)\)\.$/);
            if (match) {
                weights.push(`${match[1]}: ${match[2]}`);
                return;
            }

            // Parse contraries (emit the parenthesized form the Simple editor uses,
            // so the exported .waba re-imports correctly)
            match = line.match(/^contrary\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                contraries.push(`(${match[1].trim()}, ${match[2].trim()})`);
                return;
            }

            // Parse head
            match = line.match(/^head\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                const ruleId = match[1];
                const head = match[2];
                if (!rules.has(ruleId)) {
                    rules.set(ruleId, { head: head, body: [] });
                } else {
                    rules.get(ruleId).head = head;
                }
                return;
            }

            // Parse body (handles both separate body(r,X). facts and the compact
            // pool form body(r, a; r, b; r, c) that the Simple editor emits)
            match = line.match(/^body\(([^,]+),\s*([^)]*)\)\.$/);
            if (match) {
                const ruleId = match[1].trim();
                const bodyAtoms = [];
                match[2].split(';').forEach((segment) => {
                    const parts = segment.split(',').map((part) => part.trim()).filter(Boolean);
                    const atom = parts.length > 1 ? parts[parts.length - 1] : parts[0];
                    if (atom && atom !== ruleId) {
                        bodyAtoms.push(atom);
                    }
                });
                if (!rules.has(ruleId)) {
                    rules.set(ruleId, { head: null, body: bodyAtoms });
                } else {
                    rules.get(ruleId).body.push(...bodyAtoms);
                }
                return;
            }
        });

        // Generate .waba format
        let content = '';

        if (descriptionLines.length > 0) {
            content += descriptionLines.map((line) => `% // ${line}`).join('\n') + '\n\n';
        }

        if (assumptions.length > 0) {
            content += '% Assumptions:\n' + assumptions.join('\n') + '\n\n';
        }

        if (rules.size > 0) {
            content += '% Rules:\n';
            rules.forEach((rule) => {
                if (rule.head) {
                    const bodyStr = rule.body.length > 0 ? rule.body.join(', ') : '';
                    content += `${rule.head} <- ${bodyStr}\n`;
                }
            });
            content += '\n';
        }

        if (contraries.length > 0) {
            content += '% Contraries:\n' + contraries.join('\n') + '\n\n';
        }

        if (weights.length > 0) {
            content += '% Weights:\n' + weights.join('\n') + '\n';
        }

        return content.trim();
    }

    parseWabaFile(content) {
        const lines = content.split('\n').map(l => l.trim());

        const assumptions = [];
        const rules = [];
        const contraries = [];
        const weights = [];
        const descriptionLines = [];

        for (const line of lines) {
            // "% //" carries the description, as in the .lp format. Checked BEFORE the blanket
            // comment skip below, which is what used to discard it.
            if (line.startsWith('% //')) {
                descriptionLines.push(line.slice(4).trim());
                continue;
            }

            // Skip empty lines and other comments (% is ASP/WABA standard)
            if (!line || line.startsWith('%')) continue;

            // Check for rule: "a <- b,d" (ASCII) or "a ← b,d" (Unicode arrow, as
            // written by convertLpToWaba). Normalize to ASCII so the Simple editor
            // and buildClingoFromSimpleFields can parse it back.
            const ruleMatch = line.match(/^([a-z_][a-z0-9_]*)\s*(?:<-|←)\s*(.*)$/i);
            if (ruleMatch) {
                rules.push(`${ruleMatch[1]} <- ${ruleMatch[2].trim()}`);
                continue;
            }

            // Check for weight first (has colon + number): "d : 10" or "a: 80"
            const weightMatch = line.match(/^([a-z_][a-z0-9_]*)\s*:\s*(\d+)$/i);
            if (weightMatch) {
                weights.push(line);
                continue;
            }

            // Check for contrary in the parenthesized form "(a, c)" (what the Simple
            // editor / generateWabaFormat write). Normalize to "(a, c)".
            const contraryParenMatch = line.match(/^\(\s*([a-z_][a-z0-9_]*)\s*,\s*([a-z_][a-z0-9_]*)\s*\)$/i);
            if (contraryParenMatch) {
                contraries.push(`(${contraryParenMatch[1]}, ${contraryParenMatch[2]})`);
                continue;
            }

            // Check for contrary in the colon form "a: attack_element". Normalize to
            // "(a, c)" so it round-trips through the Simple editor into ASP.
            const contraryMatch = line.match(/^([a-z_][a-z0-9_]*)\s*:\s*([a-z_][a-z0-9_]*)$/i);
            if (contraryMatch) {
                contraries.push(`(${contraryMatch[1]}, ${contraryMatch[2]})`);
                continue;
            }

            // Otherwise treat as assumption (single atom)
            const assumptionMatch = line.match(/^[a-z_][a-z0-9_]*$/i);
            if (assumptionMatch) {
                assumptions.push(line);
                continue;
            }

            // Unrecognized line format - log warning
            console.warn(`Unrecognized .waba line format: "${line}"`);
        }

        return { assumptions, rules, contraries, weights, description: descriptionLines.join('\n').trim() };
    }
}
