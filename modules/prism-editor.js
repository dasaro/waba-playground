/**
 * PrismEditor - Contenteditable wrapper with syntax highlighting
 * Provides textarea-like API with Prism.js syntax highlighting
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
        // Create container structure: <div><pre><code contenteditable></code></pre></div>
        this.container = document.createElement('div');
        this.container.className = 'prism-editor-container';

        this.preElement = document.createElement('pre');
        this.preElement.className = 'prism-editor-pre';

        this.codeElement = document.createElement('code');
        this.codeElement.className = `language-${this.language} prism-editor-code`;
        this.codeElement.contentEditable = 'true';
        this.codeElement.spellcheck = false;

        // Copy initial value from textarea
        const initialValue = this.textarea.value;
        this.codeElement.textContent = initialValue;

        // Apply syntax highlighting
        Prism.highlightElement(this.codeElement);

        // Build structure
        this.preElement.appendChild(this.codeElement);
        this.container.appendChild(this.preElement);

        // Replace textarea with container
        this.textarea.style.display = 'none';
        this.textarea.parentNode.insertBefore(this.container, this.textarea.nextSibling);

        // Set up event handlers
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Handle input events
        this.codeElement.addEventListener('input', (e) => {
            // Update syntax highlighting
            this.highlight();

            // Sync back to textarea
            this.syncToTextarea();

            // Trigger input event listeners
            this.inputListeners.forEach(listener => listener(e));
        });

        // Handle paste - ensure plain text only
        this.codeElement.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        // Prevent formatting shortcuts
        this.codeElement.addEventListener('keydown', (e) => {
            // Tab key: insert 4 spaces
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '    ');
            }

            // Prevent Ctrl+B, Ctrl+I, etc.
            if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i' || e.key === 'u')) {
                e.preventDefault();
            }
        });
    }

    highlight() {
        // Store cursor position
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const cursorOffset = this.getCursorOffset();

        // Re-highlight
        Prism.highlightElement(this.codeElement);

        // Restore cursor position
        if (cursorOffset !== null) {
            this.setCursorOffset(cursorOffset);
        }
    }

    getCursorOffset() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;

        const range = selection.getRangeAt(0);
        const preRange = range.cloneRange();
        preRange.selectNodeContents(this.codeElement);
        preRange.setEnd(range.endContainer, range.endOffset);

        return preRange.toString().length;
    }

    setCursorOffset(offset) {
        const selection = window.getSelection();
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
            } else {
                for (let child of node.childNodes) {
                    if (walk(child)) return true;
                }
            }
            return false;
        };

        walk(this.codeElement);
    }

    syncToTextarea() {
        this.textarea.value = this.codeElement.textContent;
    }

    // Textarea-like API
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
        } else {
            this.codeElement.addEventListener(event, listener);
        }
    }

    focus() {
        this.codeElement.focus();
    }

    blur() {
        this.codeElement.blur();
    }

    destroy() {
        // Restore textarea
        this.textarea.style.display = '';
        this.container.remove();
    }
}
