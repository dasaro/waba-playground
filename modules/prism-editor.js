/**
 * PrismEditor - contenteditable wrapper with Prism highlighting.
 */
export class PrismEditor {
    constructor(textarea, language = 'waba') {
        this.textarea = textarea;
        this.language = language;
        this.container = null;
        this.preElement = null;
        this.codeElement = null;
        this.inputListeners = [];
        this.init();
    }

    init() {
        this.container = document.createElement('div');
        this.container.className = 'prism-editor-container';

        this.preElement = document.createElement('pre');
        this.preElement.className = 'prism-editor-pre';

        this.codeElement = document.createElement('code');
        this.codeElement.className = `language-${this.language} prism-editor-code`;
        this.codeElement.contentEditable = 'true';
        this.codeElement.spellcheck = false;
        this.codeElement.textContent = this.textarea.value;

        Prism.highlightElement(this.codeElement);

        this.preElement.appendChild(this.codeElement);
        this.container.appendChild(this.preElement);
        this.textarea.style.display = 'none';
        this.textarea.parentNode.insertBefore(this.container, this.textarea.nextSibling);

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.codeElement.addEventListener('input', (event) => {
            this.highlight();
            this.syncToTextarea();
            this.inputListeners.forEach((listener) => listener(event));
        });

        this.codeElement.addEventListener('paste', (event) => {
            event.preventDefault();
            const text = (event.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        this.codeElement.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                event.preventDefault();
                document.execCommand('insertText', false, '    ');
            }

            if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'u'].includes(event.key)) {
                event.preventDefault();
            }
        });
    }

    highlight() {
        const cursorOffset = this.getCursorOffset();
        Prism.highlightElement(this.codeElement);
        if (cursorOffset !== null) {
            this.setCursorOffset(cursorOffset);
        }
    }

    getCursorOffset() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const preRange = range.cloneRange();
        preRange.selectNodeContents(this.codeElement);
        preRange.setEnd(range.endContainer, range.endOffset);
        return preRange.toString().length;
    }

    setCursorOffset(offset) {
        const selection = window.getSelection();
        if (!selection) {
            return;
        }

        const range = document.createRange();
        let currentOffset = 0;

        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const length = node.textContent.length;
                if (currentOffset + length >= offset) {
                    range.setStart(node, offset - currentOffset);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    return true;
                }
                currentOffset += length;
                return false;
            }

            for (const child of node.childNodes) {
                if (walk(child)) {
                    return true;
                }
            }
            return false;
        };

        walk(this.codeElement);
    }

    syncToTextarea() {
        this.textarea.value = this.codeElement.textContent;
    }

    get value() {
        return this.codeElement.textContent;
    }

    set value(text) {
        this.codeElement.textContent = text;
        this.highlight();
        this.syncToTextarea();
    }

    addEventListener(event, listener) {
        if (event === 'input') {
            this.inputListeners.push(listener);
            return;
        }
        this.codeElement.addEventListener(event, listener);
    }

    focus() {
        this.codeElement.focus();
    }

    blur() {
        this.codeElement.blur();
    }

    destroy() {
        this.textarea.style.display = '';
        if (this.container) {
            this.container.remove();
        }
    }
}
