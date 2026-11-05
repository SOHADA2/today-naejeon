// 🎬 포탄 장면 동선(얼음 칼바람 8445370954 · 홈페이지 오프닝 2026-11-05) — 실제 궤적(cannon-path.json = cannon-probe.cjs로 잰 것 · 이름 = 영문 챔피언)에 카메라를 붙임
//   사용: node tools/replay-cam-test.cjs 8445370954 81 85 <아무 이름> <아무 챔피언> "!tools/aram-open/cannon-shots.cjs" "" <출력폴더>
const fs = require('fs'), path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'cannon-path.json'), 'utf8'));
const G = -178, ease = k => k * k * (3 - 2 * k), L = (a, b, k) => a + (b - a) * k, cl = (x, a, b) => Math.max(a, Math.min(b, x));
const clean = { cameraAttached: false, cameraMode: 'fps', fogOfWar: false, healthBarChampions: false, healthBarMinions: false, healthBarPets: false, healthBarStructures: false, healthBarWards: false, floatingText: false, outlineHover: false, outlineSelect: false };
function track(name) {   // 시각 → 위치(점 사이 직선 · 앞뒤 0.15초 평균으로 매끈하게)
  const pts = D.find(x => x.name === name).pts;
  const at = t => { if (t <= pts[0].t) return pts[0]; for (let i = 1; i < pts.length; i++) if (pts[i].t >= t) { const a = pts[i - 1], b = pts[i], k = (t - a.t) / ((b.t - a.t) || 1); return { x: L(a.x, b.x, k), y: L(a.y, b.y, k), z: L(a.z, b.z, k) }; } return pts[pts.length - 1]; };
  return t => { const s = [-0.15, -0.075, 0, 0.075, 0.15].map(d => at(t + d)); return { x: s.reduce((a, p) => a + p.x, 0) / 5, y: s.reduce((a, p) => a + p.y, 0) / 5, z: s.reduce((a, p) => a + p.z, 0) / 5 }; };
}
function seqOf(t0, t1, cam) {
  const P = [], R = [], F = []; let yp = null;
  for (let t = t0; t <= t1 + 1e-6; t += 0.05) {
    const { pos, tgt, f } = cam(t), dx = tgt.x - pos.x, dz = tgt.z - pos.z;
    let yaw = Math.atan2(dx, dz) * 180 / Math.PI; if (yp != null) { while (yaw - yp > 180) yaw -= 360; while (yaw - yp < -180) yaw += 360; } yp = yaw;
    const pitch = Math.atan2(pos.y - tgt.y, Math.hypot(dx, dz)) * 180 / Math.PI, time = +t.toFixed(2);
    P.push({ time, value: { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), z: +pos.z.toFixed(1) }, blend: 'linear' });
    R.push({ time, value: { x: +yaw.toFixed(2), y: +pitch.toFixed(2), z: 0 }, blend: 'linear' });
    F.push({ time, value: +f.toFixed(1), blend: 'linear' });
  }
  return { cameraPosition: P, cameraRotation: R, fieldOfView: F };
}
const unit = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l }; };
const shots = [];
// ① 르블랑(블루 우물) — 착지 쪽에서 우물을 바라봄 · 날아와 카메라 옆을 스쳐 지나감
{ const tr = track('Leblanc'), A = { x: 1341, z: 1325 }, B = { x: 5237, z: 5134 }, u = unit(A, B), n = { x: -u.z, z: u.x };
  const cam0 = { x: B.x + u.x * 700 + n.x * 380, y: G + 330, z: B.z + u.z * 700 + n.z * 380 };
  shots.push({ from: 81.4, to: 85.4, cam: clean, speed: [[83.3, 1], [83.4, 0.5], [84.3, 0.5], [84.45, 1]], seq: seqOf(81.4, 85.4, t => {
    const c = tr(t), k = ease(cl((t - 84.2) / 1.2, 0, 1));
    const pos = { x: cam0.x + u.x * 250 * k, y: cam0.y + 120 * k, z: cam0.z + u.z * 250 * k };
    return { pos, tgt: { x: c.x, y: c.y + 90, z: c.z }, f: L(46, 58, ease(cl((t - 83.0) / 1.4, 0, 1))) };
  }) }); }
// ② 자야(레드 우물) — 대포 안: 앞쪽 비스듬히 얼굴 → 날아오르면 위로 올라가며 뒤에서 포탑 위로 쫓음
{ const tr = track('Xayah'), A = { x: 11449, z: 11189 }, B = { x: 7605, z: 7529 }, u = unit(A, B), n = { x: -u.z, z: u.x };
  const LA = 181.45, LB = 183.95;
  shots.push({ from: 180.2, to: 185.2, cam: clean, speed: [[181.3, 1], [181.4, 0.45], [182.25, 0.45], [182.55, 1]], seq: seqOf(180.2, 185.2, t => {
    const c = tr(t);
    const front = { pos: { x: A.x + u.x * 560 + n.x * 420, y: G + 260, z: A.z + u.z * 560 + n.z * 420 }, tgt: { x: c.x, y: c.y + 120, z: c.z }, f: 50 };
    const chase = { pos: { x: c.x - u.x * 820 + n.x * 140, y: c.y + 980, z: c.z - u.z * 820 + n.z * 140 }, tgt: { x: c.x + u.x * 650, y: c.y + 60, z: c.z + u.z * 650 }, f: 60 };
    const w = ease(cl((t - (LA + 0.1)) / 0.75, 0, 1)), e = ease(cl((t - LB) / 1.2, 0, 1));
    const M = (a, b) => ({ x: L(a.x, b.x, w), y: L(a.y, b.y, w), z: L(a.z, b.z, w) });
    const pos = M(front.pos, chase.pos), tgt = M(front.tgt, chase.tgt);
    return { pos: { x: pos.x - u.x * 300 * e, y: pos.y + 300 * e, z: pos.z - u.z * 300 * e }, tgt: { x: tgt.x + u.x * 600 * e, y: tgt.y, z: tgt.z + u.z * 600 * e }, f: L(front.f, chase.f, w) };
  }) }); }
module.exports = shots;
