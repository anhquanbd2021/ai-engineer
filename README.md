# Ai Engineer Lab — companion demo

Interactive lab for the article *The AI Engineer Roadmap — and What Each Step
Is Actually Standing On*. The roadmap is modeled as a **cap chain**: each
stage's *effective* skill is capped by the stage beneath it.

```text
effective[0] = claimed[0]
effective[i] = min(claimed[i], effective[i-1] + MAX_RISE)   // MAX_RISE = 30
```

Zero dependencies — Node 24+ only. The domain model is a plain ES module
(`public/lab.mjs`) shared by the browser UI, the CLI, and the test suite.

## What it proves

Pick the **Skip the basics** preset — Basics 10, LLMs/RAG/Agents 95. The cap
chain re-grades the claim to an effective staircase of `10 → 40 → 70 → 95`.
**Run the demo** walks the two rehearsed events (`schema-drift`,
`stale-chunk`) — both pass, because they are defended by stages you maxed.
**Ship it** walks the full eight-event deck; each event is defended by
exactly one stage's effective skill, and the build collapses on
`retry-storm` (basics, threshold 40) — deterministic, every run. Three
undefended events (`SHIP_BUDGET`) flip the verdict to **CRASHED**.

The **Balanced climb** and **Frontier team** presets ship the whole deck.

## Run it

```text
npm start           # serve the lab on http://localhost:3000
npm test            # cap-chain unit tests + server e2e
npm run staircase   # CLI: claimed vs effective for every preset
npm run check       # tests
```

The server also exposes the mechanism over HTTP:
`GET /api/assess?basics=10&llms=95&rag=95&agents=95` returns the full
ladder plus both verdicts.

## Layout

- `public/lab.mjs` — the cap chain, event deck, presets, `runDemo`, `runShip`
- `public/app.js` — sliders, staircase rendering, event-walk animation
- `app/server.js` — zero-dependency static host + `/health`, `/version`, `/api/assess`
- `scripts/staircase.mjs` — the CLI staircase
- `test/` — `node --test "test/*.test.mjs"`

Repo: [github.com/anhquanbd2021/ai-engineer](https://github.com/anhquanbd2021/ai-engineer)
Live: [ai-engineer.onrender.com](https://ai-engineer.onrender.com)

## Honest limits

- Skill scores and thresholds are illustrative, not measured.
- The +30 rise is a modeling choice; real dependencies between skills
  aren't linear.
- Each event is defended by exactly one stage — real incidents span layers.
- A **SHIPPED** verdict means the deck was survived — never "the system is
  correct".

This is an educational demo, not production infrastructure.
