import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHighlightUpdates } from '../../modules/graph-highlighting.js';
import { GraphUtils } from '../../modules/graph-utils.js';

// conflict_cycle, extension 1: in = {climate, welfare}, out = {growth}, the
// climate->welfare attack discarded. successfulAttacks is EMPTY to emulate
// projection mode (whose #show omits attacks_successfully_with_weight).
function fixture() {
    const networkData = {
        nodes: {
            get: () => [
                { id: 'climate', isAssumption: true, color: { background: '#667eea' } },
                { id: 'welfare', isAssumption: true, color: { background: '#667eea' } },
                { id: 'growth', isAssumption: true, color: { background: '#667eea' } },
                { id: '⊤', isTop: true, color: { background: '#667eea' } }
            ]
        },
        edges: {
            get: () => [
                { id: 'wg', from: 'welfare', to: 'growth', attackingElement: 'welfare', targetAssumption: 'growth', contrary: 'against_growth', attackType: 'derived', color: { color: GraphUtils.palette().line } },
                { id: 'cw', from: 'climate', to: 'welfare', attackingElement: 'climate', targetAssumption: 'welfare', contrary: 'against_welfare', attackType: 'derived', color: { color: GraphUtils.palette().line } },
                { id: 'gc', from: 'growth', to: 'climate', attackingElement: 'growth', targetAssumption: 'climate', contrary: 'against_climate', attackType: 'derived', color: { color: GraphUtils.palette().line } }
            ]
        }
    };
    return buildHighlightUpdates(networkData, ['climate', 'welfare'], [{ source: 'against_welfare', via: 'welfare' }], []);
}

const nodeBg = (updates, id) => {
    const u = updates.find((n) => n.id === id);
    return u ? u.color.background : null;
};
const edgeColor = (updates, id) => updates.find((e) => e.id === id)?.color?.color;

test('IN assumptions are filled, OUT assumptions are hollow', () => {
    const { nodeUpdates } = fixture();
    const p = GraphUtils.palette();
    // IN is a filled surface plus the loudest achromatic border -- not a green, which already
    // meant three other things on this canvas (junction node, joint edge, "success").
    assert.equal(nodeBg(nodeUpdates, 'climate'), p.surfaceIn, 'climate is IN -> filled');
    assert.equal(nodeBg(nodeUpdates, 'welfare'), p.surfaceIn, 'welfare is IN -> filled');
    assert.equal(nodeBg(nodeUpdates, 'growth'), GraphUtils.palette().canvas,
        'growth is OUT -> hollow, not a filled surface');
});

test('the ⊤ node has no in/out status (left untouched)', () => {
    const { nodeUpdates } = fixture();
    assert.equal(nodeUpdates.find((n) => n.id === '⊤'), undefined);
});

test('active attack is red even when successfulAttacks is empty (projection mode)', () => {
    const { edgeUpdates } = fixture();
    // welfare is IN and derives against_growth -> the attack on growth is active.
    assert.equal(edgeColor(edgeUpdates, 'wg'), GraphUtils.palette().active,
        'welfare->growth must be active');
});

test('the three attack states are pairwise distinct on colour AND a second channel', () => {
    const { edgeUpdates } = fixture();
    const p = GraphUtils.palette();
    const at = (id) => edgeUpdates.find((e) => e.id === id);
    const lands = at('wg');       // welfare IN, derives against_growth
    const conceded = at('cw');    // discarded
    const dormant = at('gc');     // growth OUT, so its attack never launches

    assert.equal(conceded.color.color, p.conceded,
        'conceded is its own hue: it was PAID FOR out of the budget, it is not debris');
    assert.equal(dormant.color.color, p.dim, 'never-launched recedes');

    // Distinct colours...
    const hues = new Set([lands.color.color, conceded.color.color, dormant.color.color]);
    assert.equal(hues.size, 3, 'all three states must differ in colour');

    // ...and separable without colour at all, for a colour-blind reader and for greyscale.
    assert.ok(lands.width > dormant.width, 'an attack that lands outweighs one that never fired');
    assert.ok(lands.width >= conceded.width,
        'the paid-off attack must not be HEAVIER than the one that lands');
    assert.ok(Array.isArray(conceded.dashes), 'conceded is dashed');
    assert.equal(lands.dashes, false);
    assert.equal(dormant.dashes, false);

    // Opaque, never alpha: at 20% two crossing dormant edges composited BRIGHTER than one.
    assert.ok(!/^rgba\(/.test(dormant.color.color), 'dormant must be opaque, not faded alpha');

    // Geometry is never touched by state -- that is what made a conceded edge straighten
    // while its neighbours stayed curved.
    [lands, conceded, dormant].forEach((e) => {
        assert.equal(e.smooth, undefined, `${e.id}: state must not rewrite edge geometry`);
    });
});

test('joint attack is active iff every contributor is IN; fact attacks are always active', () => {
    const networkData = {
        nodes: { get: () => [] },
        edges: {
            get: () => [
                { id: 'joint_in', to: 'z', targetAssumption: 'z', contrary: 'cz', attackType: 'joint', jointWith: ['a', 'b'], color: { color: GraphUtils.palette().line } },
                { id: 'joint_out', to: 'z', targetAssumption: 'z', contrary: 'cz2', attackType: 'joint', jointWith: ['a', 'c'], color: { color: GraphUtils.palette().line } },
                { id: 'fact', from: '⊤', to: 'z', attackType: 'fact', contrary: 'cf', targetAssumption: 'z', color: { color: GraphUtils.palette().line } }
            ]
        }
    };
    const { edgeUpdates } = buildHighlightUpdates(networkData, ['a', 'b'], [], []);
    assert.equal(edgeColor(edgeUpdates, 'joint_in'), GraphUtils.palette().active, '{a,b} both IN -> active');
    assert.equal(edgeColor(edgeUpdates, 'joint_out'), GraphUtils.palette().dim, '{a,c} (c OUT) -> dormant');
    assert.equal(edgeColor(edgeUpdates, 'fact'), GraphUtils.palette().active, 'fact attack is always active');
});

test('parallel edges never share geometry, and self-loops never share an angle', () => {
    // The user-visible bug: two edges between the same pair traced the IDENTICAL path, so one
    // was invisible -- and unclickable, since vis hit-tests the first match. A fixed global
    // `smooth` cannot separate them; vis only fans parallel edges for type 'dynamic'.
    const edges = [
        { id: 'a1', from: 'A', to: 'B' },
        { id: 'a2', from: 'A', to: 'B' },   // same ordered pair as a1
        { id: 'a3', from: 'A', to: 'B' },
        { id: 'b1', from: 'B', to: 'A' },   // the MUTUAL direction
        { id: 'l1', from: 'C', to: 'C' },   // self-loops on one node
        { id: 'l2', from: 'C', to: 'C' },
        { id: 'l3', from: 'C', to: 'C' }
    ];
    GraphUtils.assignEdgeGeometry(edges);

    const at = (id) => edges.find((e) => e.id === id);
    const bundle = ['a1', 'a2', 'a3'].map((id) => at(id).smooth.roundness);
    assert.equal(new Set(bundle).size, 3, 'a bundle of parallel edges must nest, not coincide');
    assert.deepEqual([...bundle].sort((x, y) => x - y), bundle, 'and it must nest monotonically');

    // One handedness for the whole graph: curvedCW always bows LEFT OF TRAVEL, so A->B and
    // B->A separate onto opposite absolute sides for free. curvedCCW's sag saturates around
    // roundness 0.5 and then decreases, so a two-family ladder would not be monotonic.
    assert.ok(edges.every((e) => e.from === e.to || e.smooth.type === 'curvedCW'),
        'one curve family, so the ladder is monotonic and the swirl is consistent');

    const angles = ['l1', 'l2', 'l3'].map((id) => at(id).selfReference.angle);
    assert.equal(new Set(angles).size, 3,
        'vis parks every self-loop of a node at one fixed angle, hiding all but the first');
    assert.ok(['l1', 'l2', 'l3'].every((id) => at(id).selfReference.size > 20),
        'and at a fixed 20px, which is a scratch on a node-sized box');
});
