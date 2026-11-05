// 🎬 아이오니아(벚꽃) 다리 장면(8445654607 · 16.22 · 홈페이지 오프닝 2026-11-05) · 사용: node tools/replay-cam-test.cjs 8445654607 754 764 <이름> <챔피언> "!tools/aram-open/ionia-shots.cjs" "" <폴더>
const A = 43.7 * Math.PI / 180, C = { x: 6534, z: 6335 }, G = -178, ease = k => k * k * (3 - 2 * k), L = (a, b, k) => a + (b - a) * k;
const lane = (s, p = 100) => ({ x: C.x + s * Math.cos(A) - p * Math.sin(A), z: C.z + s * Math.sin(A) + p * Math.cos(A) });
const clean = { cameraAttached: false, cameraMode: 'fps', fogOfWar: false, healthBarChampions: false, healthBarMinions: false, healthBarPets: false, healthBarStructures: false, healthBarWards: false, floatingText: false, outlineHover: false, outlineSelect: false };
function seqOf(t0, t1, cam) {
  const P = [], R = [], F = []; let yp = null;
  for (let t = t0; t <= t1 + 1e-6; t += 0.1) {
    const { pos, tgt, f } = cam((t - t0) / (t1 - t0)), dx = tgt.x - pos.x, dz = tgt.z - pos.z;
    let yaw = Math.atan2(dx, dz) * 180 / Math.PI; if (yp != null) { while (yaw - yp > 180) yaw -= 360; while (yaw - yp < -180) yaw += 360; } yp = yaw;
    const pitch = Math.atan2(pos.y - tgt.y, Math.hypot(dx, dz)) * 180 / Math.PI, time = +t.toFixed(2);
    P.push({ time, value: { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), z: +pos.z.toFixed(1) }, blend: 'linear' });
    R.push({ time, value: { x: +yaw.toFixed(2), y: +pitch.toFixed(2), z: 0 }, blend: 'linear' });
    F.push({ time, value: +f.toFixed(1), blend: 'linear' });
  }
  return { cameraPosition: P, cameraRotation: R, fieldOfView: F };
}
const F = { x: 6170, z: 5360 };
module.exports = [
  { from: 754, to: 764, cam: clean, seq: seqOf(754, 764, k => { const q = ease(k), s = L(-4600, -2300, q), p = lane(s, L(-420, 380, q)), t = lane(s + 1900, 100);
      return { pos: { x: p.x, y: G + L(420, 620, q), z: p.z }, tgt: { x: L(t.x, F.x, q), y: G + 80, z: L(t.z, F.z, q) }, f: 62 }; }) },
  { from: 755, to: 767, cam: clean, seq: seqOf(755, 767, k => { const q = ease(k), yaw = L(110, 40, q) * Math.PI / 180, dist = L(4200, 1700, q), h = L(4300, 1500, q);
      return { pos: { x: F.x - Math.sin(yaw) * dist, y: G + h, z: F.z - Math.cos(yaw) * dist }, tgt: { x: F.x, y: G, z: F.z }, f: 55 }; }) },
];
