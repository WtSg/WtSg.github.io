#!/usr/bin/env node
// Renders the drawings for the page "The camera, taken apart" (photography/camera):
//   assets/img/teardown/rangefinder-action.json  the rangefinder at work, one frame per distance
//                                                on the lens's scale, from infinity to 0.7 m
//   assets/img/teardown/rangefinder-apart.json   the camera taken apart, from together to apart
//   assets/img/teardown/rangefinder-parts.json   every part of it on its own
//   assets/img/teardown/shutter.json             the shutter mid-travel and the film behind it
// Every frame of a drawing fits the page the same way and shares one crop, so the page swaps
// frames that line up exactly. Each frame is a list of part drawings; a part drawn the same in
// two frames is stored once. Styles are left to the page (assets/css/focus-game.css). Each
// drawing also gives a crop of its ink alone (inkBox), for screens too narrow for the labels; in
// action, round the camera and the subject, the rangefinder's line of sight left to run off it.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const tools = path.join(__dirname, '../tools/assets');
const context = {console, structuredClone};
context.self = context;
vm.createContext(context);
for (const f of ['sheet.js', 'geometry.js', 'projection.js']) vm.runInContext(fs.readFileSync(path.join(tools, f), 'utf8'), context, {filename: f});
for (const f of ['optics.js', 'model.js', 'exploded.js', 'shutter.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), context, {filename: f});
const {DrawingModels: models, TechnicalProjection: P} = context;
const out = path.join(__dirname, '../../assets/img/teardown');
fs.mkdirSync(out, {recursive: true});

const LABEL = 4.6, GAP = 6.4, CHAR = LABEL * 0.72;      // labels set for reading on a screen
const r1 = n => String(Number(n.toFixed(1)));
const tidy = s => s.replace(/ d="([^"]*)"/g, (_, d) => ` d="${d.replace(/-?\d+\.\d+/g, n => r1(+n))}"`).replace(/ (c[xy])="(-?[\d.]+)"/g, (_, k, n) => ` ${k}="${r1(+n)}"`);
const groupsOf = markup => [...markup.matchAll(/<g[ >][\s\S]*?<\/g>(?=<g[ >]|$)/g)].map(m => m[0]);

// One crop for a drawing: the ink of every frame (the hidden fitting frame left out) and its labels
function cropper() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  return {
    take,
    ink(markup) {
      for (const [, d] of markup.replace(/<g data-trails="">[\s\S]*?<\/g>/, '').matchAll(/ d="([^"]*)"/g)) {
        const nums = d.replace(/[MLCZ]/g, ' ').trim().split(/\s+/).map(Number);
        for (let i = 0; i + 1 < nums.length; i += 2) take(nums[i], nums[i + 1]);
      }
    },
    text(x, y, anchor, text) {
      const w = text.length * CHAR;
      take(anchor === 'end' ? x - w : x, y - LABEL);
      take(anchor === 'end' ? x : x + w, y + 1.2);
    },
    get box() { return {x0, y0, x1, y1}; }
  };
}
function pack(frames, extra) {
  const table = [], index = new Map();
  const ids = frames.map(list => list.map(g => {
    g = tidy(g).replace(/<title>[^<]*<\/title>/g, '');
    if (!index.has(g)) { index.set(g, table.length); table.push(g); }
    return index.get(g);
  }));
  return {...extra, frames: ids, groups: table};
}
const viewBox = ({x0, y0, x1, y1}, pad = 4) => [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad].map(n => +n.toFixed(1));

// ---------- The rangefinder at work ----------
{
  const STOPS = [[0, '∞', 'infinity'], [0.1, '10 m', '10 metres'], [0.2, '5 m', '5 metres'], [1 / 3, '3 m', '3 metres'], [0.5, '2 m', '2 metres'],
    [1 / 1.5, '1.5 m', '1.5 metres'], [1 / 1.2, '1.2 m', '1.2 metres'], [1, '1 m', '1 metre'], [1 / 0.9, '0.9 m', '0.9 metres'], [1 / 0.8, '0.8 m', '0.8 metres'], [1.4286, '0.7 m', '0.7 metres']];
  const REF = 7;                                            // labels are laid out at 1 m, on the subject
  const runs = STOPS.map(([dioptres]) => models.rangefinder({dioptres}, {explosion: 1, fitExplosion: 1, isolated: null, fill: true, annotate: true, labels: false}));
  const {scale, offset} = runs[0];
  if (runs.some(r => Math.abs(r.scale - scale) > 1e-9 || Math.abs(r.offset[0] - offset[0]) > 1e-9 || Math.abs(r.offset[1] - offset[1]) > 1e-9)) throw Error('Frames must fit the page alike');
  const view = P.createCamera(runs[0].camera);
  const paper = p => { const q = view.project(p); return [offset[0] + q[0] * scale, offset[1] + q[1] * scale]; };
  const names = Object.fromEntries([...runs[0].markup.matchAll(/data-item="([^"]*)" data-name="([^"]*)"/g)].map(m => [m[1], m[2]]));
  const crop = cropper();
  const tight = cropper();                                  // for narrow screens: the camera and the subject, the line of sight
  runs.forEach(r => { crop.ink(r.markup); tight.ink(r.markup.replace(/<g id="part-sight[^"]*"[\s\S]*?<\/g>/, '')); });   // left to run off the edge
  const ink = {...crop.box};
  // the labels, in two columns either side of the drawing, in the order their parts stand at 1 m
  const ref = Object.entries(runs[REF].meta.anchors).map(([id, p]) => ({id, at: paper(p)}));
  const middle = (ink.x0 + ink.x1) / 2;
  const columns = [ref.filter(a => a.at[0] < middle), ref.filter(a => a.at[0] >= middle)];
  const place = {};
  columns.forEach((list, side) => {
    list.sort((a, b) => a.at[1] - b.at[1]);
    const ys = list.map(a => a.at[1]);
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + GAP);
    const over = Math.max(0, ys[ys.length - 1] - (ink.y1 - 2));
    for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i] - over, i < ys.length - 1 ? ys[i + 1] - GAP : Infinity);
    const x = side ? ink.x1 + 10 : ink.x0 - 10;
    list.forEach((a, i) => { place[a.id] = {side, x, y: ys[i]}; crop.text(x, ys[i] + LABEL * 0.35, side ? 'start' : 'end', names[a.id].toUpperCase()); });
  });
  const labels = '<g data-annotations="">' + Object.entries(place).map(([id, {side, x, y}]) =>
    `<text data-ink-fill="" data-annotation="" data-for="${id}" x="${r1(x)}" y="${r1(y + LABEL * 0.35)}" font-size="${LABEL}" text-anchor="${side ? 'start' : 'end'}">${names[id].toUpperCase()}</text>`).join('') + '</g>';
  const leaders = r => '<g data-leaders="">' + Object.entries(place).map(([id, {side, x, y}]) => {
    const [ax, ay] = paper(r.meta.anchors[id]), dir = side ? -1 : 1, end = x + dir * 1.6, elbow = x + dir * 6;
    return `<path data-line-role="detail" data-for="${id}" fill="none" d="M${r1(ax)} ${r1(ay)}L${r1(elbow)} ${r1(y)}L${r1(end)} ${r1(y)}"/><circle data-ink-fill="" cx="${r1(ax)}" cy="${r1(ay)}" r=".7"/>`;
  }).join('') + '</g>';
  const data = pack(runs.map(r => [...groupsOf(r.markup.replace(/<g data-trails="">[\s\S]*?<\/g>/, '')), leaders(r)]), {
    viewBox: viewBox(crop.box).join(' '), inkBox: viewBox(tight.box, 3).join(' '), labels,
    stops: STOPS.map(([v, label, speak]) => ({v: +v.toFixed(4), label, speak})), subject: REF,
    title: 'How a rangefinder focuses: the lens, its cam, the roller and levers turning the mirror, and the two lines of sight meeting where the lens is focused'
  });
  fs.writeFileSync(path.join(out, 'rangefinder-action.json'), JSON.stringify(data));
  runs.forEach((r, i) => console.log('action', STOPS[i][1].padEnd(6), 'mirror', (r.meta.phi * 180 / Math.PI).toFixed(1) + '°', 'lens out', r.meta.ext.toFixed(1) + ' mm', 'slot', r.meta.slot.toFixed(1), 'cam contact r', r.meta.contact.toFixed(1)));
  console.log('action', (JSON.stringify(data).length / 1024).toFixed(0) + ' KB,', data.groups.length, 'part drawings for', data.frames.length, 'frames; crop', data.viewBox);
}

// ---------- The camera taken apart ----------
{
  const N = 6, STEPS = Array.from({length: N + 1}, (_, i) => i / N);
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;  // even steps of the slider, eased apart
  const runs = STEPS.map(t => models['rangefinder-exploded']({}, {explosion: ease(t), fitExplosion: 1, isolated: null, fill: true, annotate: true, labels: t === 1}));
  const crop = cropper(), inkOnly = cropper();
  runs.forEach(r => {
    crop.ink(r.markup.replace('<g data-trails="">', '<g data-light="">'));
    inkOnly.ink(r.markup.replace(/<g data-annotations="">[\s\S]*?<\/g>/, '').replace('<g data-trails="">', '<g data-light="">'));
    for (const [, x, y, anchor, text] of r.markup.matchAll(/<text[^>]* x="([^"]*)" y="([^"]*)"[^>]*text-anchor="([^"]*)"[^>]*>([^<]*)<\/text>/g)) crop.text(+x, +y, anchor, text);
  });
  // each label, its leader and its dot carry the id of the part they name, so a page can pick one out
  const names = Object.fromEntries([...runs[N].markup.matchAll(/data-item="([^"]*)" data-name="([^"]*)"/g)].map(m => [m[2].toUpperCase(), m[1]]));
  const tag = markup => markup.replace(/(<path data-line-role="detail" fill="none" d="[^"]*"\/>)(<circle [^>]*\/>)(<text [^>]*)>([^<]*)<\/text>/g, (all, l, c, t, name) => {
    const id = names[name.replace(/&amp;/g, '&')];
    if (!id) throw Error('A label names no part: ' + name);
    const f = ` data-for="${id}"`;
    return l.replace('<path', '<path' + f) + c.replace('<circle', '<circle' + f) + t.replace('<text', '<text' + f) + '>' + name + '</text>';
  });
  // (the light's path is kept: an axis trail through the lens; it marks the groups data-light)
  const data = pack(runs.map(r => groupsOf(tag(r.markup.replace('<g data-trails="">', '<g data-trails="" data-light="">').replace(/font-size="3\.2"/g, `font-size="${LABEL}"`)))), {
    viewBox: viewBox(crop.box).join(' '), inkBox: viewBox(inkOnly.box).join(' '), steps: STEPS.length,
    title: 'A Leica M-style camera taken apart: the top cover and its dials, the viewfinder and rangefinder parts, the body, the shutter, the base plate, film cassette and take-up spool, and the lens spread along its axis'
  });
  const tagged = (data.groups.join('').match(/<text data-for=/g) || []).length;
  if (tagged !== Object.keys(names).length) throw Error(`Labels tagged: ${tagged} of ${Object.keys(names).length}`);
  fs.writeFileSync(path.join(out, 'rangefinder-apart.json'), JSON.stringify(data));
  console.log('apart', (JSON.stringify(data).length / 1024).toFixed(0) + ' KB,', data.groups.length, 'part drawings for', data.frames.length, 'frames; crop', data.viewBox);

  // ---------- Every part on its own ----------
  // each part alone, as it sits in the camera taken apart, fitted and cropped to its own ink
  const parts = Object.entries(names).map(([, id]) => id);
  const order = [...runs[N].markup.matchAll(/data-item="([^"]*)" data-name="([^"]*)"/g)].map(m => ({id: m[1], name: m[2]}));
  const alone = order.map(({id, name}) => {
    const r = models['rangefinder-exploded']({}, {explosion: 1, fitExplosion: 1, isolated: id, fill: true, annotate: false});
    const c = cropper();
    c.ink(r.markup);
    return {id, name, viewBox: viewBox(c.box, 3).join(' '), markup: tidy(groupsOf(r.markup.replace(/<g data-trails="">[\s\S]*?<\/g>/, '')).join('')).replace(/<title>[^<]*<\/title>/g, '')};
  });
  if (alone.length !== parts.length) throw Error('Every part must be drawn alone');
  fs.writeFileSync(path.join(out, 'rangefinder-parts.json'), JSON.stringify({parts: alone}));
  console.log('parts', (JSON.stringify(alone).length / 1024).toFixed(0) + ' KB,', alone.length, 'parts:', alone.map(p => p.id).join(' '));
}

// ---------- Taking the picture: the shutter mid-travel and the film behind it ----------
{
  const r = models['shutter-film']({}, {explosion: 0, fitExplosion: 0, isolated: null, fill: true, annotate: true});
  const markup = r.markup.replace(/<g data-trails="">[\s\S]*?<\/g>/, '').replace(/font-size="3\.2"/g, `font-size="${LABEL}"`);
  const crop = cropper(), inkOnly = cropper();
  crop.ink(markup);
  inkOnly.ink(markup.replace(/<g data-annotations="">[\s\S]*?<\/g>/, ''));
  for (const [, x, y, anchor, text] of markup.matchAll(/<text[^>]* x="([^"]*)" y="([^"]*)"[^>]*text-anchor="([^"]*)"[^>]*>([^<]*)<\/text>/g)) crop.text(+x, +y, anchor, text);
  const data = {
    viewBox: viewBox(crop.box).join(' '), inkBox: viewBox(inkOnly.box, 3).join(' '),
    markup: tidy(groupsOf(markup).join('')).replace(/<title>[^<]*<\/title>/g, ''),
    title: 'The shutter caught mid-travel, seen from the lens: two curtains in front of the film with the slit of light between them, and the film running from its cassette across the gate onto the take-up spool'
  };
  fs.writeFileSync(path.join(out, 'shutter.json'), JSON.stringify(data));
  console.log('shutter', (JSON.stringify(data).length / 1024).toFixed(0) + ' KB; crop', data.viewBox);
}
