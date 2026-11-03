#!/usr/bin/env node
// Renders the rangefinder teardown at five focus settings for the focus challenge's guide
// (assets/img/teardown/rangefinder-*.svg). Every frame fits the page the same way (the model's
// hidden frame of trails) and is cropped to one rectangle round all of them, labels included,
// so the slider swaps drawings that line up exactly. Styles are left to the page, scoped by
// the class on each svg, with a plain fallback for opening a file on its own.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const tools = path.join(__dirname, '../tools/assets');
const context = {console, structuredClone};
context.self = context;
vm.createContext(context);
for (const f of ['sheet.js', 'geometry.js', 'projection.js']) vm.runInContext(fs.readFileSync(path.join(tools, f), 'utf8'), context, {filename: f});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'model.js'), 'utf8'), context, {filename: 'model.js'});
const model = context.DrawingModels.rangefinder, SHEET = context.TechnicalSheet;

const STOPS = [['inf', 0, '∞'], ['3m', 1 / 3, '3 m'], ['1-5m', 1 / 1.5, '1.5 m'], ['1m', 1, '1 m'], ['0-7m', 1.4286, '0.7 m']];
const out = path.join(__dirname, '../../assets/img/teardown');
fs.mkdirSync(out, {recursive: true});

// labels set larger than the print size (3.2 mm), for reading on a screen
const LABEL = 4.6;
const frames = STOPS.map(([slug, dioptres, label]) => ({slug, label, r: model({dioptres}, {explosion: 1, fitExplosion: 1, isolated: null, fill: false, annotate: true})}));
// one crop for all: the ink and the labels of every frame, the hidden frame trails left out
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
const take = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
for (const {r} of frames) {
  const ink = r.markup.replace(/<g data-trails="">[\s\S]*?<\/g>/, '');
  for (const [, d] of ink.matchAll(/ d="([^"]*)"/g)) {
    const nums = d.replace(/[MLC]/g, ' ').trim().split(/\s+/).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) take(nums[i], nums[i + 1]);
  }
  for (const [, x, y, anchor, text] of ink.matchAll(/<text[^>]* x="([^"]*)" y="([^"]*)"[^>]*text-anchor="([^"]*)"[^>]*>([^<]*)<\/text>/g)) {
    const w = text.length * LABEL * 0.64, X = +x, Y = +y;
    take(anchor === 'end' ? X - w : X, Y - LABEL);
    take(anchor === 'end' ? X : X + w, Y + 1);
  }
}
const pad = 4, box = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad].map(n => +n.toFixed(2));
const style = '.td-rangefinder path{fill:none;stroke:#222;stroke-linejoin:round}' + SHEET.css('technical').replace(/\[data-line-role/g, '.td-rangefinder [data-line-role')
  + '.td-rangefinder [data-trails]{display:none}.td-rangefinder text{fill:#222;font-family:Helvetica,Arial,sans-serif}.td-rangefinder circle{fill:#222}';
for (const {slug, label, r} of frames) {
  const title = 'How a rangefinder focuses: the lens focused at ' + label;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="td-rangefinder" viewBox="${box.join(' ')}" width="${box[2]}mm" height="${box[3]}mm" role="img" aria-label="${title}">`
    + `<title>${title}</title><desc>Illustrative concept, not to scale: angles and travel drawn five times their size. The classic swinging-mirror layout of a coincident-image rangefinder, not any one camera's construction.</desc>`
    + `<style>${style}</style>${r.markup.replace(/font-size="3\.2"/g, `font-size="${LABEL}"`)}</svg>\n`;
  fs.writeFileSync(path.join(out, `rangefinder-${slug}.svg`), svg);
  console.log(slug.padEnd(5), (svg.length / 1024).toFixed(0) + ' KB', 'mirror', (r.meta.phi * 180 / Math.PI).toFixed(1) + '°', 'cam', r.meta.camTravel.toFixed(1) + ' mm', 'subject', isFinite(r.meta.Ys) ? r.meta.Ys.toFixed(0) + ' mm' : '∞');
}
console.log('crop', box.join(' '));
