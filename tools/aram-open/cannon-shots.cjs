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
// ② 자야(레드 우물) — 사장님(2026-11-05): 대포는 멀리서 → 날아갈 때 클로즈업 → 도착하면 멀어지며 시점을 돌림
//   대기(멀리·높이: 우물 뒤에서 대포와 다리) → 발사 순간 0.4배로 카메라가 확 내려와 뒤에 붙음 → 1배 근접 추격(포탑을 옆으로 비켜 감)
//   → 착지하면 멀어지고 올라가며 착지 지점을 110° 돎
{ const tr = track('Xayah'), A = { x: 11449, z: 11189 }, B = { x: 7605, z: 7529 }, u = unit(A, B), n = { x: -u.z, z: u.x };
  const LA = 181.45, LB = 183.95;
  //   ⚠️ 우물 뒤(−u)는 벽 안이라 안 됨(실측) → 다리 위 옆쪽(n = 다리 옆 방향 · 포탑은 다리 가운데라 옆은 안 가림)
  const wide = t => { const k = ease(cl((t - 179.9) / 1.5, 0, 1));
    return { pos: { x: A.x + u.x * L(1350, 1150, k) + n.x * 950, y: G + L(1550, 1350, k), z: A.z + u.z * L(1350, 1150, k) + n.z * 950 }, tgt: { x: A.x + u.x * 250, y: G + 60, z: A.z + u.z * 250 }, f: 58 }; };
  const chase = c => ({ pos: { x: c.x + n.x * 560 - u.x * 230, y: c.y + 320, z: c.z + n.z * 560 - u.z * 230 }, tgt: { x: c.x + u.x * 260, y: c.y + 80, z: c.z + u.z * 260 }, f: 60 });
  const land = (c, t) => { const k = ease(cl((t - (LB - 0.15)) / 2.0, 0, 1)), ang = L(0, 100, k) * Math.PI / 180, d = L(600, 1500, k);
    const dir = { x: n.x * Math.cos(ang) + u.x * Math.sin(ang), z: n.z * Math.cos(ang) + u.z * Math.sin(ang) };   // 옆(n)에서 앞(u)으로 돌며 멀어짐
    return { pos: { x: c.x + dir.x * d, y: G + L(500, 1250, k), z: c.z + dir.z * d }, tgt: { x: c.x, y: G + 50, z: c.z }, f: L(60, 56, k) }; };
  const mix = (a, b, w) => ({ pos: { x: L(a.pos.x, b.pos.x, w), y: L(a.pos.y, b.pos.y, w), z: L(a.pos.z, b.pos.z, w) }, tgt: { x: L(a.tgt.x, b.tgt.x, w), y: L(a.tgt.y, b.tgt.y, w), z: L(a.tgt.z, b.tgt.z, w) }, f: L(a.f, b.f, w) });
  shots.push({ from: 179.9, to: 186.0, cam: clean, speed: [[181.3, 1], [181.38, 0.4], [182.0, 0.4], [182.2, 1]], seq: seqOf(179.9, 186.0, t => {
    const c = tr(t), w1 = ease(cl((t - (LA - 0.05)) / 0.55, 0, 1)), w2 = ease(cl((t - (LB - 0.35)) / 0.6, 0, 1));
    return mix(mix(wide(t), chase(c), w1), land(c, t), w2);
  }) }); }
module.exports = shots;
