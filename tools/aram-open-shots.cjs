// 🎬 홈페이지 오프닝 칼바람 나락 촬영 동선(2026-11-05 · docs/img/aram-open.mp4) — 롤 리플레이 카메라 키프레임 3장면을 replay-cam-test 연출 파일로 출력
//   사용(롤 있는 PC · 설치된 앱은 끄고): node tools/aram-open-shots.cjs 498 > shots.txt && node tools/replay-cam-test.cjs 8445370954 498 510 울퉁쓰 말파이트 @shots.txt "" <출력폴더>
//   판마다 맵 모습이 다름(얼음 칼바람·필트오버 다리·아이오니아 벚꽃) — 8445370954(16.22) = 얼음 · FIGHT = 그 판 한타 자리(전적 타임라인 킬 위치) · 같은 패치에서만 리플레이가 열림
//   편집 = ②(하늘) 0~2.35초 + ①(질주) 5.6~10.4초 1.45배 · 0.25초 겹침 · 색 보정 → 1600폭 crf 27(명령은 CLAUDE.md 홈페이지 줄)
const A = 43.7 * Math.PI / 180, C = { x: 6534, z: 6335 }, G = -170;   // G = 땅 높이(추정 · 첫 촬영으로 확인)
const lane = (s, p = 100) => ({ x: C.x + s * Math.cos(A) - p * Math.sin(A), z: C.z + s * Math.sin(A) + p * Math.cos(A) });
const ease = k => k * k * (3 - 2 * k);
const L = (a, b, k) => a + (b - a) * k;
// 시점 묶음: 카메라 위치·바라볼 곳을 시간 함수로 → 0.1초마다 키프레임
function seqOf(t0, t1, cam, fov) {
  const P = [], R = [], F = []; let yp = null;
  for (let t = t0; t <= t1 + 1e-6; t += 0.1) {
    const { pos, tgt, f } = cam((t - t0) / (t1 - t0));
    const dx = tgt.x - pos.x, dz = tgt.z - pos.z;
    let yaw = Math.atan2(dx, dz) * 180 / Math.PI; if (yp != null) { while (yaw - yp > 180) yaw -= 360; while (yaw - yp < -180) yaw += 360; } yp = yaw;
    const pitch = Math.atan2(pos.y - tgt.y, Math.hypot(dx, dz)) * 180 / Math.PI;
    const time = +t.toFixed(2);
    P.push({ time, value: { x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), z: +pos.z.toFixed(1) }, blend: 'linear' });
    R.push({ time, value: { x: +yaw.toFixed(2), y: +pitch.toFixed(2), z: 0 }, blend: 'linear' });
    F.push({ time, value: +(f || fov).toFixed(1), blend: 'linear' });
  }
  return { cameraPosition: P, cameraRotation: R, fieldOfView: F };
}
const clean = { cameraAttached: false, cameraMode: 'fps', fogOfWar: false, healthBarChampions: false, healthBarMinions: false, healthBarPets: false, healthBarStructures: false, healthBarWards: false, floatingText: false, outlineHover: false, outlineSelect: false };
const FIGHT = { x: 7300, z: 6950 }, T0 = Number(process.argv[2] || 1092) - 1092;   // 한타 자리 · T0 = 시각 옮김(1092 기준)
const shots = [];
// ① 다리 질주: 블루 쪽 낮게 → 다리 따라 빠르게 → 한타 위로 솟아 내려다봄 (1092~1104)
shots.push({ from: 1092 + T0, to: 1104 + T0, cam: clean, seq: seqOf(1092 + T0, 1104 + T0, k => {
  if (k < 0.55) { const q = ease(k / 0.55), s = L(-5200, -1500, q);   // 낮게 다리 따라
    const p = lane(s, 430), t = lane(s + 1800, 200);   // 포탑(다리 가운데)을 옆으로 비켜 감
    return { pos: { x: p.x, y: G + L(380, 700, q), z: p.z }, tgt: { x: t.x, y: G + 60, z: t.z }, f: L(62, 58, q) }; }
  const q = ease((k - 0.55) / 0.45), s = L(-1500, -900, q), p = lane(s, L(430, 100, q));   // 솟아오르며 한타 내려다봄
  const tgtA = lane(300), tgt = { x: L(tgtA.x, FIGHT.x, q), y: G + 60, z: L(tgtA.z, FIGHT.z, q) };
  const back = { x: FIGHT.x - Math.cos(A) * 1300, z: FIGHT.z - Math.sin(A) * 1300 };
  return { pos: { x: L(p.x, back.x, q), y: G + L(700, 2000, q), z: L(p.z, back.z, q) }, tgt, f: L(58, 50, q) };
}, 60) });
// ② 하늘에서 다리 전체 → 돌며 한타로 내려앉음 (1094~1106)
shots.push({ from: 1094 + T0, to: 1106 + T0, cam: clean, seq: seqOf(1094 + T0, 1106 + T0, k => {
  const q = ease(k), yaw = L(-70, 20, q) * Math.PI / 180, dist = L(5200, 1500, q), h = L(5600, 1500, q);
  return { pos: { x: FIGHT.x - Math.sin(yaw) * dist, y: G + h, z: FIGHT.z - Math.cos(yaw) * dist }, tgt: { x: FIGHT.x, y: G, z: FIGHT.z }, f: L(55, 50, q) };
}, 55) });
// ③ 레드 우물 쪽에서 블루를 바라보며 낮게 미끄러짐 (반대 방향 · 1090~1100)
shots.push({ from: 1090 + T0, to: 1100 + T0, cam: clean, seq: seqOf(1090 + T0, 1100 + T0, k => {
  const q = ease(k), s = L(5200, 2200, q), p = lane(s, L(-300, 300, q)), t = lane(s - 2200);
  return { pos: { x: p.x, y: G + L(380, 700, q), z: p.z }, tgt: { x: t.x, y: G + 120, z: t.z }, f: 65 };
}, 65) });
process.stdout.write(shots.map(s => JSON.stringify(Object.assign({ fov: 60 }, s))).join(';'));
