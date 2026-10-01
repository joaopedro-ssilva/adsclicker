import { fit } from './_tune';
import type { Params } from './_tune';

const c = Number(process.argv[2] ?? 9);
const p = Number(process.argv[3] ?? 6.5);
const n = Number(process.argv[4] ?? 4);
const clickScale = Number(process.argv[5] ?? 1);
const wide = process.argv[6] === 'wide';
const hire = [1, 2, 3, 4, 5, 6, 7].map((j) => 15 * c ** (3 * j - 0.5));
const targets = [5, 18, 45, 75, 105, 135].slice(0, n).map((m) => m * 60);
const params: Params = { c, p, hire, clickScale };
const fitted = fit(params, targets, {}, true, wide);
console.log(JSON.stringify({ c, p, clickScale, hire: fitted.hire.map((h) => Number(h.toPrecision(3))) }));
