/**
 * FileManager - Handles file upload/download and format conversion
 */
export class FileManager {
    constructor(fileUploadBtn, fileUploadInput, inputMode, simpleMode, editor,
                assumptionsInput, rulesInput, contrariesInput, weightsInput) {
        this.fileUploadBtn = fileUploadBtn;
        this.fileUploadInput = fileUploadInput;
        this.inputMode = inputMode;
        this.simpleMode = simpleMode;
        this.editor = editor;
        this.assumptionsInput = assumptionsInput;
        this.rulesInput = rulesInput;
        this.contrariesInput = contrariesInput;
        this.weightsInput = weightsInput;
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
        const lines = preprocessed.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%'));

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

            // Parse contraries
            match = line.match(/^contrary\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                contraries.push(`(${match[1]}, ${match[2]})`);
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

            // Parse body
            match = line.match(/^body\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                const ruleId = match[1];
                const bodyAtom = match[2];
                if (!rules.has(ruleId)) {
                    rules.set(ruleId, { head: null, body: [bodyAtom] });
                } else {
                    rules.get(ruleId).body.push(bodyAtom);
                }
                return;
            }
        });

        // Generate .waba format
        let content = '';

        if (assumptions.length > 0) {
            content += '% Assumptions:\n' + assumptions.join('\n') + '\n\n';
        }

        if (rules.size > 0) {
            content += '% Rules:\n';
            rules.forEach((rule) => {
                if (rule.head) {
                    const bodyStr = rule.body.length > 0 ? rule.body.join(', ') : '';
                    content += `${rule.head} ← ${bodyStr}\n`;
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

    // ===================================
    // File Upload
    // ===================================
    async handleFileUpload(event, onGraphUpdate, parseSimpleABA, onLog) {
        const file = event.target.files[0];
        if (!file) return;

        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        try {
            const content = await file.text();

            if (fileExtension === 'lp') {
                // .lp file: switch to Advanced Mode and load directly
                this.inputMode.value = 'advanced';
                this.simpleMode.style.display = 'none';
                this.editor.style.display = 'block';
                this.editor.value = content;

                // Update graph visualization
                await onGraphUpdate(content);

                onLog(`📁 Loaded .lp file: ${fileName}`, 'info');

            } else if (fileExtension === 'waba') {
                // .waba file: parse and load into Simple Mode
                const parsed = this.parseWabaFile(content);

                // Switch to Simple Mode
                this.inputMode.value = 'simple';
                this.simpleMode.style.display = 'block';
                this.editor.style.display = 'none';

                // Populate fields
                this.assumptionsInput.value = parsed.assumptions.join('\n');
                this.rulesInput.value = parsed.rules.join('\n');
                this.contrariesInput.value = parsed.contraries.join('\n');
                this.weightsInput.value = parsed.weights.join('\n');

                // Generate ASP code and update graph
                const aspCode = parseSimpleABA();
                await onGraphUpdate(aspCode);

                onLog(`📁 Loaded .waba file: ${fileName}`, 'info');

            } else {
                onLog(`❌ Unsupported file type: ${fileExtension}. Please use .lp or .waba files.`, 'error');
            }

            // Reset file input for subsequent uploads
            this.fileUploadInput.value = '';

        } catch (error) {
            onLog(`❌ Error loading file: ${error.message}`, 'error');
            console.error('File upload error:', error);
            this.fileUploadInput.value = '';
        }
    }

    parseWabaFile(content) {
        const lines = content.split('\n').map(l => l.trim());

        const assumptions = [];
        const rules = [];
        const contraries = [];
        const weights = [];

        for (const line of lines) {
            // Skip empty lines and comments (% is ASP/WABA standard)
            if (!line || line.startsWith('%')) continue;

            // Check for rule: "a <- b,d" or "d <- c"
            const ruleMatch = line.match(/^([a-z_][a-z0-9_]*)\s*<-\s*(.*)$/i);
            if (ruleMatch) {
                rules.push(line);
                continue;
            }

            // Check for contrary first (has parentheses): "(a, c_a)" format
            const contraryMatch = line.match(/^\(\s*([a-z_][a-z0-9_]*)\s*,\s*([a-z_][a-z0-9_]*)\s*\)$/i);
            if (contraryMatch) {
                contraries.push(line);
                continue;
            }

            // Check for weight (has colon + number): "d : 10" or "a: 80"
            const weightMatch = line.match(/^([a-z_][a-z0-9_]*)\s*:\s*(\d+)$/i);
            if (weightMatch) {
                weights.push(line);
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

        return { assumptions, rules, contraries, weights };
    }
}
