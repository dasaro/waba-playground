import { PrismEditor } from '../modules/prism-editor.js?v=20260312-8';
import { buildClingoFromSimpleFields, extractSimpleFields } from './editor/simple-format.js?v=20260312-8';

export class EditorController {
    constructor(dom, store, fileManager) {
        this.dom = dom;
        this.store = store;
        this.fileManager = fileManager;
        this.assumptionsInput = dom.assumptionsInput;
        this.rulesInput = dom.rulesInput;
        this.contrariesInput = dom.contrariesInput;
        this.weightsInput = dom.weightsInput;
        this.isDescriptionEditorOpen = false;
    }

    init(onFrameworkChanged) {
        this.initPrismEditors();
        this.attachModeHandlers(onFrameworkChanged);
        this.attachDescriptionHandlers(onFrameworkChanged);
        this.attachSimpleInputHandlers(onFrameworkChanged);
        this.applyModeVisibility(this.dom.inputMode.value);
        this.updateSimpleDescription();
    }

    initPrismEditors() {
        this.assumptionsEditor = new PrismEditor(this.dom.assumptionsInput, 'waba');
        this.rulesEditor = new PrismEditor(this.dom.rulesInput, 'waba');
        this.contrariesEditor = new PrismEditor(this.dom.contrariesInput, 'waba');
        this.weightsEditor = new PrismEditor(this.dom.weightsInput, 'waba');

        this.assumptionsInput = this.assumptionsEditor;
        this.rulesInput = this.rulesEditor;
        this.contrariesInput = this.contrariesEditor;
        this.weightsInput = this.weightsEditor;

        this.fileManager.assumptionsInput = this.assumptionsEditor;
        this.fileManager.rulesInput = this.rulesEditor;
        this.fileManager.contrariesInput = this.contrariesEditor;
        this.fileManager.weightsInput = this.weightsEditor;
    }

    attachModeHandlers(onFrameworkChanged) {
        this.dom.inputMode.addEventListener('change', () => {
            const mode = this.dom.inputMode.value;

            if (mode === 'simple') {
                const advancedCode = this.dom.editor.value.trim();
                if (advancedCode) {
                    this.populateSimpleModeFromClingo(advancedCode);
                }
            } else {
                const originalWabaContent = this.store.getState().originalWabaContent;
                if (originalWabaContent) {
                    this.dom.editor.value = originalWabaContent;
                } else {
                    this.dom.editor.value = this.parseSimpleABA();
                }
            }

            this.applyModeVisibility(mode);
            this.updateSimpleDescription();
            if (onFrameworkChanged) {
                onFrameworkChanged();
            }
        });
    }

    attachSimpleInputHandlers(onFrameworkChanged) {
        [this.assumptionsInput, this.rulesInput, this.contrariesInput, this.weightsInput].forEach((input) => {
            input.addEventListener('input', () => {
                if (this.dom.inputMode.value !== 'simple') {
                    return;
                }
                this.store.setState({ originalWabaContent: null });
                this.updateSimpleDescription();
                if (onFrameworkChanged) {
                    onFrameworkChanged();
                }
            });
        });
    }

    attachDescriptionHandlers(onFrameworkChanged) {
        if (this.dom.simpleAddCommentBtn) {
            this.dom.simpleAddCommentBtn.addEventListener('click', () => this.addDescriptionTemplate());
        }

        if (this.dom.simpleEditDescriptionBtn) {
            this.dom.simpleEditDescriptionBtn.addEventListener('click', () => this.openDescriptionEditor());
        }

        if (this.dom.simpleHideDescriptionEditorBtn) {
            this.dom.simpleHideDescriptionEditorBtn.addEventListener('click', () => this.hideDescriptionEditor());
        }

        if (this.dom.simpleRemoveDescriptionBtn) {
            this.dom.simpleRemoveDescriptionBtn.addEventListener('click', () => {
                this.removeDescription();
                if (onFrameworkChanged && this.dom.inputMode.value === 'simple') {
                    onFrameworkChanged();
                }
            });
        }

        if (this.dom.simpleDescriptionContent) {
            this.dom.simpleDescriptionContent.addEventListener('input', () => {
                this.updateSimpleDescription();
                if (onFrameworkChanged && this.dom.inputMode.value === 'simple') {
                    onFrameworkChanged();
                }
            });
        }
    }

    applyModeVisibility(mode) {
        if (mode === 'simple') {
            this.dom.simpleMode.style.display = 'block';
            this.dom.editor.style.display = 'none';
        } else {
            this.dom.simpleMode.style.display = 'none';
            this.dom.editor.style.display = 'block';
        }
    }

    getFrameworkCode() {
        return this.dom.inputMode.value === 'simple'
            ? this.parseSimpleABA()
            : this.dom.editor.value.trim();
    }

    parseSimpleABA() {
        return buildClingoFromSimpleFields({
            description: this.dom.simpleDescriptionContent?.value || '',
            assumptions: this.assumptionsInput.value,
            rules: this.rulesInput.value,
            contraries: this.contrariesInput.value,
            weights: this.weightsInput.value
        });
    }

    populateSimpleModeFromClingo(clingoCode) {
        const fields = extractSimpleFields(clingoCode);
        this.populateSimpleFields(fields);
    }

    populateSimpleFields(fields) {
        this.isDescriptionEditorOpen = false;
        if (this.dom.simpleDescriptionContent) {
            this.dom.simpleDescriptionContent.value = fields.description || '';
        }
        this.assumptionsInput.value = fields.assumptions || '';
        this.rulesInput.value = fields.rules || '';
        this.contrariesInput.value = fields.contraries || '';
        this.weightsInput.value = fields.weights || '';
        this.updateSimpleDescription();
    }

    loadClingoCode(clingoCode, originalWabaContent = null) {
        this.dom.editor.value = clingoCode;
        this.store.setState({ originalWabaContent });
        this.populateSimpleModeFromClingo(clingoCode);
    }

    loadParsedWaba(parsed, originalWabaContent) {
        this.store.setState({ originalWabaContent });
        this.populateSimpleFields({
            description: '',
            assumptions: parsed.assumptions.join('\n'),
            rules: parsed.rules.join('\n'),
            contraries: parsed.contraries.join('\n'),
            weights: parsed.weights.join('\n')
        });
        this.dom.inputMode.value = 'simple';
        this.applyModeVisibility('simple');
    }

    updateSimpleDescription() {
        const description = this.dom.simpleDescriptionContent?.value.trim() || '';
        const hasDescription = Boolean(description.length);

        if (this.dom.simpleDescriptionPreview) {
            this.dom.simpleDescriptionPreview.textContent = description;
        }

        if (this.dom.simpleDescriptionBar) {
            if (hasDescription) {
                this.dom.simpleDescriptionBar.removeAttribute('hidden');
            } else {
                this.dom.simpleDescriptionBar.setAttribute('hidden', '');
            }
        }

        if (this.dom.simpleDescriptionBox) {
            if (hasDescription && this.isDescriptionEditorOpen) {
                this.dom.simpleDescriptionBox.removeAttribute('hidden');
            } else {
                this.dom.simpleDescriptionBox.setAttribute('hidden', '');
            }
        }

        if (this.dom.simpleAddCommentContainer) {
            if (hasDescription) {
                this.dom.simpleAddCommentContainer.setAttribute('hidden', '');
            } else {
                this.dom.simpleAddCommentContainer.removeAttribute('hidden');
            }
        }
    }

    addDescriptionTemplate() {
        if (!this.dom.simpleDescriptionContent) {
            return;
        }

        this.isDescriptionEditorOpen = true;
        this.dom.simpleDescriptionContent.value = 'Enter your description here';
        this.dom.simpleDescriptionContent.focus();
        this.dom.simpleDescriptionContent.select();
        this.updateSimpleDescription();
    }

    openDescriptionEditor() {
        this.isDescriptionEditorOpen = true;
        this.updateSimpleDescription();
        this.dom.simpleDescriptionContent?.focus();
    }

    hideDescriptionEditor() {
        this.isDescriptionEditorOpen = false;
        this.updateSimpleDescription();
    }

    removeDescription() {
        if (this.dom.simpleDescriptionContent) {
            this.dom.simpleDescriptionContent.value = '';
        }
        this.isDescriptionEditorOpen = false;
        this.updateSimpleDescription();
    }
}
