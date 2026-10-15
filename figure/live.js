// Inlined into the page after the kit, W (world), M (model), P and START_Z.
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (name) => svg.querySelector(`[data-part="${name}"]`);
const els = { water: $("water"), float: $("float"), rodAbove: $("rod-above"), stream: $("stream"), needle: $("needle"), push: $("push"), rocker: $("rocker"), rockerFront: $("rocker-front"), tape: $("tape-lines"), cup: $("cup") };
const spokes = [...svg.querySelectorAll('[data-part="spoke"]')];
const drips = [...svg.querySelectorAll(".drip")];
const pools = [...svg.querySelectorAll('[data-part="pool"]')];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const inner = { ...W.TANK, x: W.TANK.x + W.POST_W, y: W.TANK.y + W.POST_W, w: W.TANK.w - 2 * W.POST_W, d: W.TANK.d - 2 * W.POST_W, r: 1 };
const HOLD_AT = M.TOUR.end - 0.6;

let clock = 0, frame = 0, last = 0, visible = false, touring = !still.matches, manual = false, idle = 0;
let level = M.LOW.start, lift = 0, advances = 0, tapeAt = 0, lastPaid = 0;

function draw(scene, t) {
  const z = W.zOf(level);
  els.water.innerHTML = solidSvg(slabOf(inner, W.SEAT_H, z - W.SEAT_H, P, 4), { tone: "lo", crease: "none" });
  els.float.setAttribute("transform", translateAlong(P, [0, 0, z - START_Z]));
  els.rodAbove.innerHTML = solidSvg(cylinder(W.ROD[0], W.ROD[1], 1.3, z + 5, W.TANK_TOP - z - 5, P, 16), { tone: "mid", crease: "none" });
  const armZ = z + 0.6;
  const rockTop = W.ROCKER_Z + 2.4 + lift;
  els.push.innerHTML = solidSvg(cylinder(W.PUSH[0], W.PUSH[1], 0.9, rockTop, armZ - rockTop, P, 14), { tone: "hi", crease: "none" });
  const stream = scene.pour;
  els.stream.innerHTML = stream > 0.02 ? solidSvg(cylinder(W.FUNNEL[0], W.FUNNEL[1], 1.2, z, W.TANK_TOP - z, P, 14), { tone: "mid", crease: "none" }) : "";
  els.stream.setAttribute("opacity", String(Math.min(1, stream * 1.6)));
  els.cup.setAttribute("opacity", String(Math.min(1, stream * 1.6)));
  const lifted = translateAlong(P, [0, 0, lift]);
  els.rocker.setAttribute("transform", lifted);
  els.rockerFront.setAttribute("transform", lifted);
  const a = dialAngle(level), [dx, dy] = [W.DIAL[0], W.DIAL[1]], R = W.DIAL_R - 4;
  els.needle.setAttribute("d", lineOnTop([dx - Math.sin(a) * 3, dy + Math.cos(a) * 3], [dx + Math.sin(a) * R, dy - Math.cos(a) * R], W.DIAL_TOP + 0.2, P));
  spokes.forEach((el, i) => el.setAttribute("d", spokeAt(W.VALVE_X[i], scene.open[i] * 0.75)));
  drawDrips(scene, t);
  els.tape.setAttribute("transform", translateAlong(P, [0, tapeAt % W.TAPE_PITCH, 0]));
  const text = M.readoutOf({ ...scene, low: Math.abs(level - scene.low) < 40 ? scene.low : level });
  if (readout.textContent !== text) readout.textContent = text;
}

function spokeAt(x, turn) {
  const ang = turn * Math.PI * 2, y = W.VALVE_Y, zt = W.WHEEL_Z + 2.2;
  return lineOnTop([x + Math.cos(ang) * 1.8, y + Math.sin(ang) * 1.8], [x + Math.cos(ang) * 6.6, y + Math.sin(ang) * 6.6], zt, P);
}

function drawDrips(scene, t) {
  W.VALVE_X.forEach((x, i) => {
    const flow = scene.open[i] > 0.3 ? scene.open[i] : 0;
    for (let j = 0; j < 3; j++) {
      const el = drips[i * 3 + j];
      const u = (t * 1.7 + j / 3) % 1;
      const [px, py] = iso([x, W.NOZZLE_Y, W.MANIFOLD_TOP - 9 - u * u * (W.MANIFOLD_TOP - 11)], P);
      el.setAttribute("cx", px.toFixed(2));
      el.setAttribute("cy", py.toFixed(2));
      el.setAttribute("opacity", (flow * Math.min(1, (1 - u) * 4)).toFixed(2));
    }
  });
  pools.forEach((el, i) => el.setAttribute("opacity", String(0.5 + 0.5 * Math.min(1, scene.open[i] * 2))));
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring || manual) clock += dt;
  if (manual && clock > HOLD_AT) clock = HOLD_AT;
  if (touring && !manual && clock >= M.TOUR.end) clock = 0;
  const scene = M.sceneAt(clock);
  if (scene.paid > lastPaid) advances += scene.paid - lastPaid;
  lastPaid = scene.paid;
  const calm = still.matches;
  const follow = (v, to, tau) => (calm ? to : v + (to - v) * (1 - Math.exp(-dt / tau)));
  level = follow(level, scene.low, 0.55);
  lift = follow(lift, M.locked(level) ? 0 : 4, 0.18);
  tapeAt = follow(tapeAt, advances * W.TAPE_PITCH, 0.3);
  draw(scene, now / 1000);
  const settled = !touring && Math.abs(level - scene.low) < 1 && Math.abs(tapeAt - advances * W.TAPE_PITCH) < 0.01 && clock >= HOLD_AT;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function payAcme() {
  clearTimeout(idle);
  if (still.matches) return;
  if (clock < M.TOUR.pour - 0.4 || clock >= HOLD_AT) clock = M.TOUR.pour - 0.4;
  manual = true;
  touring = false;
  idle = setTimeout(() => { manual = false; touring = !still.matches; clock = 0; run(); }, 9000);
  run();
}
stage.addEventListener("pointerdown", payAcme);
stage.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Enter") return;
  event.preventDefault();
  payAcme();
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) { clock = HOLD_AT; level = M.LOW.afterRelease; advances = 3; tapeAt = 3 * W.TAPE_PITCH; lastPaid = 3; }
draw(M.sceneAt(clock), 0);
