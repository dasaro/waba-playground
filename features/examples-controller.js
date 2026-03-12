import { examples } from '../examples.js?v=20260312-8';
import { wabaModules } from '../waba-modules.js?v=20260312-8';

export class ExamplesController {
    constructor(dom, configController, editorController, outputManager) {
        this.dom = dom;
        this.configController = configController;
        this.editorController = editorController;
        this.outputManager = outputManager;
    }

    populate() {
        this.configController.populateExampleSelect(examples, 'demo_complete');
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
            const clingoCode = this.getExampleCode(exampleName);
            if (!clingoCode) {
                throw new Error(`Missing example code for ${exampleName}`);
            }

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
