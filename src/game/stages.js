// A stage clears only when the one before it has. That ordering is the whole
// game: it is the shower routine, and it is the Speedrun route.
export const STAGES = [
  { id: 'wet',       label: 'Get wet',            hint: 'Turn the pressure up and stand under the water.',
    done: s => s.body.wet >= 0.9 },
  { id: 'shampoo',   label: 'Shampoo',            hint: 'Step out of the stream, then squeeze the shampoo.',
    done: s => s.body.hairLather >= 0.8 },
  { id: 'rinse1',    label: 'Rinse',              hint: 'Back under the water until your hair runs clear.',
    done: s => s.body.hairClean >= 0.95 && s.body.hairLather <= 0.05 },
  { id: 'condition', label: 'Condition',          hint: 'Apply conditioner out of the stream, then rinse it out.',
    done: s => s.body.conditioned >= 0.95 && s.body.condLather <= 0.05 },
  { id: 'bodywash',  label: 'Body wash',          hint: 'Grab the soap and scrub, clear of the water.',
    done: s => s.body.bodyLather >= 0.8 },
  { id: 'rinse2',    label: 'Rinse',              hint: 'Wash the suds off.',
    done: s => s.body.bodyClean >= 0.95 && s.body.bodyLather <= 0.05 },
  { id: 'escape',    label: 'Escape',             hint: 'Pressure to zero, take the towel, step out.',
    done: s => s.escaped },
];

// Advances at most one stage per tick and records the split.
export function checkStages(s) {
  if (s.stage >= STAGES.length) return null;
  const stage = STAGES[s.stage];
  if (!stage.done(s)) return null;
  s.splits.push({ id: stage.id, label: stage.label, t: s.t });
  s.stage++;
  if (s.stage >= STAGES.length) s.finished = true;
  return stage;
}
