#!/usr/bin/env node
// Raindrop CLI — a view over the game API. Renders getView()/forecast()
// snapshots and translates commands into stageTrust/endRound calls; no game
// arithmetic lives here (design §3.5 drift guard).
//
//   node src/cli.js                       choose a level interactively
//   node src/cli.js --level 3             start at level 3
//   node src/cli.js --level 1 --script test/solutions/level1.script
//
// Commands:
//   trust <target> <weight>          set your trust weight on a plot
//   trust <plot>:<target> <weight>   same, for a named plot you control
//   forecast    preview what ending the round now would produce
//   status      re-print the board
//   hint        show the level hint
//   end         end the round (rain falls)
//   run         keep ending rounds until the level resolves
//   levels      list campaign levels
//   play <n>    start level n
//   help        this text
//   quit        leave the garden

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { createGame, stageTrust, endRound, getView, forecast } from './game/game.js';
import { levels, getLevel } from './game/levels.js';

const out = (s = '') => process.stdout.write(`${s}\n`);

const BAR_WIDTH = 22;
const bar = (value, max) =>
  '█'.repeat(Math.max(1, Math.round((value / max) * BAR_WIDTH))).padEnd(BAR_WIDTH);

const pct = (x) => `${(x * 100).toFixed(1)}%`;

function goalText(goal, plots) {
  const name = (id) => plots.find((p) => p.id === id)?.name ?? id;
  switch (goal.type) {
    case 'balanceAtLeast':
      return `Grow ${name(goal.plotId)} to ${goal.amount} tokens by the end of round ${goal.byRound}.`;
    case 'shareAtLeast': {
      const ids = goal.plotIds ?? [goal.plotId];
      return `Hold ${pct(goal.share)} of all tokens across ${ids.map(name).join(', ')} by the end of round ${goal.byRound}.`;
    }
    case 'leaderAtRound':
      return `Be the strict leader in tokens at the end of round ${goal.round}.`;
    default:
      return '';
  }
}

function renderBoard(state, level) {
  const view = getView(state);
  const maxBalance = Math.max(...view.plots.map((p) => p.balance));
  out();
  out(`— ${level.title} · round ${view.round}/${view.maxRounds} · supply ${view.totalSupply.toFixed(1)} —`);
  out(`Goal: ${goalText(view.goal, view.plots)}`);
  out();
  for (const plot of view.plots) {
    const who = plot.playerControlled ? '☂' : ' ';
    const rain = plot.lastAllocation === null ? '' : `  rain ${pct(plot.lastAllocation)}`;
    out(
      `${who} ${plot.name.padEnd(9)} ${plot.personality.padEnd(13)} ` +
        `${bar(plot.balance, maxBalance)} ${plot.balance.toFixed(1).padStart(7)}  share ${pct(plot.share)}${rain}`,
    );
  }
  out();
  out('Trust flows (rows = who gives, normalized):');
  const names = view.plots.map((p) => p.name.slice(0, 7));
  out(`  ${''.padEnd(8)}${names.map((n) => n.padStart(8)).join('')}`);
  view.trust.forEach((row, i) => {
    out(`  ${names[i].padEnd(8)}${row.map((w) => (w === 0 ? '·' : pct(w)).padStart(8)).join('')}`);
  });
}

function renderForecast(state) {
  const fc = forecast(state);
  const view = getView(state);
  out(`Forecast: ${fc.minted.toFixed(1)} raindrops form${fc.burned > 0 ? `, ${fc.burned.toFixed(1)} burn off in the drought` : ''}.`);
  view.plots.forEach((plot, i) => {
    out(
      `  ${plot.name.padEnd(9)} +${(fc.allocation[i] * fc.distributed).toFixed(1).padStart(6)}` +
        ` (${pct(fc.allocation[i])}) -> ${fc.balances[i].toFixed(1)}`,
    );
  });
}

function renderIntro(level, state) {
  const view = getView(state);
  out();
  out(`════ ${level.title} ════`);
  out(level.story);
  out();
  out('The court:');
  for (const plot of view.plots) {
    out(`  ${plot.name.padEnd(9)} ${plot.personality.padEnd(13)} ${plot.description}`);
  }
  renderBoard(state, level);
}

function renderOutcome(state, level) {
  out();
  if (state.status === 'won') {
    out(`🌧  YOU WON — ${level.title} cleared at round ${state.round}.`);
    out(`   Lesson: ${level.teaches}`);
  } else {
    out(`☁  The season ended — level lost at round ${state.round}.`);
    out(`   Hint: ${level.hint}`);
  }
}

class Session {
  constructor() {
    this.level = null;
    this.state = null;
  }

  start(levelRef) {
    this.level = getLevel(levelRef);
    this.state = createGame(this.level);
    renderIntro(this.level, this.state);
  }

  // Executes one command line; returns false when the session should close.
  execute(line) {
    const [cmd, ...args] = line.trim().split(/\s+/);
    if (!cmd) return true;
    try {
      switch (cmd) {
        case 'trust': {
          const [spec, weight] = args;
          const [a, b] = spec.includes(':') ? spec.split(':') : [null, spec];
          const from = a ?? this.state.plots.find((p) => p.playerControlled).id;
          const target = this.resolvePlot(b);
          this.state = stageTrust(this.state, this.resolvePlot(from), target, Number(weight));
          out(`  ${from} → ${target}: ${weight}`);
          break;
        }
        case 'forecast':
          renderForecast(this.state);
          break;
        case 'status':
          renderBoard(this.state, this.level);
          break;
        case 'hint':
          out(`Hint: ${this.level.hint}`);
          break;
        case 'end': {
          const { state } = endRound(this.state);
          this.state = state;
          renderBoard(this.state, this.level);
          if (this.state.status !== 'playing') renderOutcome(this.state, this.level);
          break;
        }
        case 'run':
          while (this.state.status === 'playing') {
            ({ state: this.state } = endRound(this.state));
          }
          renderBoard(this.state, this.level);
          renderOutcome(this.state, this.level);
          break;
        case 'levels':
          levels.forEach((l, i) => out(`  ${i + 1}. ${l.title} — ${l.teaches}`));
          break;
        case 'play':
          this.start(Number(args[0]) || args[0]);
          break;
        case 'help':
          out(readFileSync(new URL(import.meta.url), 'utf8').match(/\/\/ Commands:[\s\S]*?\n\n/)[0].replaceAll('// ', '').replaceAll('//', ''));
          break;
        case 'quit':
        case 'exit':
          return false;
        default:
          out(`  unknown command: ${cmd} (try "help")`);
      }
    } catch (err) {
      out(`  ✗ ${err.message}`);
    }
    return true;
  }

  // Accepts a plot id, name, or unambiguous prefix.
  resolvePlot(ref) {
    const lower = String(ref).toLowerCase();
    const hit =
      this.state.plots.find((p) => p.id === lower || p.name.toLowerCase() === lower) ??
      this.state.plots.find((p) => p.id.startsWith(lower));
    return hit ? hit.id : ref;
  }
}

function parseArgs(argv) {
  const args = { level: null, script: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--level') args.level = Number(argv[++i]);
    else if (argv[i] === '--script') args.script = argv[++i];
  }
  return args;
}

const { level, script } = parseArgs(process.argv.slice(2));
const session = new Session();
session.start(level ?? 1);

if (script) {
  const lines = readFileSync(script, 'utf8').split(/[;\n]/);
  for (const line of lines) {
    if (!session.execute(line)) break;
  }
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'rain> ' });
  out('\nType "help" for commands.');
  rl.prompt();
  rl.on('line', (line) => {
    if (!session.execute(line)) {
      rl.close();
      return;
    }
    rl.prompt();
  });
  rl.on('close', () => out('\nThe garden will remember you.'));
}
