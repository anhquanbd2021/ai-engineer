import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SKILL, MAX_RISE, SHIP_BUDGET,
  STAGES, EVENT_DECK, DEMO_EVENT_IDS, PRESETS,
  effectiveSkill, buildLadder, judgeEvent, runDemo, runShip,
} from '../public/lab.mjs';

test('stage order and event deck match the spec', () => {
  assert.deepEqual(STAGES.map(s => s.id), ['basics', 'llms', 'rag', 'agents']);
  assert.equal(EVENT_DECK.length, 8);
  assert.deepEqual(
    EVENT_DECK.map(e => e.id),
    ['schema-drift', 'stale-chunk', 'retry-storm', 'silent-eval',
     'prompt-injection', 'tool-loop', 'cost-spike', 'model-bump'],
  );
  assert.deepEqual(DEMO_EVENT_IDS, ['schema-drift', 'stale-chunk']);
  assert.ok(EVENT_DECK.every(e => STAGES.some(s => s.id === e.stage)));
});

test('cap chain: a stage is capped by the stage below plus MAX_RISE', () => {
  const claimed = { basics: 10, llms: 95, rag: 95, agents: 95 };
  assert.equal(effectiveSkill(claimed, 'basics'), 10);
  assert.equal(effectiveSkill(claimed, 'llms'), 10 + MAX_RISE);
  // chains through effective, not claimed: RAG is capped by effective LLMs
  assert.equal(effectiveSkill(claimed, 'rag'), 40 + MAX_RISE);
  assert.equal(effectiveSkill(claimed, 'agents'), MAX_SKILL > 95 ? 95 : MAX_SKILL);
});

test('cap chain: a strong base is never dragged down', () => {
  const claimed = { basics: 80, llms: 60, rag: 90, agents: 70 };
  assert.equal(effectiveSkill(claimed, 'basics'), 80);
  assert.equal(effectiveSkill(claimed, 'llms'), 60);
  assert.equal(effectiveSkill(claimed, 'rag'), 90);
  assert.equal(effectiveSkill(claimed, 'agents'), 70);
});

test('cap chain: missing and out-of-range claims clamp to 0–100', () => {
  const claimed = { basics: 500, llms: -20, rag: undefined, agents: 50 };
  assert.equal(effectiveSkill(claimed, 'basics'), MAX_SKILL);
  assert.equal(effectiveSkill(claimed, 'llms'), 0);
  assert.equal(effectiveSkill(claimed, 'rag'), 0);
  assert.equal(effectiveSkill(claimed, 'agents'), 30);
});

test('buildLadder reports claimed, effective, and sag per stage', () => {
  const { claimed, effective, steps } = buildLadder(PRESETS.skipFoundations);
  assert.equal(claimed.basics, 10);
  assert.equal(effective.llms, 40);
  const llms = steps.find(s => s.id === 'llms');
  assert.equal(llms.sag, 95 - 40);
  const basics = steps.find(s => s.id === 'basics');
  assert.equal(basics.sag, 0);
});

test('judgeEvent compares effective skill to the event threshold', () => {
  const effective = buildLadder(PRESETS.skipFoundations).effective;
  const storm = EVENT_DECK.find(e => e.id === 'retry-storm');
  const r = judgeEvent(effective, storm);
  assert.equal(r.defended, false);
  assert.equal(r.margin, 10 - storm.threshold);
  const chunk = EVENT_DECK.find(e => e.id === 'stale-chunk');
  assert.equal(judgeEvent(effective, chunk).defended, true);
});

test('the failure mode: skipFoundations passes its demo then crashes on retry-storm', () => {
  const demo = runDemo(PRESETS.skipFoundations);
  assert.equal(demo.passed, true);
  assert.ok(demo.steps.every(s => s.defended));

  const ship = runShip(PRESETS.skipFoundations);
  assert.equal(ship.verdict, 'crashed');
  assert.equal(ship.crashedAt, 'retry-storm');
  assert.ok(ship.failures.length >= SHIP_BUDGET);
  assert.ok(ship.failures.includes('retry-storm'));
});

test('balanced and frontier presets ship the full deck', () => {
  for (const name of ['balanced', 'frontier']) {
    const ship = runShip(PRESETS[name]);
    assert.equal(ship.verdict, 'shipped', name);
    assert.equal(ship.crashedAt, null);
    assert.ok(ship.failures.length < SHIP_BUDGET);
  }
});

test('a two-breach build ships wounded — the budget is what flips the verdict', () => {
  // LLMs just under the wire: silent-eval (65) and cost-spike (70) breach = 2 < SHIP_BUDGET.
  const claimed = { basics: 70, llms: 60, rag: 70, agents: 80 };
  const ship = runShip(claimed);
  assert.deepEqual(ship.failures.sort(), ['cost-spike', 'silent-eval']);
  assert.equal(ship.verdict, 'shipped');
});
