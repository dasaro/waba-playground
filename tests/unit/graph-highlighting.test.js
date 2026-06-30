import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHighlightUpdates } from '../../modules/graph-highlighting.js';

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
                { id: 'wg', from: 'welfare', to: 'growth', attackingElement: 'welfare', targetAssumption: 'growth', contrary: 'against_growth', attackType: 'derived', color: { color: '#f59e0b' } },
                { id: 'cw', from: 'climate', to: 'welfare', attackingElement: 'climate', targetAssumption: 'welfare', contrary: 'against_welfare', attackType: 'derived', color: { color: '#f59e0b' } },
                { id: 'gc', from: 'growth', to: 'climate', attackingElement: 'growth', targetAssumption: 'climate', contrary: 'against_climate', attackType: 'derived', color: { color: '#f59e0b' } }
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

test('in-assumptions are coloured green, out-assumptions grey', () => {
    const { nodeUpdates } = fixture();
    assert.equal(nodeBg(nodeUpdates, 'climate'), '#34d399', 'climate is IN -> green');
    assert.equal(nodeBg(nodeUpdates, 'welfare'), '#34d399', 'welfare is IN -> green');
    assert.equal(nodeBg(nodeUpdates, 'growth'), '#94a3b8', 'growth is OUT -> grey');
});

test('the ⊤ node has no in/out status (left untouched)', () => {
    const { nodeUpdates } = fixture();
    assert.equal(nodeUpdates.find((n) => n.id === '⊤'), undefined);
});

test('active attack is red even when successfulAttacks is empty (projection mode)', () => {
    const { edgeUpdates } = fixture();
    // welfare is IN and derives against_growth -> the attack on growth is active.
    assert.equal(edgeColor(edgeUpdates, 'wg'), '#ef4444', 'welfare->growth must be active/red');
});

test('discarded attack is grey, inactive attack is faded', () => {
    const { edgeUpdates } = fixture();
    assert.equal(edgeColor(edgeUpdates, 'cw'), '#9ca3af', 'climate->welfare discarded -> grey');
    // growth is OUT, so its attack on climate is not supported -> faded, not red/grey.
    const gc = edgeColor(edgeUpdates, 'gc');
    assert.ok(/^rgba\(/.test(gc), 'growth->climate inactive -> faded rgba');
});

test('joint attack is active iff every contributor is IN; fact attacks are always active', () => {
    const networkData = {
        nodes: { get: () => [] },
        edges: {
            get: () => [
                { id: 'joint_in', to: 'z', targetAssumption: 'z', contrary: 'cz', attackType: 'joint', jointWith: ['a', 'b'], color: { color: '#10b981' } },
                { id: 'joint_out', to: 'z', targetAssumption: 'z', contrary: 'cz2', attackType: 'joint', jointWith: ['a', 'c'], color: { color: '#10b981' } },
                { id: 'fact', from: '⊤', to: 'z', attackType: 'fact', contrary: 'cf', targetAssumption: 'z', color: { color: '#f59e0b' } }
            ]
        }
    };
    const { edgeUpdates } = buildHighlightUpdates(networkData, ['a', 'b'], [], []);
    assert.equal(edgeColor(edgeUpdates, 'joint_in'), '#ef4444', '{a,b} both IN -> active');
    assert.ok(/^rgba\(/.test(edgeColor(edgeUpdates, 'joint_out')), '{a,c} (c OUT) -> inactive');
    assert.equal(edgeColor(edgeUpdates, 'fact'), '#ef4444', 'fact attack is always active');
});
