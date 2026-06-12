// Main-thread UI: render + intent ONLY. All simulation lives in the module
// worker (worker.js); this file never imports from src/ — that is the
// design's structural guard, enforced by test/web.test.js.

const worker = new Worker('./worker.js', { type: 'module' });
const send = (msg) => worker.postMessage(msg);

const $ = (id) => document.getElementById(id);
const svg = $('board');
const NS = 'http://www.w3.org/2000/svg';

let current = null; // latest state snapshot from the worker
let previousBalances = null;

worker.onmessage = ({ data }) => {
  if (data.type === 'state') {
    const justEnded = Boolean(data.report);
    previousBalances = justEnded && current ? current.view.plots.map((p) => p.balance) : null;
    current = data;
    render(data, justEnded);
    if (data.view.status === 'playing') send({ type: 'forecast' });
  } else if (data.type === 'forecast') {
    renderForecast(data);
  } else if (data.type === 'error') {
    console.warn('worker error:', data.message);
  }
};

send({ type: 'loadLevel', ref: 1 });

// ---------------------------------------------------------------------- //

const el = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};

const positions = (n) =>
  Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return [300 + 210 * Math.cos(angle), 310 + 210 * Math.sin(angle)];
  });

function render(snapshot, justEnded) {
  const { view, level } = snapshot;

  // Header / panel text
  $('round').textContent = `round ${view.round}/${view.maxRounds} · supply ${view.totalSupply.toFixed(0)}`;
  $('story').textContent = level.story;
  $('goal').textContent = `Goal: ${snapshot.goalText}`;
  $('hint-text').textContent = `Hint: ${level.hint}`;
  $('end-round').disabled = view.status !== 'playing';
  $('next').style.display = view.status === 'won' && level.index < level.count ? '' : 'none';

  const banner = $('banner');
  banner.className = 'status-banner';
  if (view.status === 'won') {
    banner.classList.add('won');
    banner.textContent = `🌧 You won! Lesson: ${level.teaches}`;
  } else if (view.status === 'lost') {
    banner.classList.add('lost');
    banner.textContent = '☁ The season ended. Try the hint.';
  }

  // Level selector
  const select = $('level-select');
  if (select.options.length !== snapshot.levels.length) {
    select.replaceChildren(
      ...snapshot.levels.map((l) => new Option(l.title, l.index)),
    );
  }
  select.value = String(level.index);

  // Board
  svg.replaceChildren();
  const pos = positions(view.plots.length);
  const maxBalance = Math.max(...view.plots.map((p) => p.balance));

  // Edges (normalized trust): width and opacity follow the weight.
  view.trust.forEach((row, i) => {
    row.forEach((weight, j) => {
      if (weight <= 0.001 || i === j) return;
      const [x1, y1] = pos[i];
      const [x2, y2] = pos[j];
      // Offset the line endpoints toward the target so arrows don't overlap nodes.
      const t = 0.82;
      svg.append(
        el('line', {
          x1, y1,
          x2: x1 + (x2 - x1) * t, y2: y1 + (y2 - y1) * t,
          stroke: view.plots[i].playerControlled ? 'var(--accent)' : 'var(--edge)',
          'stroke-width': (1 + 5 * weight).toFixed(1),
          'stroke-linecap': 'round',
          opacity: (0.25 + 0.6 * weight).toFixed(2),
        }),
      );
      svg.append(el('circle', {
        cx: x1 + (x2 - x1) * t, cy: y1 + (y2 - y1) * t, r: 3 + 3 * weight,
        fill: view.plots[i].playerControlled ? 'var(--accent)' : 'var(--edge)',
      }));
    });
  });

  // Nodes
  view.plots.forEach((plot, i) => {
    const [x, y] = pos[i];
    const r = 20 + 26 * Math.sqrt(plot.balance / maxBalance);
    const group = el('g');
    group.append(el('circle', {
      cx: x, cy: y, r,
      fill: plot.playerControlled ? '#1f4d63' : '#243345',
      stroke: plot.playerControlled ? 'var(--accent)' : '#3c5066',
      'stroke-width': plot.playerControlled ? 3 : 1.5,
    }));
    group.append(el('text', {
      x, y: y - 4, 'text-anchor': 'middle', fill: 'var(--ink)',
      'font-size': '15', 'font-weight': '600',
    }, plot.name));
    group.append(el('text', {
      x, y: y + 14, 'text-anchor': 'middle', fill: 'var(--gold)', 'font-size': '13',
    }, plot.balance.toFixed(0)));
    group.append(el('text', {
      x, y: y + r + 16, 'text-anchor': 'middle', fill: 'var(--dim)', 'font-size': '12',
    }, plot.personality));
    group.append(el('title', {}, `${plot.name} — ${plot.description}\nshare ${(plot.share * 100).toFixed(1)}%`));
    svg.append(group);

    // Rain: droplets + floating gains right after a round resolves.
    if (justEnded && previousBalances) {
      const gained = plot.balance - previousBalances[i];
      if (gained > 0.05) {
        const drop = el('text', { x, y: y - r - 6, 'text-anchor': 'middle', 'font-size': '18', class: 'drop' }, '💧');
        const gain = el('text', {
          x, y: y - r - 8, 'text-anchor': 'middle', fill: 'var(--green)',
          'font-size': '14', class: 'gain',
        }, `+${gained.toFixed(1)}`);
        svg.append(drop, gain);
      }
    }
  });

  renderSliders(snapshot);
}

function renderSliders(snapshot) {
  const { view, staged } = snapshot;
  const container = $('sliders');
  container.replaceChildren();
  view.plots.forEach((plot, from) => {
    if (!plot.playerControlled) return;
    const group = document.createElement('div');
    group.className = 'plot-group';
    if (staged.filter(Boolean).length > 1) {
      const h = document.createElement('h3');
      h.textContent = `${plot.name}'s trust`;
      group.append(h);
    }
    view.plots.forEach((target, to) => {
      if (to === from) return;
      const label = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = target.name;
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = '10';
      range.step = '0.5';
      range.value = String(staged[from][to]);
      range.disabled = view.status !== 'playing';
      const value = document.createElement('span');
      value.textContent = Number(staged[from][to]).toFixed(1);
      range.addEventListener('input', () => {
        value.textContent = Number(range.value).toFixed(1);
        send({ type: 'stageTrust', from: plot.id, target: target.id, weight: Number(range.value) });
      });
      label.append(name, range, value);
      group.append(label);
    });
    container.append(group);
  });
}

function renderForecast(fc) {
  if (!current) return;
  const list = $('forecast-list');
  list.replaceChildren(
    ...current.view.plots.map((plot, i) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = plot.name;
      const gain = document.createElement('span');
      gain.textContent = `+${(fc.allocation[i] * fc.distributed).toFixed(1)}  (${(fc.allocation[i] * 100).toFixed(1)}%)`;
      li.append(name, gain);
      return li;
    }),
  );
}

// Intents
$('end-round').addEventListener('click', () => send({ type: 'endRound' }));
$('restart').addEventListener('click', () => send({ type: 'loadLevel', ref: current.level.index }));
$('next').addEventListener('click', () => send({ type: 'loadLevel', ref: current.level.index + 1 }));
$('level-select').addEventListener('change', (e) => send({ type: 'loadLevel', ref: Number(e.target.value) }));
$('hint').addEventListener('click', () => {
  const hint = $('hint-text');
  hint.style.display = hint.style.display === 'none' ? '' : 'none';
});
