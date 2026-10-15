// Valves, rocker lock, memory card and the audit tape printer.
import * as W from "./world.mjs";

export function valvesOf(k, P, parts) {
  const { at, S, L, D, depth } = parts;
  const y = W.VALVE_Y;
  const stemTop = W.WHEEL_Z;

  function trays() {
    const out = [];
    for (const x of [...W.VALVE_X].sort((a, b) => depth([a, 0]) - depth([b, 0]))) {
      const plan = { x: x - 8, y: W.TRAY_Y, w: 16, d: 13, r: 2 };
      out.push(S(k.slabOf(plan, 0, 3, P, 4, 0.5), { tone: "mid" }));
      out.push(L(k.planOutline(k.insetPlan(plan, 1.6), 3, P, 4), { tone: "lo" }));
      out.push(`<g data-part="pool" data-x="${x}">${S(k.slabOf(k.insetPlan(plan, 2.4), 1.2, 1.4, P, 3), { tone: "lo", flat: true, crease: "none" })}</g>`);
    }
    return out.join("");
  }

  function lower(x, index) {
    const out = [];
    const z0 = W.MANIFOLD_TOP;
    out.push(S(k.slabOf({ x: x - 2, y: y + 3, w: 4, d: W.NOZZLE_Y - y - 1, r: 1.4 }, z0 - 6, 4, P, 3, 0.3), { tone: "mid" }));
    out.push(S(k.cylinder(x, W.NOZZLE_Y, 2.4, z0 - 9, 7, P, 20, 0.3), { tone: "mid" }));
    out.push(L(k.ring(x, W.NOZZLE_Y, 1.2, z0 - 9, P, 12), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, z0, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, z0 + 2, W.BODY_TOP - z0 - 2, P, 28, 0.4), { tone: "hi", crease: "lo" }));
    out.push(L(k.sideArc(x, y, 4.6, z0 + 5, P, 20), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, 3.2, W.BODY_TOP, 3, P, 6), { tone: "mid" }));
    out.push(S(k.cylinder(x, y, 1.1, W.BODY_TOP + 3, W.CARD_Z - W.BODY_TOP - 3, P, 12), { tone: "mid", crease: "none" }));
    return out.join("");
  }

  function card() {
    const plan = { x: -130, y: y - 4, w: 128, d: 8, r: 1 };
    const out = [];
    for (const x of [plan.x + 3, plan.x + plan.w - 3]) {
      out.push(S(k.cylinder(x, y, 1.6, W.MANIFOLD_TOP, W.CARD_Z - W.MANIFOLD_TOP, P, 14), { tone: "mid", crease: "none" }));
    }
    out.push(S(k.slabOf(plan, W.CARD_Z, 0.8, P, 3, 0.2), { tone: "hi", crease: "lo" }));
    const zt = W.CARD_Z + 0.8;
    const holes = [];
    W.VALVE_X.forEach((x, i) => {
      holes.push(k.ring(x, y, 2, zt, P, 16));
      for (let row = 0; row < 3; row++) {
        const punched = (i + row) % 2 === 0 || i === 3;
        if (punched) holes.push(k.planOutline({ x: x + 5 + row * 3.4, y: y - 2.6, w: 1.8, d: 1.2, r: 0.4 }, zt, P, 2));
      }
    });
    out.push(L(holes.join(""), { tone: "mid" }));
    for (const x of [plan.x, plan.x + plan.w - 6]) {
      out.push(S(k.slabOf({ x, y: plan.y - 1, w: 6, d: plan.d + 2, r: 0.8 }, W.CARD_Z - 1, 3, P, 3, 0.3), { tone: "mid" }));
      out.push(D([at([x + 3, y, W.CARD_Z + 2])], { size: 0.45 }));
    }
    out.push(k.faceTextSvg(k.topMatrix([-24, y + 0.6], zt, P, "x"), "hippo", { size: 2.2, tone: "lo", anchor: "middle" }));
    return out.join("");
  }

  function pin() {
    const x = W.VALVE_X[3] + 5;
    const out = [];
    out.push(S(k.cylinder(x, y - 2, 0.8, W.CARD_Z - 3, 9, P, 12), { tone: "hi", crease: "none" }));
    out.push(S(k.cylinder(x, y - 2, 1.7, W.CARD_Z + 6, 1.2, P, 16), { tone: "hi", crease: "lo" }));
    out.push(S(k.slabOf({ x: W.VALVE_X[3] + 1, y: y - 2.6, w: 4, d: 1.2, r: 0.4 }, W.CARD_Z + 2.4, 1.6, P, 2), { tone: "mid", crease: "none" }));
    return out.join("");
  }

  function upper(x) {
    const out = [];
    out.push(S(k.cylinder(x, y, 1.1, W.CARD_Z + 0.8, stemTop - W.CARD_Z - 0.8, P, 12), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(x, y, 2.2, W.ROCKER_Z - 1.5, 1.5, P, 16), { tone: "mid" }));
    return out.join("");
  }

  function wheel(x, index) {
    const out = [];
    out.push(S(k.cylinder(x, y, 6.6, stemTop, 2.2, P, 40, 0.3), { tone: "mid" }));
    out.push(L(k.knurl(x, y, 6.6, stemTop, stemTop + 2.2, 40, P), { tone: "lo" }));
    out.push(L(k.ring(x, y, 4.6, stemTop + 2.2, P, 32), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, 1.8, stemTop + 2.2, 1.2, P, 14), { tone: "mid" }));
    out.push(`<path data-part="spoke" data-i="${index}" class="iso-line" data-tone="hi" d="${spokeAt(x, 0)}"/>`);
    return out.join("");
  }
  const spokeAt = (x, turn) => {
    const a = turn * Math.PI * 2;
    return k.lineOnTop([x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8], [x + Math.cos(a) * 6.6, y + Math.sin(a) * 6.6], stemTop + 2.2, P);
  };

  function rocker() {
    const x0 = -132, x1 = -30, ry = y - 4;
    const out = [];
    out.push(S(k.slabOf({ x: x0, y: ry - 2, w: x1 - x0, d: 4, r: 1 }, W.ROCKER_Z, 2.4, P, 3, 0.3), { tone: "mid" }));
    out.push(D([x0 + 3, x1 - 3].map((x) => at([x, ry, W.ROCKER_Z + 2.4])), { size: 0.45 }));
    const prong = (x) => S(k.slabOf({ x, y: ry + 1.6, w: 1.5, d: 4.8, r: 0.4 }, W.ROCKER_Z, 2.4, P, 2, 0.2), { tone: "hi", crease: "lo" });
    const vx = W.VALVE_X[1];
    const [far, near] = [vx - 2.9, vx + 1.4].sort((a, b) => depth([a, y]) - depth([b, y]));
    return { back: out.join("") + prong(far), front: prong(near) };
  }

  function rockerPosts() {
    const ry = y - 4;
    return [-128, -34].map((x) => S(k.cylinder(x, ry, 1.5, W.MANIFOLD_TOP, W.ROCKER_Z - W.MANIFOLD_TOP, P, 14), { tone: "mid", crease: "none" })).join("");
  }

  function printer() {
    const B = W.PRINTER, h = W.PRINTER_H;
    const out = [`<path class="iso-halo" d="${k.haloOf(B, 0, h, P)}" style="opacity:.2"/>`];
    out.push(S(k.slabOf(B, 0, h, P, 4, 1), { tone: "mid", inner: L(k.sideSeam(B, 8, P, 4), { tone: "faint" }) }));
    out.push(L(k.planOutline(k.insetPlan(B, 4), h, P, 4), { tone: "faint" }));
    for (let i = 0; i < 5; i++) out.push(L(k.planOutline({ x: B.x + 8, y: B.y + 8 + i * 4, w: 14, d: 1.6, r: 0.8 }, h, P, 2), { tone: "lo" }));
    const roll = [B.x + 40, B.y + 18];
    out.push(S(k.cylinder(roll[0], roll[1], 11, h, 2, P, 40), { tone: "lo" }));
    out.push(S(k.cylinder(roll[0], roll[1], 10, h + 2, 7, P, 44, 0.4), { tone: "hi", crease: "lo" }));
    out.push(L([3, 5.5, 8].map((r) => k.ring(roll[0], roll[1], r, h + 9, P, 36)).join(""), { tone: "faint" }));
    out.push(S(k.cylinder(roll[0], roll[1], 1.6, h + 9, 2, P, 14), { tone: "mid" }));
    const crank = [B.x + B.w - 6, B.y + B.d - 7];
    out.push(S(k.cylinder(crank[0], crank[1], 3.4, h, 3, P, 22), { tone: "mid" }));
    out.push(L(k.knurl(crank[0], crank[1], 3.4, h, h + 3, 18, P), { tone: "lo" }));
    const slot = { x: W.TAPE.x - 2, y: B.y + B.d - 0.2, w: W.TAPE.w + 4, d: 2.2, r: 0.6 };
    out.push(S(k.slabOf(slot, 0, 3, P, 2, 0.2), { tone: "lo" }));
    out.push(D(k.corners(B, 3.4).map(([x, yy]) => at([x, yy, h])), { size: 0.45 }));
    return out.join("");
  }

  function tape() {
    const T = W.TAPE;
    const face = k.planOutline(T, 0.5, P, 2);
    const out = [S(k.slabOf(T, 0, 0.5, P, 2), { tone: "hi", crease: "none" })];
    const lines = [];
    for (let i = -1; i < 11; i++) {
      const ly = T.y + 2.6 + i * W.TAPE_PITCH;
      lines.push(L(k.lineOnTop([T.x + 2.4, ly], [T.x + 9, ly], 0.5, P), { tone: "lo", free: true }));
      lines.push(L(k.lineOnTop([T.x + 10.6, ly], [T.x + 15.6, ly], 0.5, P), { tone: "mid", free: true }));
    }
    out.push(`<clipPath id="tape-clip"><path data-hold d="${face}"/></clipPath>`);
    out.push(`<g clip-path="url(#tape-clip)"><g data-part="tape-lines">${lines.join("")}</g></g>`);
    return out.join("");
  }

  return { trays, lower, card, pin, upper, wheel, spokeAt, rocker, rockerPosts, printer, tape };
}
