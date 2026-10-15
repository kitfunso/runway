// Builds public/how-it-works/index.html: node figure/build.mjs [--light]
// Kit: the anatomy skill at $ANATOMY_HOME (default ~/.claude/skills/anatomy).
// Low points in model.mjs: lib/optimiser.ts simulate() on data/*.json with DEMO_REPLAY=1.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as W from "./world.mjs";
import * as M from "./model.mjs";
import { partsOf, dialAngle } from "./parts.mjs";
import { valvesOf } from "./valves.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = process.env.ANATOMY_HOME ?? join(homedir(), ".claude", "skills", "anatomy");
const k = await import(pathToFileURL(join(SKILL, "kit", "iso-kit.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(SKILL, "scripts", "inline-kit.mjs")).href);
const theme = "light"; // host page is warm paper; --light is accepted and implied

const WIDTH = 600;
const HEIGHT = 400;
const AZIMUTH = 38;

const P = k.fitProjection(
  [
    ...k.boxCorners(W.BASE, -W.BASE_H - W.FOOT_H, 0),
    [W.FUNNEL[0], W.FUNNEL[1], W.TANK_TOP + 16],
    [W.TANK.x, W.TANK.y, W.TANK_TOP + 3],
    [W.TANK.x + W.TANK.w, W.TANK.y + W.TANK.d, W.TANK_TOP + 3],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: AZIMUTH },
);

const parts = partsOf(k, P);
const valves = valvesOf(k, P, parts);
const { S } = parts;
const startZ = W.zOf(M.LOW.start);
const byDepthX = (xs) => [...xs].sort((a, b) => parts.depth([a, W.VALVE_Y]) - parts.depth([b, W.VALVE_Y]));

function float() {
  const [x, y] = W.ROD, z = startZ;
  const out = [];
  out.push(S(k.cylinder(x, y, W.FLOAT_R, z - 3, 6, P, 48, 0.8), { tone: "hi", lit: true }));
  out.push(S(k.cylinder(x, y, 4, z + 3, 2, P, 28, 0.3), { tone: "hi", lit: true }));
  out.push(S(k.slabOf({ x: x - 1.2, y: y + 3, w: 2.4, d: W.PUSH[1] - y - 1, r: 0.6 }, z + 1.6, 2, P, 2), { tone: "hi", lit: true, crease: "none" }));
  out.push(S(k.cylinder(W.PUSH[0], W.PUSH[1], 1.8, z + 0.6, 4, P, 16), { tone: "hi", lit: true }));
  return out.join("");
}

const liveGroup = (name, extra = "") => `<g data-part="${name}"${extra}></g>`;
const lowerValves = byDepthX(W.VALVE_X).map((x) => valves.lower(x, W.VALVE_X.indexOf(x))).join("");
const upperValves = byDepthX(W.VALVE_X).map((x) => valves.upper(x)).join("");
const wheels = byDepthX(W.VALVE_X).map((x) => valves.wheel(x, W.VALVE_X.indexOf(x))).join("");
const rocker = valves.rocker();

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench-top cash cistern. A glass tank holds water whose level is the lowest cash balance Runway projects. A float on a guide rod reads it; a stop collar on the rod marks the 40,000 pound floor. Four valves along the front pay suppliers into trays. A rocker linked to the float locks the second valve while paying it would take the level below the collar. A punched card with a pin jams the fourth valve, a vendor the finance manager rejected. A funnel on top takes in Acme's payment, and a printer beside the tank feeds out one ruled line per payment.",
  body: [
    parts.base(),
    parts.capillary(),
    parts.seat(),
    parts.tankBack(),
    liveGroup("water", ' class="water"'),
    parts.rodAndCollar(),
    `<g data-part="float">${float()}</g>`,
    liveGroup("rod-above"),
    liveGroup("stream", ' class="stream"'),
    parts.tankFront(),
    parts.funnel(),
    valves.printer(),
    valves.tape(),
    parts.dial(),
    `<path data-part="needle" class="iso-line" data-tone="hi" data-free="start" d="" style="stroke-width:1.1"/>`,
    parts.manifold(),
    valves.trays(),
    lowerValves,
    `<g class="drips" data-part="drips">${Array.from({ length: 12 }, () => '<circle class="drip" r="0.9" cx="0" cy="0" opacity="0"/>').join("")}</g>`,
    valves.rockerPosts(),
    valves.card(),
    `<g data-part="rocker">${rocker.back}</g>`,
    upperValves,
    `<g data-part="rocker-front">${rocker.front}</g>`,
    valves.pin(),
    liveGroup("push"),
    wheels,
  ],
});

const moduleOf = (file, name) => {
  const src = readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "");
  const names = [...src.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
  return `const ${name} = (() => {${src.replace(/^export /gm, "")}\nreturn { ${names.join(", ")} };})();`;
};

const live = `
${moduleOf("world.mjs", "W")}
${moduleOf("model.mjs", "M")}
const P = ${JSON.stringify(P)};
const START_Z = ${startZ};
const DIAL_FULL = 62500;
const dialAngle = ${dialAngle.toString()};
${readFileSync(join(HERE, "live.js"), "utf8")}
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "How Runway works",
  hint: "Press space to pay Acme's invoice",
  readout: M.readoutOf(M.sceneAt(0)),
  caption:
    "The water is the lowest balance Runway projects over the next 60 days, and the collar on the float's rod is the £40,000 floor. " +
    "Small invoices from trusted suppliers flow out on their own: £4,500 to Brightleaf and £4,400 to Coral Cloud. " +
    "The rocker locks the early £4,400 Halcyon payment, because it would take the low point to £37,645, below the floor. " +
    "When Acme Ltd pays its £6,000 invoice the level rises, the rocker lifts and the held payment goes out. " +
    "Each payment prints a line on the tape, a hash-chained audit trail. " +
    "The pin in the punched card is a rejection hippo remembered, so that vendor's valve stays shut.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Cash cistern. Press space or click to pay Acme's invoice into the tank.">${svg}</div>`,
});

const HOST_CSS = `
html,body.iso{height:100%;overflow:hidden}
body.iso[data-theme="light"]{--anatomy-page:#F7F5F0;--anatomy-card:#FFFFFF;background:#F7F5F0}
@media (max-width:560px){.iso-plate{overflow:hidden}.iso-plate .iso-svg{transform:scale(1.18)}}
.iso-page{width:100%;height:100%;margin:0;padding:1px;display:flex;flex-direction:column}
.iso-figure{margin:0;flex:1;min-height:0;display:flex;flex-direction:column}
.iso-plate{flex:1;min-height:0;display:flex;box-shadow:0 0 0 1px #E3DFD6;border-radius:6px}
.iso-stage{flex:1;min-height:0;display:flex}
.iso-plate .iso-svg{width:100%;height:100%}
.iso-legend{margin-top:10px;padding:0 2px 2px}
.iso-stage{outline:none;cursor:pointer;touch-action:pan-y}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.water .iso-fill{fill:#e3e8eb}.water{opacity:.72}
.water .iso-top{fill:#eef2f4}.water .iso-shade{fill:#d9dfe3}
.stream .iso-fill,.stream .iso-top,.stream .iso-shade{fill:#c2cbd1}
.drip{fill:var(--anatomy-mid)}
.iso[data-theme="dark"] .water .iso-fill{fill:#1d2226}
.iso[data-theme="dark"] .stream .iso-fill{fill:#2a3036}
`;

const out = join(HERE, "..", "public", "how-it-works");
mkdirSync(out, { recursive: true });
const html = k.pageHtml({ title: "How Runway works", theme, body, script: kitScript() + live, width: 760 }).replace("</style>", HOST_CSS + "</style>");
const file = "index.html";
writeFileSync(join(out, file), html);
console.log("wrote", join("public", "how-it-works", file));
