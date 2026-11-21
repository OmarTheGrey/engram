// Engram logo kit: a 16x16 pixel mark and Space Grotesk wordmarks outlined
// to paths, so every SVG renders the same in a README <img>, with no font.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// The kit lives one folder up; pass another folder to write elsewhere.
const OUT = process.argv[2] ?? join(HERE, "..");
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "png"), { recursive: true });

const fontDir = join(HERE, "node_modules/@fontsource/space-grotesk/files");
const font = (w) =>
  opentype.parse(readFileSync(join(fontDir, `space-grotesk-latin-${w}-normal.woff`)).buffer);
const BOLD = font(700);
const MEDIUM = font(500);

// Palette.
const P = {
  ink: "#07090e",
  tile: "#0c0f17",
  tileEdge: "#242c45",
  tileLit: "#141a2a",
  grid: "#121726",
  text: "#e9edf7",
  textDim: "#8b93a9",
  textDark: "#0b0e16",
  textDarkDim: "#4a5268",
  v: "#b49dff", // violet light
  V: "#7c5cff", // violet
  D: "#36268f", // violet shadow
  b: "#8fb0ff",
  B: "#4d7bff",
  d: "#1d3685",
  c: "#a8fbec",
  C: "#2fe0c0",
  t: "#0e5f56",
  W: "#f4fffd",
};

// The mark, 16 by 16. An E of three memory slabs, each lit from above and
// casting a shadow, with a memory trace of fading pixels leaving each slab.
const MARK = [
  "................",
  "................",
  "................",
  "..vvvvvvvv......",
  "..vVVVVVVVV.V...",
  "..vVDDDDDDD.....",
  "..bB............",
  "..bbbbbbb.......",
  "..bBBBBBBB.W.b..",
  "..bBdddddd......",
  "..cC............",
  "..cccccccc......",
  "..cCCCCCCCC.C...",
  "..ttttttttt.....",
  "................",
  "................",
];

function markPixels(ox = 0, oy = 0, s = 1) {
  const out = [];
  MARK.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      out.push(
        `<rect x="${ox + x * s}" y="${oy + y * s}" width="${s}" height="${s}" fill="${P[ch]}"/>`,
      );
    });
  });
  return out.join("");
}

/**
 * The mark's tile: a pixel rounded square with a one-pixel outline, a fill,
 * and a lit inner top row. Corner steps of two pixels.
 */
function tile(ox, oy, s, fill, edge) {
  const n = 16;
  const r = (x, y, w, c) =>
    `<rect x="${ox + x * s}" y="${oy + y * s}" width="${w * s}" height="${s}" fill="${c}"/>`;
  const out = [];
  for (let y = 0; y < n; y++) {
    const cut = y === 0 || y === n - 1 ? 2 : y === 1 || y === n - 2 ? 1 : 0;
    // The outline: the full row on the top and bottom, its two ends elsewhere.
    if (cut === 2) out.push(r(cut, y, n - 2 * cut, edge));
    else {
      out.push(r(cut, y, 1, edge), r(n - 1 - cut, y, 1, edge));
      if (cut === 1) out.push(r(cut + 1, y, n - 2 * cut - 2, fill));
      else out.push(r(1, y, n - 2, fill));
    }
  }
  out.push(r(2, 1, n - 4, P.tileLit));
  return out.join("");
}

/** Text outlined to one path, its box measured from the glyphs. */
function textPath(f, text, size, x, y, fill, tracking = 0) {
  let cx = x;
  const parts = [];
  for (const ch of text) {
    const g = f.charToGlyph(ch);
    parts.push(g.getPath(cx, y, size).toPathData(2));
    cx += (g.advanceWidth / f.unitsPerEm) * size + tracking;
  }
  const width = cx - x - tracking;
  return { svg: `<path fill="${fill}" d="${parts.join("")}"/>`, width };
}

function svg(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
}

function write(name, content, png) {
  writeFileSync(join(OUT, name), content);
  if (png) {
    const r = new Resvg(content, { fitTo: { mode: "width", value: png } });
    writeFileSync(join(OUT, "png", name.replace(/\.svg$/, `-${png}.png`)), r.render().asPng());
  }
}

/** A dotted pixel grid over a rectangle. */
function gridDots(w, h, step, color, id) {
  return `<defs><pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="${color}"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`;
}

// 1. The mark on its tile, and without it.
write(
  "engram-mark.svg",
  svg(256, 256, tile(0, 0, 16, P.tile, P.tileEdge) + markPixels(0, 0, 16), "Engram"),
  512,
);
write("engram-mark-transparent.svg", svg(256, 256, markPixels(0, 0, 16), "Engram"), 512);
write(
  "engram-favicon.svg",
  svg(16, 16, tile(0, 0, 1, P.tile, P.tileEdge) + markPixels(0, 0, 1), "Engram"),
  64,
);

// 2. The wordmark alone, for dark and light backgrounds.
for (const [name, color] of [
  ["engram-wordmark-light-text.svg", P.text],
  ["engram-wordmark-dark-text.svg", P.textDark],
]) {
  const t = textPath(BOLD, "engram", 96, 0, 0, color, -2);
  // Baseline at y=0; "g" descends. Box: ascender 0.72em above, 0.22em below.
  const h = Math.round(96 * 0.98);
  const body = textPath(BOLD, "engram", 96, 4, Math.round(96 * 0.74), color, -2).svg;
  write(name, svg(Math.ceil(t.width) + 8, h, body, "engram"), 800);
}

// 3. The horizontal logo: the mark, then the wordmark, on a transparent
// background (light or dark text) and on a dark card.
function horizontal(textColor, background) {
  const s = 8; // pixel size of the mark: 128 px
  const markBox = 16 * s;
  const gap = 28;
  const word = textPath(BOLD, "engram", 104, 0, 0, textColor, -2);
  const pad = background ? 40 : 0;
  const w = Math.ceil(pad + markBox + gap + word.width + pad + 8);
  const h = markBox + pad * 2;
  const baseline = pad + markBox / 2 + 104 * 0.26;
  const body =
    (background
      ? `<rect width="${w}" height="${h}" rx="0" fill="${background}"/>` +
        gridDots(w, h, 16, P.grid, "g")
      : "") +
    tile(pad, pad, s, P.tile, P.tileEdge) +
    markPixels(pad, pad, s) +
    textPath(BOLD, "engram", 104, pad + markBox + gap, baseline, textColor, -2).svg;
  return svg(w, h, body, "Engram");
}
write("engram-logo-light-text.svg", horizontal(P.text), 1000);
write("engram-logo-dark-text.svg", horizontal(P.textDark), 1000);
write("engram-logo-card.svg", horizontal(P.text, P.ink), 1000);

// 4. The README banner, 1280 by 320, and a 1280 by 640 social card.
function banner(W, H, big) {
  const s = big ? 12 : 9;
  const markBox = 16 * s;
  const left = big ? 120 : 96;
  const top = (H - markBox) / 2;
  const wordSize = big ? 120 : 92;
  const tx = left + markBox + (big ? 44 : 36);
  const word = textPath(BOLD, "engram", wordSize, tx, top + markBox * 0.52, P.text, -2);
  const tag = textPath(
    MEDIUM,
    "a control plane for agent memory",
    big ? 32 : 26,
    tx + 4,
    top + markBox * 0.52 + (big ? 58 : 46),
    P.textDim,
  );
  const pillars = ["govern", "twin", "distill"];
  // A trace of pixels fading out to the right edge, three rows, one per slab.
  const traces = [];
  const rows = [
    [top + 3 * s, P.V],
    [top + 7 * s, P.B],
    [top + 11 * s, P.C],
  ];
  const startX = Math.max(tx + word.width, tx + tag.width) + 60;
  rows.forEach(([y, color], i) => {
    for (let x = startX + i * 24; x < W - 40; x += 24) {
      const k = (x - startX) / (W - startX);
      const op = Math.max(0, 0.75 - k * 0.9);
      if (op <= 0.04) continue;
      if (((x / 24) | 0) % (3 + i) === 0) continue;
      traces.push(
        `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${color}" opacity="${op.toFixed(2)}"/>`,
      );
    }
  });
  let px = tx + 4;
  const chips = [];
  if (big) {
    for (const p of pillars) {
      const cy = Math.round(top + markBox * 0.52 + 92);
      const t = textPath(MEDIUM, p, 22, px + 14, cy + 28, P.text);
      const cw = Math.ceil(t.width) + 28;
      chips.push(
        `<rect x="${px}" y="${cy}" width="${cw}" height="40" fill="${P.tile}"/><rect x="${px}" y="${cy}" width="${cw}" height="2" fill="${P.tileEdge}"/>` +
          t.svg,
      );
      px += cw + 12;
    }
  }
  const cursor = `<rect x="${Math.ceil(tx + word.width + 10)}" y="${Math.round(top + markBox * 0.52 - wordSize * 0.06)}" width="${Math.round(wordSize * 0.36)}" height="${Math.round(wordSize * 0.08)}" fill="${P.C}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1.2s" repeatCount="indefinite"/></rect>`;
  const body =
    `<rect width="${W}" height="${H}" fill="${P.ink}"/>` +
    gridDots(W, H, 16, P.grid, "g") +
    traces.join("") +
    tile(left, top, s, P.tile, P.tileEdge) +
    markPixels(left, top, s) +
    word.svg +
    cursor +
    tag.svg +
    chips.join("");
  return svg(W, H, body, "Engram, a control plane for agent memory");
}
write("engram-banner.svg", banner(1280, 320, false), 1280);
write("engram-social.svg", banner(1280, 640, true), 1280);
console.log("ok");
