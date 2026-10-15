// World plan for the cash cistern. Units are about 1 px; x along the bench, y toward the viewer, z up.

export const BASE = { x: -150, y: -58, w: 300, d: 116, r: 8 };
export const BASE_H = 12;
export const FOOT_H = 5;

export const TANK = { x: -112, y: -48, w: 104, d: 54, r: 3 };
export const SEAT_H = 6;
export const GLASS_H = 100;
export const TANK_TOP = SEAT_H + GLASS_H;
export const POST_W = 4;
export const FRONT_Y = TANK.y + TANK.d;

export const K = 1.6 / 1000; // world units per pound of water
export const zOf = (pounds) => SEAT_H + pounds * K;

export const ROD = [-86, -21];
export const FLOAT_R = 9;
export const PUSH = [-86, FRONT_Y + 8.5];

export const MANIFOLD = { x: -136, y: FRONT_Y + 7, w: 168, d: 10, r: 2 };
export const MANIFOLD_Z0 = 8;
export const MANIFOLD_H = 9;
export const MANIFOLD_TOP = MANIFOLD_Z0 + MANIFOLD_H;
export const VALVE_X = [-118, -82, -46, -10];
export const VALVE_Y = MANIFOLD.y + 5;
export const BODY_TOP = MANIFOLD_TOP + 9;
export const CARD_Z = BODY_TOP + 6;
export const ROCKER_Z = CARD_Z + 5;
export const WHEEL_Z = ROCKER_Z + 9;
export const NOZZLE_Y = VALVE_Y + 15;
export const TRAY_Y = NOZZLE_Y - 6;

export const FUNNEL = [-40, -22.5];
export const PRINTER = { x: 26, y: -40, w: 58, d: 44, r: 3 };
export const PRINTER_H = 24;
export const TAPE = { x: 46, y: PRINTER.y + PRINTER.d, w: 18, d: 44, r: 0.6 };
export const TAPE_PITCH = 4.4;
export const DIAL = [116, 22];
export const DIAL_R = 15;
export const DIAL_Z = 10;
export const DIAL_TOP = DIAL_Z + 7;
