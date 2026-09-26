import { CONFIG } from '../config.js';
import { STAGES } from '../game/stages.js';
import { waterTemp, waterPressure } from '../game/state.js';

const $ = id => document.getElementById(id);
const pct = (v, lo, hi) => ((v - lo) / (hi - lo)) * 100;

const METERS = [
  { key: 'wet',         label: 'Wet',         colour: 'var(--cold)' },
  { key: 'hairClean',   label: 'Hair',        colour: 'var(--good)' },
  { key: 'conditioned', label: 'Conditioned', colour: 'var(--good)' },
  { key: 'bodyClean',   label: 'Body',        colour: 'var(--good)' },
];

export function createHud() {
  const el = {
    stageList: $('stageList'), hint: $('hint'),
    clock: $('clock'), water: $('water'), tank: $('tank'), holding: $('holding'),
    tempVal: $('tempVal'), tempNeedle: $('tempNeedle'), tempGhost: $('tempGhost'), tempBand: $('tempBand'),
    presVal: $('presVal'), presFill: $('presFill'), presGhost: $('presGhost'),
    meters: $('meters'), cross: $('cross'), prompt: $('prompt'),
    toast: $('toast'), tint: $('tint'), sting: $('sting'),
    start: $('startScreen'), end: $('endScreen'),
  };

  // Stage checklist.
  el.stageList.innerHTML = STAGES
    .map(s => `<li><span class="box">·</span><span class="txt">${s.label}</span><span class="split"></span></li>`)
    .join('');
  const stageRows = [...el.stageList.children];

  // Comfort band marker on the temperature track.
  const [lo, hi] = CONFIG.water.comfortBand;
  const { tempMin, tempMax } = CONFIG.water;
  el.tempBand.style.left = pct(lo, tempMin, tempMax) + '%';
  el.tempBand.style.width = (pct(hi, tempMin, tempMax) - pct(lo, tempMin, tempMax)) + '%';

  // Body meters + comfort.
  el.meters.innerHTML =
    `<div class="cap">You</div>` +
    METERS.concat([{ key: 'comfort', label: 'Comfort', colour: 'var(--warn)' }])
      .map(m => `<div class="meter"><div class="lab"><span class="cap">${m.label}</span>
        <span class="v" data-v="${m.key}">0%</span></div>
        <div class="track"><div class="fill" data-f="${m.key}" style="background:${m.colour}"></div></div></div>`)
      .join('');
  const fills = Object.fromEntries([...el.meters.querySelectorAll('[data-f]')].map(n => [n.dataset.f, n]));
  const vals = Object.fromEntries([...el.meters.querySelectorAll('[data-v]')].map(n => [n.dataset.v, n]));

  let toastUntil = 0;

  return {
    update(s, look) {
      const temp = waterTemp(s), pres = waterPressure(s);

      el.clock.textContent = s.t.toFixed(1);
      el.water.textContent = s.waterUsed.toFixed(1) + ' L';
      el.tank.textContent = Math.round(s.hotTank) + '%';
      el.tank.style.color = s.hotTank < 25 ? 'var(--bad)' : '#fff';
      el.holding.textContent = s.holding ?? '—';

      el.tempVal.textContent = temp.toFixed(1) + '°';
      el.tempVal.style.color = temp < lo ? 'var(--cold)' : temp > hi ? 'var(--hot)' : 'var(--good)';
      el.tempNeedle.style.left = clampPct(pct(temp, tempMin, tempMax)) + '%';
      el.tempGhost.style.left = clampPct(pct(s.knob.temp, tempMin, tempMax)) + '%';
      // The ghost tick only matters when an event has pulled reality off the dial.
      el.tempGhost.style.opacity = Math.abs(s.offset.temp) > 0.5 ? 1 : 0;

      el.presVal.textContent = Math.round(pres) + '%';
      el.presFill.style.width = pres + '%';
      el.presGhost.style.left = clampPct(s.knob.pressure) + '%';
      el.presGhost.style.opacity = Math.abs(s.offset.pressure) > 1 ? 1 : 0;

      for (const m of METERS) setMeter(fills, vals, m.key, s.body[m.key]);
      setMeter(fills, vals, 'comfort', s.comfort / CONFIG.comfort.max);
      fills.comfort.style.background = s.comfort < 30 ? 'var(--bad)' : 'var(--warn)';

      // Checklist.
      stageRows.forEach((row, i) => {
        const done = i < s.stage;
        row.className = done ? 'done' : i === s.stage ? 'now' : '';
        row.querySelector('.box').textContent = done ? '✓' : i === s.stage ? '▸' : '·';
        const split = s.splits[i];
        row.querySelector('.split').textContent = split ? split.t.toFixed(1) : '';
      });
      el.hint.textContent = STAGES[s.stage]?.hint ?? '';

      // Crosshair + prompt.
      el.cross.classList.toggle('hot', !!look.prompt);
      el.prompt.classList.toggle('on', !!look.prompt);
      if (look.prompt) el.prompt.innerHTML = look.prompt;

      // Screen effects: cold blue, scalding orange, shampoo sting.
      const dev = temp < lo ? (lo - temp) / 22 : temp > hi ? (temp - hi) / 14 : 0;
      const wet = Math.max(0.25, s.body.wet);
      el.tint.style.opacity = Math.min(0.55, dev * wet);
      el.tint.style.background = temp < lo
        ? 'radial-gradient(circle at 50% 50%, transparent 25%, #1b5fa8 100%)'
        : 'radial-gradient(circle at 50% 50%, transparent 25%, #b33a12 100%)';
      el.sting.style.opacity = s.sting;
      el.sting.style.backdropFilter = `blur(${(s.sting * 5).toFixed(2)}px)`;

      if (toastUntil && s.t > toastUntil) { el.toast.classList.remove('on'); toastUntil = 0; }
    },

    toast(ev, now) {
      el.toast.querySelector('.t').textContent = ev.title;
      el.toast.querySelector('.s').textContent = ev.sub;
      el.toast.classList.add('on');
      toastUntil = now + 3.4;
    },

    showStart(on) { el.start.classList.toggle('on', on); },

    showResults(s, result) {
      $('grade').textContent = result.grade;
      $('points').textContent = result.points;
      const rows = [
        ['Time', s.t.toFixed(1) + ' s'],
        ['Cleanliness', Math.round(result.clean * 100) + '%'],
        ['Avg comfort', Math.round(result.avgComfort) + '%'],
        ['Water used', s.waterUsed.toFixed(1) + ' L'],
        ['Hot tank left', Math.round(s.hotTank) + '%'],
        ['Towel', s.hasTowel ? 'yes' : 'dripping'],
        ...s.splits.map(sp => [sp.label, sp.t.toFixed(1) + ' s']),
      ];
      $('resultLines').innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
      el.end.classList.add('on');
    },

    hideResults() { el.end.classList.remove('on'); },
  };
}

function setMeter(fills, vals, key, v01) {
  const p = Math.round(Math.max(0, Math.min(1, v01)) * 100);
  fills[key].style.width = p + '%';
  vals[key].textContent = p + '%';
}

const clampPct = p => Math.max(0, Math.min(100, p));
