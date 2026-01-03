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
        const allLines = preprocessed.split('\n').map(l => l.trim()).filter(l => l);

        const assumptions = [];
        const weights = [];
        const contraries = [];
        const rules = new Map();
        const description = [];

        // Extract description lines (% //) and filter out other comments
        const lines = allLines.filter(line => {
            // Extract description lines
            if (line.startsWith('% //')) {
                const content = line.substring(4).trim();
                description.push(content);
                return false;
            }
            // Filter out other comments
            if (line.startsWith('%')) {
                return false;
            }
            return true;
        });

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

        // Add description at the beginning
        if (description.length > 0) {
            description.forEach(line => {
                content += `% // ${line}\n`;
            });
            content += '\n';
        }

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
    async handleFileUpload(event, onGraphUpdate, parseSimpleABA, onLog, onClearPreviousRun) {
        const file = event.target.files[0];
        if (!file) return;

        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        // Show confirmation dialog before loading
        const confirmed = await this.showConfirmationDialog(
            'Load File',
            'All information about the previous run will be overwritten. Do you want to continue?'
        );

        if (!confirmed) {
            // User cancelled - reset file input
            this.fileUploadInput.value = '';
            return;
        }

        try {
            const content = await file.text();

            // Clear all previous run information
            if (onClearPreviousRun) {
                onClearPreviousRun();
            }

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

                // Populate fields WITHOUT description (description goes in description box only)
                this.assumptionsInput.value = parsed.assumptions.join('\n');
                this.rulesInput.value = parsed.rules.join('\n');
                this.contrariesInput.value = parsed.contraries.join('\n');
                this.weightsInput.value = parsed.weights.join('\n');

                // Set description directly in description textarea
                const descriptionContent = document.getElementById('simple-description-content');
                if (descriptionContent && parsed.description && parsed.description.length > 0) {
                    descriptionContent.value = parsed.description.join('\n');
                }

                // Generate ASP code and update graph (this will also update description display)
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
        const description = [];
        let currentSection = null;

        for (const line of lines) {
            // Skip empty lines
            if (!line) continue;

            // Extract description lines (% //)
            if (line.startsWith('% //')) {
                const descLine = line.substring(4).trim();
                description.push(descLine);
                continue;
            }

            // Preserve inline comments (not section headers) - add to appropriate section
            if (line.startsWith('%')) {
                // Detect section headers to determine current context
                if (line.match(/%\s*Assumptions:/i)) {
                    currentSection = 'assumptions';
                    continue;
                } else if (line.match(/%\s*Rules:/i)) {
                    currentSection = 'rules';
                    continue;
                } else if (line.match(/%\s*Contraries:/i)) {
                    currentSection = 'contraries';
                    continue;
                } else if (line.match(/%\s*Weights:/i)) {
                    currentSection = 'weights';
                    continue;
                }

                // Add inline comment to current section
                if (currentSection === 'assumptions') assumptions.push(line);
                else if (currentSection === 'rules') rules.push(line);
                else if (currentSection === 'contraries') contraries.push(line);
                else if (currentSection === 'weights') weights.push(line);
                continue;
            }

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

        return { assumptions, rules, contraries, weights, description };
    }

    // ===================================
    // Confirmation Dialog
    // ===================================
    showConfirmationDialog(title, message) {
        return new Promise((resolve) => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            // Create dialog
            const dialog = document.createElement('div');
            dialog.className = 'confirmation-dialog';
            dialog.style.cssText = `
                background: var(--bg-secondary, #1e293b);
                border: 1px solid var(--border-color, #475569);
                border-radius: var(--radius-lg, 12px);
                padding: var(--space-xl, 24px);
                max-width: 400px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            `;

            // Dialog title
            const dialogTitle = document.createElement('h3');
            dialogTitle.textContent = title;
            dialogTitle.style.cssText = `
                margin: 0 0 16px 0;
                color: var(--text-primary, #f1f5f9);
                font-size: 18px;
                font-weight: 600;
            `;

            // Dialog message
            const dialogMessage = document.createElement('p');
            dialogMessage.textContent = message;
            dialogMessage.style.cssText = `
                margin: 0 0 24px 0;
                color: var(--text-secondary, #cbd5e1);
                line-height: 1.5;
            `;

            // Button container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            `;

            // Cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'dialog-btn dialog-btn-cancel';
            cancelBtn.style.cssText = `
                padding: 8px 20px;
                border: 1px solid var(--border-color, #475569);
                background: transparent;
                color: var(--text-secondary, #cbd5e1);
                border-radius: var(--radius-md, 8px);
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
            `;

            // OK button
            const okBtn = document.createElement('button');
            okBtn.textContent = 'OK';
            okBtn.className = 'dialog-btn dialog-btn-ok';
            okBtn.style.cssText = `
                padding: 8px 20px;
                border: none;
                background: var(--primary-color, #667eea);
                color: white;
                border-radius: var(--radius-md, 8px);
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.2s ease;
            `;

            // Hover effects
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'var(--bg-tertiary, #334155)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'transparent';
            });

            okBtn.addEventListener('mouseenter', () => {
                okBtn.style.background = 'var(--primary-dark, #5568d3)';
            });
            okBtn.addEventListener('mouseleave', () => {
                okBtn.style.background = 'var(--primary-color, #667eea)';
            });

            // Event handlers
            const cleanup = () => {
                document.body.removeChild(overlay);
            };

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            okBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });

            // Escape key handler
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Build dialog
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(okBtn);
            dialog.appendChild(dialogTitle);
            dialog.appendChild(dialogMessage);
            dialog.appendChild(buttonContainer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Focus OK button
            okBtn.focus();
        });
    }
}
