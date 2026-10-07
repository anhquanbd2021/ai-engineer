import {
  STAGES, EVENT_DECK, DEMO_EVENT_IDS, PRESETS, SHIP_BUDGET,
  buildLadder, runDemo, runShip,
} from './lab.mjs';

const $ = sel => document.querySelector(sel);
const sliderGrid = $('#slider-grid');
const staircase = $('#staircase');
const eventLog = $('#event-log');
const capNote = $('#cap-note');
const verdictBadge = $('#verdict');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => (reducedMotion ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));

// ---- claimed skill state ---------------------------------------------------

const claimed = {};
for (const stage of STAGES) claimed[stage.id] = PRESETS.skipFoundations[stage.id];

function readSliders() {
  for (const stage of STAGES) {
    claimed[stage.id] = Number($(`#skill-${stage.id}`).value);
  }
}

// ---- rendering -------------------------------------------------------------

function renderSliders() {
  sliderGrid.innerHTML = '';
  for (const stage of STAGES) {
    const wrap = document.createElement('div');
    wrap.className = 'slider-card';
    wrap.innerHTML = `
      <div class="slider-head">
        <label for="skill-${stage.id}">${stage.name}</label>
        <output id="out-${stage.id}" for="skill-${stage.id}">${claimed[stage.id]}</output>
      </div>
      <input type="range" id="skill-${stage.id}" min="0" max="100" step="5"
             value="${claimed[stage.id]}" aria-describedby="claim-${stage.id}">
      <p class="muted" id="claim-${stage.id}">${stage.claim}</p>`;
    wrap.querySelector('input').addEventListener('input', () => {
      readSliders();
      paintLadder();
      resetRun();
    });
    sliderGrid.appendChild(wrap);
  }
}

function renderStaircase() {
  staircase.innerHTML = '';
  for (const stage of STAGES) {
    const li = document.createElement('li');
    li.className = 'step';
    li.id = `step-${stage.id}`;
    li.innerHTML = `
      <div class="step-plot">
        <div class="step-claimed" aria-hidden="true"></div>
        <div class="step-bar"></div>
        <span class="step-marker" aria-hidden="true"></span>
      </div>
      <div class="step-meta">
        <strong>${stage.name}</strong>
        <span class="step-nums" id="nums-${stage.id}"></span>
      </div>`;
    staircase.appendChild(li);
  }
}

function renderEvents() {
  eventLog.innerHTML = '';
  EVENT_DECK.forEach((event, i) => {
    const li = document.createElement('li');
    li.className = 'event';
    li.id = `event-${event.id}`;
    const rehearsed = DEMO_EVENT_IDS.includes(event.id);
    li.innerHTML = `
      <span class="event-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="event-body">
        <strong>${event.label}</strong>
        <span class="muted">${event.summary}</span>
      </div>
      <span class="event-tag">${rehearsed ? 'rehearsed' : `defended by ${event.stage}`}</span>
      <span class="event-status" id="status-${event.id}"></span>`;
    eventLog.appendChild(li);
  });
}

function paintLadder() {
  const { steps } = buildLadder(claimed);
  let sagging = 0;
  for (const step of steps) {
    const li = $(`#step-${step.id}`);
    li.querySelector('.step-bar').style.height = `${step.effective}%`;
    li.querySelector('.step-claimed').style.height = `${step.claimed}%`;
    li.classList.toggle('hollow', step.sag > 0);
    $(`#nums-${step.id}`).textContent = step.sag > 0
      ? `${step.claimed} → ${step.effective} (−${step.sag})`
      : `${step.effective}`;
    $(`#out-${step.id}`).textContent = claimed[step.id];
    if (step.sag > 0) sagging += 1;
  }
  capNote.textContent = sagging
    ? `cap chain active — ${sagging} step${sagging === 1 ? '' : 's'} sag`
    : 'claimed = effective';
  capNote.className = `badge ${sagging ? 'warn' : 'pass'}`;
}

function resetRun() {
  for (const event of EVENT_DECK) {
    const row = $(`#event-${event.id}`);
    row.classList.remove('active', 'defended', 'failed', 'crash-site');
    $(`#status-${event.id}`).textContent = '';
  }
  for (const stage of STAGES) {
    $(`#step-${stage.id}`).classList.remove('active', 'struck');
  }
  staircase.classList.remove('collapsed');
  verdictBadge.textContent = '—';
  verdictBadge.className = 'badge';
}

// ---- walks -----------------------------------------------------------------

async function walkSteps(steps, badgeDone) {
  resetRun();
  for (const step of steps) {
    const row = $(`#event-${step.id}`);
    const stair = $(`#step-${step.stage}`);
    row.classList.add('active');
    stair.classList.add('active');
    await wait(380);
    row.classList.remove('active');
    stair.classList.remove('active');
    if (step.defended) {
      row.classList.add('defended');
      $(`#status-${step.id}`).textContent = `held · +${step.margin}`;
    } else {
      row.classList.add('failed');
      stair.classList.add('struck');
      $(`#status-${step.id}`).textContent = `undefended · ${step.margin}`;
    }
  }
  badgeDone();
}

function runDemoWalk() {
  const { passed, steps } = runDemo(claimed);
  walkSteps(steps, () => {
    verdictBadge.textContent = passed ? 'demo passed' : 'demo failed';
    verdictBadge.className = `badge ${passed ? 'pass' : 'warn'}`;
  });
}

async function runShipWalk() {
  const ship = runShip(claimed);
  await walkSteps(ship.steps, () => {});
  if (ship.verdict === 'crashed') {
    staircase.classList.add('collapsed');
    $(`#event-${ship.crashedAt}`).classList.add('crash-site');
    verdictBadge.textContent = `CRASHED at ${ship.crashedAt} — ${ship.failures.length}/${SHIP_BUDGET} breaches`;
    verdictBadge.className = 'badge danger';
  } else if (ship.failures.length) {
    verdictBadge.textContent = `shipped with ${ship.failures.length} breach${ship.failures.length === 1 ? '' : 'es'} (budget ${SHIP_BUDGET})`;
    verdictBadge.className = 'badge warn';
  } else {
    verdictBadge.textContent = 'SHIPPED — deck survived';
    verdictBadge.className = 'badge pass';
  }
}

// ---- wiring ----------------------------------------------------------------

for (const btn of document.querySelectorAll('.preset')) {
  btn.addEventListener('click', () => {
    for (const stage of STAGES) {
      claimed[stage.id] = PRESETS[btn.dataset.preset][stage.id];
      $(`#skill-${stage.id}`).value = claimed[stage.id];
    }
    paintLadder();
    resetRun();
  });
}

$('#run-demo').addEventListener('click', runDemoWalk);
$('#run-ship').addEventListener('click', runShipWalk);
renderSliders();
renderStaircase();
renderEvents();
paintLadder();
