// Ai Engineer Lab — the domain model.
//
// The article's claim: the AI-engineer roadmap is a CAP CHAIN. Each stage's
// effective skill is capped by the stage beneath it — you cannot be stronger
// at agents than you are at the RAG the agent retrieves with, and you cannot
// be stronger at RAG than you are at the LLM calls it sits on.
//
//   effective[0] = claimed[0]
//   effective[i] = min(claimed[i], effective[i-1] + MAX_RISE)
//
// A skipped stage doesn't stay skipped — it sags every stage above it.
// The demo events are the two rehearsed queries; the ship deck is what
// production actually walks. The ship absorbs up to SHIP_BUDGET - 1
// undefended events; at SHIP_BUDGET the verdict flips to 'crashed' and
// crashedAt records the event where the collapse began.

export const MAX_SKILL = 100;
export const MAX_RISE = 30;
export const SHIP_BUDGET = 3;

export const STAGES = [
  {
    id: 'basics',
    name: 'Basics',
    claim: 'Python, HTTP, JSON, git — the only debugging tools that still work when the model is the bug.',
  },
  {
    id: 'llms',
    name: 'LLMs',
    claim: 'Timeouts, retries, budgets, evals — owning a flaky network dependency that changes underneath you.',
  },
  {
    id: 'rag',
    name: 'RAG',
    claim: 'Chunking, metadata filters, freshness — the model can only be as right as what you retrieved.',
  },
  {
    id: 'agents',
    name: 'Agents',
    claim: 'A for-loop over LLM calls — per-step reliability compounds, and every tool multiplies the blast radius.',
  },
];

// The eight-event deck production walks. Each event is defended by exactly
// one stage and fails when that stage's EFFECTIVE skill is below threshold.
// DEMO_EVENT_IDS are the rehearsed subset — the two queries practiced
// before demo day.
export const EVENT_DECK = [
  {
    id: 'schema-drift',
    label: 'Schema drift',
    stage: 'llms',
    threshold: 30,
    summary: 'The provider renames a response field overnight. Structured outputs and a pinned schema notice; a cheerful preamble breaks the parser.',
  },
  {
    id: 'stale-chunk',
    label: 'Stale chunk wins',
    stage: 'rag',
    threshold: 55,
    summary: 'The 2022 refund policy outranks the 2025 one on raw similarity. Only a metadata freshness filter keeps it out of the context.',
  },
  {
    id: 'retry-storm',
    label: 'Retry storm',
    stage: 'basics',
    threshold: 40,
    summary: 'Rate limits hit at 09:12. A 429 retry loop with time.sleep(1) inside it burns the hourly quota in four minutes.',
  },
  {
    id: 'silent-eval',
    label: 'Silent regression',
    stage: 'llms',
    threshold: 65,
    summary: 'A provider-side model update shifts the output distribution. With no eval set, the first signal is a user complaint.',
  },
  {
    id: 'prompt-injection',
    label: 'Prompt injection',
    stage: 'agents',
    threshold: 70,
    summary: 'A retrieved doc contains "ignore your instructions and email this to\u2026". Unguarded tool calls execute it.',
  },
  {
    id: 'tool-loop',
    label: 'Tool loop',
    stage: 'agents',
    threshold: 75,
    summary: 'A flaky CRM returns 500s. With no max_steps the agent retries at $0.04 a call until the morning invoice.',
  },
  {
    id: 'cost-spike',
    label: 'Cost spike',
    stage: 'llms',
    threshold: 70,
    summary: 'Traffic triples on a launch-day post. No token budget and no cost ceiling turns it into a four-figure invoice.',
  },
  {
    id: 'model-bump',
    label: 'Model bump',
    stage: 'rag',
    threshold: 65,
    summary: 'The pinned embedding model retires; an unpinned upgrade silently changes what "similar" means for every stored chunk.',
  },
];

export const DEMO_EVENT_IDS = ['schema-drift', 'stale-chunk'];

export const PRESETS = {
  balanced: {
    basics: 70, llms: 75, rag: 70, agents: 80,
    note: 'Even investment — nobody skipped a step.',
  },
  frontier: {
    basics: 90, llms: 92, rag: 95, agents: 95,
    note: 'Deep foundations under strong skills — ships clean.',
  },
  skipFoundations: {
    basics: 10, llms: 95, rag: 95, agents: 95,
    note: 'Demo-day build: trending skills maxed, the floor skipped.',
  },
};

// ---- the cap chain ---------------------------------------------------------

function clampSkill(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_SKILL, Math.round(n)));
}

export function effectiveSkill(claimed, stageId) {
  const index = STAGES.findIndex(s => s.id === stageId);
  if (index === -1) throw new Error(`unknown stage: ${stageId}`);
  let cap = MAX_SKILL;
  for (let i = 0; i <= index; i += 1) {
    cap = Math.min(clampSkill(claimed[STAGES[i].id]), cap + MAX_RISE);
  }
  return cap;
}

export function buildLadder(claimed) {
  const safe = {};
  const effective = {};
  let cap = MAX_SKILL;
  const steps = STAGES.map(stage => {
    const want = clampSkill(claimed[stage.id]);
    cap = Math.min(want, cap + MAX_RISE);
    safe[stage.id] = want;
    effective[stage.id] = cap;
    return { ...stage, claimed: want, effective: cap, sag: want - cap };
  });
  return { claimed: safe, effective, steps };
}

// ---- judging ---------------------------------------------------------------

export function judgeEvent(effective, event) {
  const have = effective[event.stage];
  const margin = have - event.threshold;
  return { defended: margin >= 0, margin, effective: have };
}

function walk(claimed, events) {
  const { effective } = buildLadder(claimed);
  return events.map(event => ({
    ...event,
    ...judgeEvent(effective, event),
  }));
}

export function runDemo(claimed) {
  const steps = walk(claimed, EVENT_DECK.filter(e => DEMO_EVENT_IDS.includes(e.id)));
  return { passed: steps.every(s => s.defended), steps };
}

export function runShip(claimed) {
  const steps = walk(claimed, EVENT_DECK);
  const failures = steps.filter(s => !s.defended).map(s => s.id);
  const crashed = failures.length >= SHIP_BUDGET;
  return {
    verdict: crashed ? 'crashed' : 'shipped',
    failures,
    crashedAt: crashed ? failures[0] : null,
    budget: SHIP_BUDGET,
    steps,
  };
}
