import { wabaModules } from '../waba-modules.js?v=20260831-1';

const POLICY = wabaModules.metadata.inputPolicy;

function outsideStrings(text) {
    let result = '';
    let quote = false;
    let escaped = false;
    for (const char of text) {
        if (quote) {
            result += ' ';
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quote = false;
        } else if (char === '"') {
            quote = true;
            result += ' ';
        } else {
            result += char;
        }
    }
    return result;
}

function isGround(term) {
    return !/(?<![A-Za-z0-9_])[A-Z_][A-Za-z0-9_]*/.test(outsideStrings(term));
}

function splitTopLevel(text, separator) {
    const pieces = [];
    let start = 0;
    let depth = 0;
    let quote = false;
    let escaped = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quote = false;
            continue;
        }
        if (char === '"') quote = true;
        else if (char === '(' || char === '[') depth += 1;
        else if (char === ')' || char === ']') depth -= 1;
        else if (char === separator && depth === 0) {
            pieces.push(text.slice(start, index).trim());
            start = index + 1;
        }
    }
    pieces.push(text.slice(start).trim());
    return pieces;
}

function arityAlternatives(argumentsText) {
    if (argumentsText === undefined) return [0];
    return splitTopLevel(argumentsText, ';').map((alternative) => (
        alternative ? splitTopLevel(alternative, ',').length : 0
    ));
}

function scanStatements(source, label) {
    let cleaned = '';
    let quote = false;
    let escaped = false;
    let lineComment = false;
    let blockDepth = 0;

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1] || '';
        if (lineComment) {
            if (char === '\n') {
                lineComment = false;
                cleaned += char;
            } else cleaned += ' ';
            continue;
        }
        if (blockDepth) {
            if (char === '%' && next === '*') {
                blockDepth += 1;
                cleaned += '  ';
                index += 1;
            } else if (char === '*' && next === '%') {
                blockDepth -= 1;
                cleaned += '  ';
                index += 1;
            } else cleaned += char === '\n' ? '\n' : ' ';
            continue;
        }
        if (quote) {
            cleaned += char;
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quote = false;
            continue;
        }
        if (char === '%' && next === '*') {
            blockDepth = 1;
            cleaned += '  ';
            index += 1;
        } else if (char === '%') {
            lineComment = true;
            cleaned += ' ';
        } else {
            if (char === '"') quote = true;
            cleaned += char;
        }
    }
    if (blockDepth) throw new Error(`${label}: unterminated block comment`);
    if (quote) throw new Error(`${label}: unterminated quoted string`);

    const statements = [];
    let start = null;
    let startLine = 1;
    let startColumn = 1;
    let line = 1;
    let column = 1;
    let roundDepth = 0;
    let squareDepth = 0;
    let braceDepth = 0;
    quote = false;
    escaped = false;

    for (let index = 0; index < cleaned.length; index += 1) {
        const char = cleaned[index];
        if (start === null && !/\s/.test(char)) {
            start = index;
            startLine = line;
            startColumn = column;
        }
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quote = false;
        } else {
            // JS \s and .trim() treat U+FEFF as whitespace, but Python's isspace() and
            // clingo's lexer both reject it, so silently absorbing it here ACCEPTED files
            // the CLI refuses (a BOM from a Windows editor being the realistic case).
            if (char === '\uFEFF') {
                throw new Error(`${label}:${line}:${column}: expected a ground data fact, `
                    + 'found the byte-order mark U+FEFF (not whitespace to clingo)');
            }
            if (char === '"') quote = true;
            else if (char === '(') roundDepth += 1;
            else if (char === ')') roundDepth -= 1;
            else if (char === '[') squareDepth += 1;
            else if (char === ']') squareDepth -= 1;
            else if (char === '{') braceDepth += 1;
            else if (char === '}') braceDepth -= 1;
            if (Math.min(roundDepth, squareDepth, braceDepth) < 0) {
                throw new Error(`${label}:${line}:${column}: unmatched closing delimiter`);
            }
            const previous = cleaned[index - 1] || '';
            const next = cleaned[index + 1] || '';
            const terminator = char === '.' && roundDepth === 0 && squareDepth === 0
                && braceDepth === 0 && previous !== '.' && next !== '.';
            if (terminator && start !== null) {
                const text = cleaned.slice(start, index).trim();
                if (text) statements.push({ text, line: startLine, column: startColumn });
                start = null;
            }
        }
        if (char === '\n') {
            line += 1;
            column = 1;
        } else column += 1;
    }
    if (roundDepth || squareDepth || braceDepth) throw new Error(`${label}: unclosed delimiter`);
    if (start !== null && cleaned.slice(start).trim()) {
        throw new Error(`${label}:${startLine}:${startColumn}: statement is missing its final '.'`);
    }
    return statements;
}

function validateStatement(statement, label, allowIncludes) {
    const text = statement.text.trim();
    const location = `${label}:${statement.line}:${statement.column}`;
    if (/^#include\s+"[^"\\]+"$/s.test(text)) {
        return allowIncludes ? null : `${location}: #include is valid in the CLI, but a `
            + 'standalone browser upload has no local include filesystem; paste or upload the '
            + 'expanded facts instead';
    }

    const constant = text.match(/^#const\s+([a-z][A-Za-z0-9_]*)\s*=\s*(.+)$/s);
    if (constant) {
        const name = constant[1];
        if (POLICY.reservedConstants.includes(name)) {
            return `${location}: #const ${name} would rewrite an implementation term and is reserved`;
        }
        const value = constant[2].trim();
        if (!value || !isGround(value)) return `${location}: #const values must be ground`;
        const visible = outsideStrings(value);
        if ([':-', ':~', '{', '}', '@'].some((token) => visible.includes(token))) {
            return `${location}: unsupported construct in #const value`;
        }
        return null;
    }
    if (text.startsWith('#')) {
        const directive = text.split(/\s/, 1)[0];
        return `${location}: directive "${directive}" is not accepted; only #const and `
            + '#include belong to framework data';
    }

    const visible = outsideStrings(text);
    if (visible.includes(':-') || visible.includes(':~')) {
        return `${location}: ASP rules and constraints are not accepted; encode ABA rules as `
            + 'ground head/2 and body/2 facts';
    }
    if (['{', '}', '|', '@', '[', ']', ':'].some((token) => visible.includes(token))) {
        return `${location}: choice, disjunctive, conditional, external, and aggregate facts `
            + 'are not accepted';
    }

    const fact = text.match(/^([a-z][A-Za-z0-9_]*)\s*(?:\((.*)\))?$/s);
    if (!fact) return `${location}: expected a ground data fact`;
    const predicate = fact[1];
    const argumentsText = fact[2];
    if (!isGround(argumentsText || '')) {
        return `${location}: data facts must be ground (variables are not accepted)`;
    }

    const expected = POLICY.frameworkPredicates[predicate];
    if (expected !== undefined) {
        const actual = arityAlternatives(argumentsText);
        if (actual.some((arity) => arity !== expected)) {
            const rendered = [...new Set(actual)].sort((a, b) => a - b).join(', ');
            return `${location}: ${predicate} expects arity ${expected}, but this pool contains `
                + `arity ${rendered}`;
        }
        return null;
    }
    if (POLICY.reservedPredicates.includes(predicate)) {
        return `${location}: ${predicate} is a reserved implementation predicate and cannot `
            + 'be authored by a framework';
    }
    const allowed = Object.keys(POLICY.frameworkPredicates).sort().join(', ');
    return `${location}: ${predicate} is not a framework predicate; accepted facts are exactly `
        + allowed;
}

/**
 * Validate the browser's accepted framework source language before any solver module is added.
 * Bundled examples have includes expanded by the generator. A standalone browser upload has
 * no local include filesystem and is refused with a specific instruction to expand it first.
 *
 * @param {string} source
 * @param {string} [label]
 * @param {{ allowIncludes?: boolean }} [options]
 * @returns {string|null}
 */
export function validateFrameworkSource(source, label = '<framework>', options = {}) {
    const allowIncludes = options.allowIncludes === true;
    const accepted = allowIncludes
        ? 'the five ground framework predicates, comments, #const, and #include'
        : 'the five ground framework predicates, comments, and #const (#include is CLI-only)';
    try {
        for (const statement of scanStatements(source, label)) {
            const error = validateStatement(statement, label, allowIncludes);
            if (error) return `Unsafe framework source: ${error}. This boundary accepts exactly `
                + `${accepted}.`;
        }
    } catch (error) {
        return `Unsafe framework source: ${error.message}. This boundary accepts exactly `
            + `${accepted}.`;
    }
    return null;
}
