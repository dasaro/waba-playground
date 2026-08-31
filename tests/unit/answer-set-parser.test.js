import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPredicate, parseAnswerSet, splitTopLevelArgs } from '../../runtime/answer-set-parser.js';

// This module had NO unit test, and its argument regexes were all `[^)]+` / `[^,]+`, which stop
// at the first `)`. Function terms are legal ASP that core/base.lp handles and bin/waba gets
// right, so a framework using them parsed to nothing: every result card rendered with no
// assumption chips, clicking one highlighted nothing, and clingo-manager emitted no member/2
// facts, which silently collapsed `preferred` onto `admissible`.

test('matchPredicate respects nesting', () => {
    assert.equal(matchPredicate('in(flies(tweety))', 'in'), 'flies(tweety)');
    assert.equal(matchPredicate('in(plain)', 'in'), 'plain');
    assert.equal(matchPredicate('out(a)', 'in'), null);
    assert.equal(matchPredicate('inx(a)', 'in'), null, 'must not match a longer functor');
    assert.equal(matchPredicate('in(a), foo(b)', 'in'), null, 'the parens must be the matching pair');
    assert.equal(matchPredicate('in(', 'in'), null);
});

test('splitTopLevelArgs ignores commas inside a term', () => {
    assert.deepEqual(splitTopLevelArgs('a, f(b, c), d'), ['a', 'f(b, c)', 'd']);
});

test('term parsing ignores punctuation inside quoted ASP strings', () => {
    assert.equal(matchPredicate('in("a,) with \\"quote\\"")', 'in'), '"a,) with \\"quote\\""');
    assert.deepEqual(
        splitTopLevelArgs('f("x,y)"), "target,(one)", 7'),
        ['f("x,y)")', '"target,(one)"', '7']
    );
});

test('parseAnswerSet reads function-term atoms', () => {
    const parsed = parseAnswerSet([
        'in(flies(tweety))', 'in(plain)', 'out(normal(tweety))',
        'contrary(believes(tom), neg(believes(tom)))',
        'head(r1, ab(tweety))', 'body(r1, flies(tweety))',
        'budget_value(7)'
    ]);
    assert.deepEqual(parsed.in, ['flies(tweety)', 'plain']);
    assert.deepEqual(parsed.out, ['normal(tweety)']);
    assert.equal(parsed.contraries.get('believes(tom)'), 'neg(believes(tom))');
    assert.deepEqual(parsed.rules.get('r1'), { head: 'ab(tweety)', body: ['flies(tweety)'] });
    assert.equal(parsed.budgetValue, '7');
});

test('parseAnswerSet still reads the ordinary flat case', () => {
    const parsed = parseAnswerSet(['in(a)', 'in(b)', 'out(c)', 'discarded_attack(x,c,5)']);
    assert.deepEqual(parsed.in, ['a', 'b']);
    assert.deepEqual(parsed.out, ['c']);
    assert.equal(parsed.discarded.length, 1);
});
