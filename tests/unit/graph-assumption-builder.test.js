import test from 'node:test';
import assert from 'node:assert/strict';

// The builder calls GraphUtils.getFontColor() -> document during build; stub it.
globalThis.document ??= { documentElement: { getAttribute: () => 'dark' } };

const { buildDirectAssumptionGraph, buildBranchingAssumptionGraph } =
    await import('../../modules/graph-assumption-builder.js');
const { ParserUtils } = await import('../../modules/parser-utils.js');

const derivedNode = (g, atom) => g.visNodes.find((n) => n.isDerived && n.atom === atom);
const attackTo = (g, target) => g.visEdges.find((e) => e.to === target
    && (e.attackType === 'derived' || e.attackType === 'direct'));
const supportEdge = (g, from, to) => g.visEdges.find((e) => e.attackType === 'support' && e.from === from && e.to === to);

test('Branching renders the derivation CHAIN: intermediate atom becomes its own node', () => {
    // contrary(a,c). c <- x. x <- b.   ==> b -> arg_x -> arg_c -> (attacks) a.
    const assumptions = ['a', 'b'];
    const contraries = [{ assumption: 'a', contrary: 'c' }, { assumption: 'b', contrary: 'nb' }];
    const rules = [{ id: 'r1', head: 'c', body: ['x'] }, { id: 'r2', head: 'x', body: ['b'] }];
    const g = buildBranchingAssumptionGraph(assumptions, contraries, rules, { a: 5, b: 7 });

    assert.ok(derivedNode(g, 'x'), 'the intermediate atom x must be drawn as its own (derived) node');
    assert.ok(derivedNode(g, 'c'), 'the contrary c must be drawn as a derived node');
    assert.ok(supportEdge(g, 'b', 'arg_x'), 'a support edge b -> arg_x must exist');
    const atk = attackTo(g, 'a');
    assert.ok(atk, 'an attack edge into a must exist');
    assert.equal(atk.contrary, 'c', 'the attack carries its contrary for highlight matching');
    assert.equal(atk.label, '7', 'a single-premise chain carries the leaf weight (⊗ of one element)');
    assert.deepEqual(g.isolatedNodes.map((n) => n.id), [], 'no genuinely-attacked assumption should be isolated');
});

test('Branching: a multi-premise step becomes an AND-junction feeding the derived claim', () => {
    // contrary(a,c). c <- b1, x. x <- b2.   ==> junction(b1, x) -> arg_c ; b2 -> arg_x -> junction.
    const assumptions = ['a', 'b1', 'b2'];
    const contraries = [
        { assumption: 'a', contrary: 'c' },
        { assumption: 'b1', contrary: 'n1' },
        { assumption: 'b2', contrary: 'n2' }
    ];
    const rules = [{ id: 'r1', head: 'c', body: ['b1', 'x'] }, { id: 'r2', head: 'x', body: ['b2'] }];
    const g = buildBranchingAssumptionGraph(assumptions, contraries, rules, {});

    const junction = g.visNodes.find((n) => n.isJunction);
    assert.ok(junction, 'a junction must represent the multi-premise rule c <- b1, x');
    assert.deepEqual([...junction.attackers].sort(), ['b1', 'x'], 'the junction spans the rule body b1 and x');
    assert.ok(derivedNode(g, 'x'), 'the nested intermediate x is its own derived node');
    assert.ok(!g.isolatedNodes.some((n) => n.id === 'b2'), 'b2 (feeding x) must not be shown as isolated');
});

test('Branching: a 2-level debate-style chain renders every intermediate claim', () => {
    // c <- m1, m2 ;  m1 <- b1, b2 ;  m2 <- b3      (like evidence -> claims -> refutation)
    const assumptions = ['a', 'b1', 'b2', 'b3'];
    const contraries = [{ assumption: 'a', contrary: 'c' }];
    const rules = [
        { id: 'r1', head: 'c', body: ['m1', 'm2'] },
        { id: 'r2', head: 'm1', body: ['b1', 'b2'] },
        { id: 'r3', head: 'm2', body: ['b3'] }
    ];
    const g = buildBranchingAssumptionGraph(assumptions, contraries, rules, {});
    ['m1', 'm2', 'c'].forEach((atom) => assert.ok(derivedNode(g, atom), `${atom} must be a derived claim node`));
    assert.ok(attackTo(g, 'a'), 'the top of the chain (c) attacks the stance a');
    // Two AND-junctions: one for c <- m1,m2 and one for m1 <- b1,b2.
    assert.equal(g.visNodes.filter((n) => n.isJunction).length, 2, 'two multi-premise steps -> two junctions');
});

test('Direct mode distinguishes joint (AND) from disjunctive (OR) by terminator', () => {
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
    // Kind is carried by the TERMINATOR, not by hue -- hue belongs to the three attack
    // states. The '∧' label is gone: `align:'middle'` rotated it into a false mid-edge
    // arrowhead that could point the opposite way to the edge carrying it.
    assert.ok(jointEdges.every((e) => e.arrows?.to?.type === 'bar'),
        'joint contributions must end in a bar (needs its partners), not an arrowhead');
    assert.ok(jointEdges.every((e) => e.label === ''), 'the rotating ∧ label must be gone');

    // disjunction: c <- b1.  c <- b2.
    const disj = buildDirectAssumptionGraph(assumptions, contraries,
        [{ id: 'r1', head: 'c', body: ['b1'] }, { id: 'r2', head: 'c', body: ['b2'] }], weights);
    const disjEdges = disj.visEdges.filter((e) => e.to === 'a');
    assert.ok(disjEdges.every((e) => e.arrows?.to?.type === 'arrow'),
        'an independent attack lands on its own, so it ends in a filled arrowhead');
    assert.deepEqual(disjEdges.map((e) => e.label).sort(), ['3', '4'],
        'disjunctive edges carry their leaf weights');
});

test('Branching single-premise derived attack carries the leaf weight (issue #4)', () => {
    // contrary(climate, against_climate). against_climate <- growth. weight(growth,8).
    const g = buildBranchingAssumptionGraph(['growth', 'climate'],
        [{ assumption: 'climate', contrary: 'against_climate' }],
        [{ id: 'r1', head: 'against_climate', body: ['growth'] }], { growth: 8, climate: 3 });
    const edge = attackTo(g, 'climate');
    assert.equal(edge.label, '8');
    assert.equal(edge.weight, 8);
    assert.ok(supportEdge(g, 'growth', 'arg_against_climate'), 'growth supports the derived claim, not attacks climate directly');
});

test('Branching joint attack does not fabricate a semiring-dependent aggregate weight (issue #4)', () => {
    const g = buildBranchingAssumptionGraph(['a', 'b1', 'b2'],
        [{ assumption: 'a', contrary: 'c' }],
        [{ id: 'r1', head: 'c', body: ['b1', 'b2'] }], { b1: 3, b2: 4 });
    const atk = attackTo(g, 'a');
    assert.equal(atk.label, '', 'no fabricated aggregate weight on a multi-leaf attack');
    assert.equal(atk.weight, '?');
    assert.ok(g.visNodes.some((n) => n.isJunction), 'the joint step is drawn as a junction');
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

test('a weighted intermediate argument shows its weight on the derived node label', () => {
    // theory competition: arg (weighted) derives the rival's contrary.
    const g = buildBranchingAssumptionGraph(['t_acc', 't_riv', 'obs'],
        [{ assumption: 't_acc', contrary: 'c_acc' }, { assumption: 't_riv', contrary: 'c_riv' }, { assumption: 'obs', contrary: 'x' }],
        [{ id: 'd1', head: 'arg', body: ['obs'] }, { id: 'r1', head: 'c_riv', body: ['arg'] }],
        { arg: 12 });
    const argNode = g.visNodes.find((n) => n.isDerived && n.atom === 'arg');
    assert.ok(argNode, 'the weighted argument must be a derived node');
    assert.match(argNode.label, /w:\s*12/, 'a weighted argument shows its weight on the label');
    const claimNode = g.visNodes.find((n) => n.isDerived && n.atom === 'c_riv');
    assert.equal(claimNode.label, 'c_riv', 'a purely-propagated (unweighted) claim shows no weight');
});

test('an unattacked assumption (underivable contrary) stays isolated', () => {
    // contrary(a, ca) but ca has no deriving rule and is not an assumption.
    const g = buildBranchingAssumptionGraph(['a'], [{ assumption: 'a', contrary: 'ca' }], [], {});
    assert.equal(g.visEdges.length, 0, 'no attack edge when the contrary can never be supported');
    assert.deepEqual(g.isolatedNodes.map((n) => n.id), ['a']);
    assert.ok(!g.visNodes.some((n) => n.isTop), 'an underivable contrary must NOT be drawn as a ⊤ fact attack');
});

test('a commented-out fact never reaches the graph', () => {
    // The parsers strip comments themselves now. When it was the caller's job, output-manager
    // stripped and the three graph builders did not, so a rule the user had disabled still
    // drew an attack the framework does not license, and a disabled assumption inflated the
    // count that trips the set-graph cap.
    const src = [
        'assumption(a). assumption(b).',
        'contrary(a,na). contrary(b,nb).',
        '% head(r1, na). body(r1, b).',
        'head(r2, nb). body(r2, a).',
        '% assumption(f).'
    ].join('\n');
    assert.deepEqual(ParserUtils.parseRules(src).map((r) => r.id), ['r2']);
    assert.deepEqual(ParserUtils.parseAssumptions(src), ['a', 'b']);
});

test('branching draws one attack edge per alternative derivation, each with its own weight', () => {
    // It drew ONE edge keyed on leafSets[0] -- an arbitrary support -- so on a disjunctive
    // contrary the attack that decides the extension could be drawn dormant with the wrong
    // number on it. Direct mode always got this right; the two must agree.
    const assumptions = ['a', 'b', 'c'];
    const contraries = [{ assumption: 'c', contrary: 'nc' }];
    const rules = [{ id: 'r1', head: 'nc', body: ['a'] }, { id: 'r2', head: 'nc', body: ['b'] }];
    const weights = { a: 5, b: 7 };

    const seen = (graph) => graph.visEdges
        .filter((e) => e.targetAssumption === 'c')
        .map((e) => `${e.label}:${(e.jointWith || []).join('+')}`).sort();

    assert.deepEqual(seen(buildBranchingAssumptionGraph(assumptions, contraries, rules, weights)),
        ['5:a', '7:b'], 'both derivations must be drawn, each labelled with its own leaf');
    assert.deepEqual(seen(buildDirectAssumptionGraph(assumptions, contraries, rules, weights)).length,
        2, 'and direct mode must still agree');
});

test('a derivation cycle draws nothing, because the solver rejects the framework', () => {
    // renderSupport seeded its cache with the derived id BEFORE recursing, so a cycle resolved
    // to a non-null node: support edges in both directions plus a complete attack, supported by
    // a self-supporting loop. core/base.lp rejects such a framework outright.
    const graph = buildBranchingAssumptionGraph(['a'], [{ assumption: 'a', contrary: 'na' }],
        [{ id: 'r1', head: 'na', body: ['m'] }, { id: 'r2', head: 'm', body: ['na'] }], { a: 1 });
    assert.deepEqual(graph.visEdges, [], 'a well-foundedness violation must draw no attack');
});

test('support edges carry the leaves that feed them', () => {
    // graph-highlighting fades a branch that never fired by reading edge.leafSet. Nothing
    // populated it, so every support edge was drawn as carrying and the classification -- the
    // whole reason branching mode reacts to a selection -- was dead.
    const graph = buildBranchingAssumptionGraph(['a', 'b'], [{ assumption: 'b', contrary: 'nb' }],
        [{ id: 'r1', head: 'nb', body: ['p'] }, { id: 'r2', head: 'p', body: ['a'] }], { a: 5, b: 3 });
    const support = graph.visEdges.filter((e) => e.attackType === 'support');
    assert.ok(support.length > 0);
    assert.ok(support.every((e) => Array.isArray(e.leafSet) && e.leafSet.length > 0),
        'every support edge must know which assumptions carry it');
});

test('a single-leaf attack label follows the algebra, not just the leaf', () => {
    // core/base.lp derives supported_with_weight from an explicit weight/2 on the DERIVED atom
    // too, and oplus combines the two: under oplus=min the declared weight wins. The label was
    // fixed at the leaf's weight for every algebra. Ground truth from bin/waba on this exact
    // framework: godel reports 5, tropical reports 2.
    const args = [['a', 'b'], [{ assumption: 'b', contrary: 'nb' }],
        [{ id: 'r1', head: 'nb', body: ['a'] }], { a: 5, nb: 2 }];
    const label = (polarity) => buildDirectAssumptionGraph(...args, polarity)
        .visEdges.filter((e) => e.to === 'b')[0].label;
    assert.equal(label('higher'), '5', 'strength: oplus = max');
    assert.equal(label('lower'), '2', 'cost: oplus = min, so the declared weight wins');
});
