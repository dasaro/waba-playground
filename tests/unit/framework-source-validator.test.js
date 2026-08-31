import test from 'node:test';
import assert from 'node:assert/strict';

import { validateFrameworkSource } from '../../runtime/config-service.js';

test('ground pooled facts, structured terms, strings, constants and comments are accepted', () => {
    const source = `
        % in(a). is only a comment
        %* weight(a,999). #show in/1. *%
        #const scale = 7.
        assumption(a; f(2,"quoted.value")).
        contrary(a,ca; f(2,"quoted.value"),cf).
        head(r(1),ca; r(2),cf). body(r(1),f(2,"quoted.value")).
        weight(a,scale; f(2,"quoted.value"),2).
    `;
    assert.equal(validateFrameworkSource(source), null);
});

test('rules, constraints and every solver directive are rejected before composition', () => {
    const cases = [
        ['weight(a,1) :- in(a).', /rules and constraints/],
        [':- out(a).', /rules and constraints/],
        ['#show in/1.', /directive "#show"/],
        ['#project in/1.', /directive "#project"/],
        ['#minimize { 1@1,a : in(a) }.', /directive "#minimize"/],
        ['#program injected.', /directive "#program"/],
        ['#external in(a).', /directive "#external"/],
        ['#const max=min.', /would rewrite an implementation term/]
    ];
    for (const [source, expected] of cases) {
        assert.match(validateFrameworkSource(source), expected, source);
    }
});

test('reserved, unknown, non-ground and wrong-arity facts are rejected', () => {
    const cases = [
        ['in(a).', /reserved implementation predicate/],
        ['discarded_attack(ca,a,0).', /reserved implementation predicate/],
        ['budget(0).', /not a framework predicate/],
        ['assumption(X).', /must be ground/],
        ['assumption(a,b).', /expects arity 1/],
        ['contrary(a; b,cb).', /contains arity 1, 2/]
    ];
    for (const [source, expected] of cases) {
        assert.match(validateFrameworkSource(source), expected, source);
    }
});

test('includes are recursively supported by the CLI but explicitly refused in a browser upload', () => {
    const include = '#include "facts.lp".';
    assert.match(validateFrameworkSource(include), /no local include filesystem/);
    assert.match(validateFrameworkSource(include), /#include is CLI-only/);
    assert.equal(validateFrameworkSource(include, '<framework>', { allowIncludes: true }), null);
});

test('ordinary constants and caller-authoritative beta/k remain legal', () => {
    assert.equal(validateFrameworkSource(
        '#const scale=7. #const beta=3. #const k=11. '
        + 'assumption(a). contrary(a,ca). weight(a,scale).'
    ), null);
});

test('a UTF-8 BOM is not whitespace: the CLI and clingo both reject it, so must we', () => {
    const bom = '﻿assumption(a). contrary(a,ca).';
    assert.match(validateFrameworkSource(bom), /expected a ground data fact/);
});
