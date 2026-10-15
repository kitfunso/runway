// Static geometry of the cash cistern, built once at rest. Moving parts are built at LOW.start.
import * as W from "./world.mjs";

export function partsOf(k, P) {
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const depth = ([x, y]) => k.depthOf([x, y, 0], P);
  const byDepth = (points) => [...points].sort((a, b) => depth(a) - depth(b));
  const faceRect = (x0, x1, y, z0, z1) => k.pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);

  function base() {
    const B = W.BASE, H = W.BASE_H, F = W.FOOT_H;
    const out = [`<path class="iso-halo" d="${k.haloOf(B, -H - F, H, P)}"/>`];
    for (const [x, y] of byDepth(k.corners(B, 22))) {
      out.push(S(k.cylinder(x, y, 7, -H - F, 1.6, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 5.4, -H - F + 1.6, F - 1.6, P, 28), { tone: "mid" }));
    }
    out.push(S(k.slabOf(B, -H, H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(B, -H + 4, P), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(B, 5), 0, P), { tone: "lo" }));
    const screws = k.corners(B, 10);
    out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
    out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
    const plate = { x: 88, y: 43, w: 46, d: 10, r: 1 };
    out.push(S(k.slabOf(plate, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
    out.push(L(k.planOutline(k.insetPlan(plate, 1.4), 0.8, P, 3), { tone: "faint" }));
    [[93, 118], [93, 124], [93, 110]].forEach(([a, b], i) => out.push(L(k.lineOnTop([a, 46 + i * 2], [b, 46 + i * 2], 0.8, P), { tone: "lo", free: true })));
    out.push(D([at([plate.x + 2.6, plate.y + 5, 0.8]), at([plate.x + plate.w - 2.6, plate.y + 5, 0.8])], { size: 0.42 }));
    return out.join("");
  }

  function capillary() {
    const z = 0.6;
    const pts = [[W.TANK.x + W.TANK.w + 3, -44, z], [W.PRINTER.x + W.PRINTER.w + 8, -50, z], [W.DIAL[0], -50, z], [W.DIAL[0], W.DIAL[1] - 12, z]];
    const pad = S(k.slabOf({ x: W.TANK.x + W.TANK.w, y: -47, w: 4, d: 6, r: 1 }, 0, 4, P, 3), { tone: "mid" });
    return pad + k.wireSvg(at(pts[0]), at(pts[3]), { via: pts.slice(1, 3).map(at), tone: "mid", size: 0.9 });
  }

  function dial() {
    const [x, y] = W.DIAL, R = W.DIAL_R, top = W.DIAL_TOP;
    const out = [];
    out.push(S(k.cylinder(x, y, 11, 0, 2, P, 40), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4, 2, W.DIAL_Z - 2, P, 24), { tone: "mid" }));
    out.push(L(k.sideArc(x, y, 4, 6, P, 12), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, R, W.DIAL_Z, top - W.DIAL_Z, P, 64, 0.8), { tone: "hi", crease: "lo" }));
    out.push(L(k.knurl(x, y, R, top - 2.6, top, 80, P, 0.3), { tone: "lo" }));
    out.push(L(k.sideArc(x, y, R, top - 2.6, P, 40), { tone: "faint" }));
    out.push(L(k.ring(x, y, R - 2, top, P, 64), { tone: "lo" }));
    const ticks = k.radialTicks(x, y, R - 2.6, 31, 5, top, [1.1, 2.4], P, -Math.PI * 0.75, Math.PI * 1.5);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    const a = dialAngle(W_FLOOR);
    out.push(L(k.lineOnTop([x + Math.sin(a) * (R - 2.6), y - Math.cos(a) * (R - 2.6)], [x + Math.sin(a) * (R - 6.4), y - Math.cos(a) * (R - 6.4)], top, P), { tone: "hi" }));
    out.push(S(k.slabOf({ x: x + R - 1, y: y - 2.2, w: 4.4, d: 4.4, r: 1 }, W.DIAL_Z + 1.5, 4, P, 3), { tone: "mid" }));
    out.push(S(k.cylinder(x + R + 4.6, y, 2.2, W.DIAL_Z + 1, 6, P, 18), { tone: "mid" }));
    out.push(L(k.knurl(x + R + 4.6, y, 2.2, W.DIAL_Z + 1, W.DIAL_Z + 7, 16, P), { tone: "lo" }));
    return out.join("");
  }

  function seat() {
    const T = W.TANK;
    const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(T, -3), 0, W.SEAT_H, P)}" style="opacity:.18"/>`];
    out.push(S(k.slabOf(k.insetPlan(T, -3), 0, W.SEAT_H, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(k.insetPlan(T, -3), 2.4, P, 6), { tone: "faint" }) }));
    out.push(D(k.corners(k.insetPlan(T, -3), 3).map(([x, y]) => at([x, y, W.SEAT_H])), { size: 0.45 }));
    return out.join("");
  }

  const postPlans = () => k.corners(W.TANK, 0).map(([x, y]) => ({
    x: x < 0 && x === W.TANK.x ? x : x - W.POST_W, y: y === W.TANK.y ? y : y - W.POST_W, w: W.POST_W, d: W.POST_W, r: 0.6,
  }));
  const post = (plan) => S(k.slabOf(plan, W.SEAT_H, W.GLASS_H, P, 3, 0.3), { tone: "mid" });
  const postsByDepth = () => [...postPlans()].sort((a, b) => depth([a.x, a.y]) - depth([b.x, b.y]));

  function tankBack() {
    const posts = postsByDepth();
    const T = W.TANK, z0 = W.SEAT_H, z1 = W.TANK_TOP;
    const out = [post(posts[0])];
    out.push(L(k.segment([T.x + W.POST_W, T.y, z0 + 0.4], [T.x + T.w - W.POST_W, T.y, z0 + 0.4], P) + k.segment([T.x, T.y + W.POST_W, z0 + 0.4], [T.x, T.y + T.d - W.POST_W, z0 + 0.4], P), { tone: "faint" }));
    return out.join("");
  }

  function rodAndCollar() {
    const z0 = W.SEAT_H, z1 = W.TANK_TOP;
    const out = [];
    out.push(S(k.cylinder(W.ROD[0], W.ROD[1], 3.4, z0, 2, P, 24), { tone: "mid" }));
    out.push(S(k.cylinder(W.ROD[0], W.ROD[1], 1.3, z0 + 2, z1 - z0 - 2, P, 16), { tone: "mid", crease: "none" }));
    const cz = W.zOf(FLOOR_POUNDS);
    out.push(S(k.cylinder(W.ROD[0], W.ROD[1], 4.6, cz - 3, 3, P, 28, 0.3), { tone: "hi", crease: "lo" }));
    out.push(S(k.slabOf({ x: W.ROD[0] + 4, y: W.ROD[1] - 1.2, w: 2.6, d: 2.4, r: 0.6 }, cz - 2.6, 2.2, P, 2), { tone: "mid", crease: "none" }));
    out.push(L(k.sideArc(W.ROD[0], W.ROD[1], 4.6, cz - 1.5, P, 20), { tone: "faint" }));
    return out.join("");
  }

  function tankFront() {
    const posts = postsByDepth();
    const T = W.TANK, z0 = W.SEAT_H, z1 = W.TANK_TOP, F = W.FRONT_Y;
    const out = posts.slice(1).map(post);
    const xr = T.x + T.w - W.POST_W, zt = z1 - 3;
    const glint = (a, b) => L(k.segment(a, b, P), { tone: "faint" });
    out.push(glint([T.x + 34, F, zt], [xr, F, zt - 44]), glint([T.x + 54, F, zt], [xr, F, zt - 28]));
    out.push(glint([T.x + T.w, T.y + 12, zt], [T.x + T.w, T.y + T.d - W.POST_W, zt - 30]));
    out.push(L(faceRect(W.PUSH[0] - 1.6, W.PUSH[0] + 1.6, F, W.zOf(36000), z1 - 6), { tone: "lo" }));
    out.push(ruler());
    out.push(rim());
    return out.join("");
  }

  function ruler() {
    const F = W.FRONT_Y + 0.6, x0 = W.TANK.x + W.POST_W + 1, x1 = x0 + 8;
    const out = [S(k.slabOf({ x: x0, y: W.FRONT_Y, w: 8, d: 0.6, r: 0.2 }, W.SEAT_H + 2, W.GLASS_H - 6, P, 2), { tone: "lo", crease: "none" })];
    const minor = [], major = [];
    for (let p = 0; p <= 60000; p += 2000) {
      const z = W.zOf(p);
      (p % 10000 === 0 ? major : minor).push(k.segment([x1, F, z], [x1 - (p % 10000 === 0 ? 4.4 : 2.4), F, z], P));
    }
    out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
    const fz = W.zOf(FLOOR_POUNDS);
    out.push(L(k.segment([x1, F, fz], [x0, F, fz], P), { tone: "hi" }));
    out.push(D([at([x0 + 1.6, F, W.SEAT_H + 4]), at([x0 + 1.6, F, W.TANK_TOP - 6])], { size: 0.4 }));
    return out.join("");
  }

  function rim() {
    const T = W.TANK, z = W.TANK_TOP;
    const out = [];
    out.push(S(k.slabOf({ x: T.x, y: T.y, w: T.w, d: W.POST_W, r: 0.6 }, z - 3, 3, P, 3, 0.3), { tone: "mid" }));
    out.push(S(k.slabOf({ x: T.x, y: T.y, w: W.POST_W, d: T.d, r: 0.6 }, z - 3, 3, P, 3, 0.3), { tone: "mid" }));
    out.push(S(k.slabOf({ x: T.x, y: W.ROD[1] - 3.5, w: T.w, d: 7, r: 1 }, z, 3, P, 4, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: T.x + T.w - W.POST_W, y: T.y, w: W.POST_W, d: T.d, r: 0.6 }, z - 3, 3, P, 3, 0.3), { tone: "mid" }));
    out.push(S(k.slabOf({ x: T.x, y: T.y + T.d - W.POST_W, w: T.w, d: W.POST_W, r: 0.6 }, z - 3, 3, P, 3, 0.3), { tone: "mid" }));
    out.push(D([T.x + 6, T.x + T.w - 6].map((x) => at([x, W.ROD[1], z + 3])), { size: 0.45 }));
    out.push(S(k.cylinder(W.ROD[0], W.ROD[1], 2.6, z + 3, 2.4, P, 20), { tone: "mid" }));
    return out.join("");
  }

  function funnel() {
    const [x, y] = W.FUNNEL, z = W.TANK_TOP + 3;
    const out = [];
    out.push(S(k.cylinder(x, y, 3, z, 3, P, 24), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, 5.5, z + 3, 3, P, 28), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, 9, z + 6, 3, P, 36), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, 12.5, z + 9, 4, P, 44, 0.5), { tone: "hi", crease: "lo" }));
    out.push(L(k.ring(x, y, 10.6, z + 13, P, 44), { tone: "lo" }));
    out.push(L(k.ring(x, y, 2.4, z + 13, P, 16), { tone: "mid" }));
    out.push(`<g data-part="cup">${S(k.cylinder(x, y, 10.2, z + 12.2, 0.6, P, 40), { tone: "lo", flat: true, crease: "none" })}</g>`);
    return out.join("");
  }

  function manifold() {
    const M = W.MANIFOLD, z0 = W.MANIFOLD_Z0;
    const out = [];
    for (const x of [M.x + 8, M.x + M.w - 8]) {
      out.push(S(k.slabOf({ x: x - 4, y: M.y + 1, w: 8, d: M.d - 2, r: 1 }, 0, z0, P, 3, 0.4), { tone: "lo" }));
    }
    out.push(S(k.slabOf({ x: -104, y: W.FRONT_Y, w: 10, d: M.y - W.FRONT_Y + 1, r: 1 }, z0 + 1, 7, P, 3, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf(M, z0, W.MANIFOLD_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(M, z0 + 3, P, 4), { tone: "faint" }) }));
    out.push(D([M.x + 4, M.x + M.w - 4].map((x) => at([x, M.y + M.d / 2, W.MANIFOLD_TOP])), { size: 0.45 }));
    return out.join("");
  }

  return { base, capillary, dial, seat, tankBack, rodAndCollar, tankFront, funnel, manifold, at, S, L, D, depth, faceRect };
}

export const FLOOR_POUNDS = 40000;
export const W_FLOOR = FLOOR_POUNDS;
export const DIAL_FULL = 62500;
export const dialAngle = (pounds) => -Math.PI * 0.75 + Math.min(1, Math.max(0, pounds / DIAL_FULL)) * Math.PI * 1.5;
