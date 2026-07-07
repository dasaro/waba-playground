import { examples } from '../examples.js?v=20260707-2';
import { wabaModules } from '../waba-modules.js?v=20260707-2';

// Curated examples carry their prose in a `description` field. The editor's description
// bar/box is driven by the "% //" special syntax (see editor/simple-format.js), so bridge
// the field into the framework as one "% //" comment line — unless the code already carries
// its own — keeping examples.js the single source and using the existing display path.
export function withDescriptionComment(code, description) {
    if (!description) {
        return code;
    }
    if (/^\s*%\s*\/\//m.test(code)) {
        return code;
    }
    const oneLine = String(description).replace(/\r?\n+/g, ' ').trim();
    return `% // ${oneLine}\n\n${code}`;
}

export class ExamplesController {
    constructor(dom, configController, editorController, outputManager) {
        this.dom = dom;
        this.configController = configController;
        this.editorController = editorController;
        this.outputManager = outputManager;
    }

    populate() {
        this.configController.populateExampleSelect(examples, 'conflict_cycle');
    }

    getExampleCode(exampleKey) {
        const example = examples[exampleKey];
        if (!example) {
            return null;
        }
        if (example.source === 'module') {
            return wabaModules.examples[example.moduleKey] || null;
        }
        return example.code;
    }

    async loadExample(exampleName, onGraphUpdate) {
        if (exampleName === '__uploaded__') {
            // Re-selecting the 📁 uploaded option restores the uploaded framework
            // (rather than silently doing nothing).
            if (this.uploadedCode) {
                this.editorController.loadClingoCode(this.uploadedCode, null);
                if (onGraphUpdate) {
                    await onGraphUpdate(this.uploadedCode);
                }
            }
            return;
        }
        if (!exampleName || !examples[exampleName]) {
            if (exampleName) {
                this.outputManager.log(`❌ Example "${exampleName}" not found`, 'error');
            }
            return;
        }

        try {
            const example = examples[exampleName];
            const rawCode = this.getExampleCode(exampleName);
            if (!rawCode) {
                throw new Error(`Missing example code for ${exampleName}`);
            }
            const clingoCode = withDescriptionComment(rawCode, example.description);

            this.configController.applyConfigToUI(example.preset);
            this.configController.syncUi();
            this.editorController.loadClingoCode(clingoCode, null);

            if (onGraphUpdate) {
                await onGraphUpdate(clingoCode);
            }

            this.outputManager.log(`Loaded example: ${example.label}`, 'info');
        } catch (error) {
            console.error(`Error loading example ${exampleName}:`, error);
            this.outputManager.log(`❌ Error loading example: ${error.message}`, 'error');
        }
    }

    updateExampleSelectWithFilename(filename) {
        // Remember the uploaded framework so re-selecting the 📁 option can restore it.
        this.uploadedCode = this.editorController.getFrameworkCode();
        const existingOption = this.dom.exampleSelect.querySelector('option[value="__uploaded__"]');
        if (existingOption) {
            existingOption.remove();
        }

        const filenameWithoutExt = filename.replace(/\.(lp|waba)$/i, '');
        const option = this.dom.document.createElement('option');
        option.value = '__uploaded__';
        option.textContent = `📁 ${filenameWithoutExt}`;
        option.selected = true;

        if (this.dom.exampleSelect.options.length > 0) {
            this.dom.exampleSelect.insertBefore(option, this.dom.exampleSelect.options[1]);
        } else {
            this.dom.exampleSelect.appendChild(option);
        }
    }
}
