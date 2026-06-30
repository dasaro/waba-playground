import test from 'node:test';
import assert from 'node:assert/strict';

// The builder calls GraphUtils.getFontColor() -> document during build; stub it.
globalThis.document ??= { documentElement: { getAttribute: () => 'dark' } };

const { buildDirectAssumptionGraph, buildBranchingAssumptionGraph } =
    await import('../../modules/graph-assumption-builder.js');

test('chained attack through a non-assumption atom is drawn, not isolated (issue #1)', () => {
    // contrary(a,c). c <- x. x <- b.   ==> b defeats a through the chain.
    const assumptions = ['a', 'b'];
    const contraries = [{ assumption: 'a', contrary: 'c' }, { assumption: 'b', contrary: 'nb' }];
    const rules = [{ id: 'r1', head: 'c', body: ['x'] }, { id: 'r2', head: 'x', body: ['b'] }];
    const g = buildBranchingAssumptionGraph(assumptions, contraries, rules, { a: 5, b: 7 });

    const edge = g.visEdges.find((e) => e.from === 'b' && e.to === 'a');
    assert.ok(edge, 'b -> a attack edge must exist (the chain must not vanish)');
    assert.equal(edge.label, '7', 'single-premise chain carries the leaf weight');
    assert.deepEqual(g.isolatedNodes.map((n) => n.id), [], 'no genuinely-attacked assumption should be isolated');
});

test('non-assumption conjunct contributes its leaf assumption to the joint (issue #2)', () => {
    // contrary(a,c). c <- b1, x. x <- b2.   ==> the attack needs b1 AND b2.
    const assumptions = ['a', 'b1', 'b2'];
    const contraries = [
        { assumption: 'a', contrary: 'c' },
        { assumption: 'b1', contrary: 'n1' },
        { assumption: 'b2', contrary: 'n2' }
    ];
    const rules = [{ id: 'r1', head: 'c', body: ['b1', 'x'] }, { id: 'r2', head: 'x', body: ['b2'] }];
    const g = buildBranchingAssumptionGraph(assumptions, contraries, rules, {});

    const junction = g.visNodes.find((n) => n.isJunction);
    assert.ok(junction, 'a junction must represent the joint attack');
    assert.deepEqual([...junction.attackers].sort(), ['b1', 'b2'], 'both b1 and b2 must be contributors');
    assert.ok(!g.isolatedNodes.some((n) => n.id === 'b2'), 'b2 must not be shown as isolated/irrelevant');
});

test('Direct mode distinguishes joint (AND) from disjunctive (OR) by marker + colour (issue #3)', () => {
    const assumptions = ['a', 'b1', 'b2'];
    const contraries = [
        { assumption: 'a', contrary: 'c' },
        { assumption: 'b1', contrary: 'n1' },
        { assumption: 'b2', contrary: 'n2' }
    ];
    const weights = { b1: 3, b2: 4 };

    // joint: c <- b1, b2
    const joint = buildDirectAssumptionGraph(assumptions, contraries, [{ id: 'r1', head: 'c', body: ['b1', 'b2'] }], weights);
    const jointEdges = joint.visEdges.filter((e) => e.to === 'a');
    assert.equal(jointEdges.length, 2);
    assert.ok(jointEdges.every((e) => e.label === '∧' && e.color.color === '#10b981'),
        'joint contributions must be green and ∧-marked');

    // disjunction: c <- b1.  c <- b2.
    const disj = buildDirectAssumptionGraph(assumptions, contraries,
        [{ id: 'r1', head: 'c', body: ['b1'] }, { id: 'r2', head: 'c', body: ['b2'] }], weights);
    const disjEdges = disj.visEdges.filter((e) => e.to === 'a');
    assert.ok(disjEdges.every((e) => e.color.color === '#f59e0b'), 'disjunctive attacks must be amber');
    assert.deepEqual(disjEdges.map((e) => e.label).sort(), ['3', '4'],
        'disjunctive edges carry their leaf weights, not the ∧ marker');
});

test('single-premise edge weight is the leaf weight, not a fabricated 1 (issue #4)', () => {
    // contrary(climate, against_climate). against_climate <- growth. weight(growth,8).
    const g = buildBranchingAssumptionGraph(['growth', 'climate'],
        [{ assumption: 'climate', contrary: 'against_climate' }],
        [{ id: 'r1', head: 'against_climate', body: ['growth'] }], { growth: 8, climate: 3 });
    const edge = g.visEdges.find((e) => e.from === 'growth' && e.to === 'climate');
    assert.equal(edge.label, '8');
    assert.equal(edge.weight, 8);
});

test('joint attack edges do not fabricate a semiring-dependent aggregate weight (issue #4)', () => {
    const g = buildBranchingAssumptionGraph(['a', 'b1', 'b2'],
        [{ assumption: 'a', contrary: 'c' }],
        [{ id: 'r1', head: 'c', body: ['b1', 'b2'] }], { b1: 3, b2: 4 });
    const junctionEdge = g.visEdges.find((e) => e.attackType === 'joint' && e.from.startsWith('junction_'));
    assert.equal(junctionEdge.label, '', 'no fabricated aggregate weight on the junction edge');
    assert.equal(junctionEdge.weight, '?');
});

test('empty-body and fact-chained contraries render as ⊤ attacks', () => {
    const fact = buildBranchingAssumptionGraph(['a'], [{ assumption: 'a', contrary: 'c' }],
        [{ id: 'r1', head: 'c', body: [] }], {});
    assert.ok(fact.visNodes.some((n) => n.isTop), 'empty-body contrary is a ⊤ fact attack');

    const factChain = buildBranchingAssumptionGraph(['a'], [{ assumption: 'a', contrary: 'c' }],
        [{ id: 'r1', head: 'c', body: ['x'] }, { id: 'r2', head: 'x', body: [] }], {});
    assert.ok(factChain.visNodes.some((n) => n.isTop), 'a fact reachable through a chain is still a ⊤ attack');
});

test('attack edges carry contrary + targetAssumption for extension-highlight matching', () => {
    const g = buildBranchingAssumptionGraph(['growth', 'climate'],
        [{ assumption: 'climate', contrary: 'against_climate' }],
        [{ id: 'r1', head: 'against_climate', body: ['growth'] }], { growth: 8 });
    const edge = g.visEdges.find((e) => e.to === 'climate');
    assert.equal(edge.contrary, 'against_climate');
    assert.equal(edge.targetAssumption, 'climate');
});

test('an unattacked assumption (underivable contrary) stays isolated', () => {
    // contrary(a, ca) but ca has no deriving rule and is not an assumption.
    const g = buildBranchingAssumptionGraph(['a'], [{ assumption: 'a', contrary: 'ca' }], [], {});
    assert.equal(g.visEdges.length, 0, 'no attack edge when the contrary can never be supported');
    assert.deepEqual(g.isolatedNodes.map((n) => n.id), ['a']);
    assert.ok(!g.visNodes.some((n) => n.isTop), 'an underivable contrary must NOT be drawn as a ⊤ fact attack');
});
