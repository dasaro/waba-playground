import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildAssumptionNodeTooltip,
    buildAttackEdgeTooltip,
    buildJunctionTooltip,
    buildSetAttackTooltip,
    buildSetNodeTooltip
} from '../../modules/graph-tooltip-builder.js';

test('assumption tooltip includes contrary and attack role summary', () => {
    const tooltip = buildAssumptionNodeTooltip({
        assumption: 'a',
        explicitWeight: null,
        contrary: 'not_a',
        incomingSources: ['b', 'facts via obs'],
        outgoingTargets: ['c'],
        outgoingContraries: ['not_c']
    });

    assert.match(tooltip, /Assumption a/);
    assert.match(tooltip, /undeclared \(default policy applies\)/);
    assert.match(tooltip, /Contrary/);
    assert.match(tooltip, /not_a/);
    assert.match(tooltip, /Can attack/);
    assert.match(tooltip, /c/);
});

test('attack tooltip includes derivation and contributors', () => {
    const tooltip = buildAttackEdgeTooltip({
        typeLabel: 'Joint attack contribution',
        attacker: 'a',
        target: 'x',
        contrary: 'not_x',
        weight: 7,
        ruleId: 'r1',
        derivationBody: ['a', 'b'],
        jointWith: ['a', 'b'],
        note: 'All contributors must be supported.'
    });

    assert.match(tooltip, /Joint attack contribution: a -&gt; x|Joint attack contribution: a -> x/);
    assert.match(tooltip, /r1/);
    assert.match(tooltip, /not_x/);
    assert.match(tooltip, /Other required contributors/);
    assert.match(tooltip, /b/);
});

test('junction and set tooltips expose explanatory context', () => {
    const junctionTooltip = buildJunctionTooltip({
        target: 'x',
        contrary: 'not_x',
        ruleId: 'r2',
        derivationBody: ['a', 'b'],
        weight: 5
    });
    const setTooltip = buildSetNodeTooltip({
        setId: '{a,b}',
        assumptions: ['a', 'b'],
        supported: ['a', 'b', 'not_x'],
        attacks: [{ assumption: 'x', attackingElement: 'not_x', weight: 5 }]
    });
    const setAttackTooltip = buildSetAttackTooltip({
        sourceSet: '{a,b}',
        targetSet: '{b,x}',
        targetAssumption: 'x',
        attackingElement: 'not_x',
        weight: 5,
        derivedBy: ['r2']
    });

    assert.match(junctionTooltip, /Joint attack node for x/);
    assert.match(junctionTooltip, /Required contributors/);
    assert.match(setTooltip, /Extension candidate \{a,b\}/);
    assert.match(setTooltip, /Supported atoms/);
    assert.match(setAttackTooltip, /Set attack \{a,b\} -&gt; \{b,x\}|Set attack \{a,b\} -> \{b,x\}/);
    assert.match(setAttackTooltip, /Derivation rules/);
});
