// ── 🪙 선픽 동전 던지기 3D — 사미라 Taunt(v0.1.21) ─────────────────────────────────
// 사미라가 동전을 위로 튕겼다 받고(0.1~0.8초) → 2.93초에 화면(카메라) 쪽으로 튕겨 날림 → 동전이 카메라 앞에 멈춰
// 빙글 돌다 결과 면(1팀 파랑/2팀 빨강)을 보여줌. 동전 위치 = 모델의 「Coin」 뼈 그대로(Taunt에 동전 경로가 들어 있음).
// 모델 = assets/models/samira-taunt.glb(원본 12.7MB에서 Taunt만 남기고 meshopt 압축 1.1MB · 만드는 법 CLAUDE.md)
// ⚠️ 한 번만 재생(약 5.6초) 후 렌더러를 버림 — 투명 창에서 계속 그리면 CPU를 먹음(성능 규칙). 3D가 안 되면 overlay.js가 2D 동전으로.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const FLICK = 2.93;        // 정면으로 튕기는 순간(초) — Coin 뼈 속도로 잰 값
const CATCH_AT = 3.12;     // 날아오던 동전을 카메라 앞에서 받아 세우기 시작
const SHOW_AT = 3.62;      // 결과 면이 정면에 멈춤(= 결과 글자·쾅 소리)
const TOSS = [0.1, 0.8];   // 처음 위로 튕겼다 받는 구간(빙글빙글)

let _gltf = null, _loading = null, _tex = null;
function load() {
  if (_gltf) return Promise.resolve(_gltf);
  if (_loading) return _loading;
  const tl = new THREE.TextureLoader();
  const tex = f => new Promise((ok, no) => tl.load(f, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, no));
  _loading = Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('../assets/models/samira-taunt.glb'),
    tex('../assets/coin-t1.webp'), tex('../assets/coin-t2.webp'),
  ]).then(([g, t1, t2]) => { _gltf = g; _tex = { t1, t2 }; return g; });
  _loading.catch(() => { _loading = null; });
  return _loading;
}

// 금화: 두께 있는 원기둥 — 앞면(+Z)=1팀 동전 그림, 뒷면(-Z)=2팀, 옆=금색 테
function makeCoin() {
  const R = 0.075, TH = 0.012;
  const geo = new THREE.CylinderGeometry(R, R, TH, 56, 1);
  geo.rotateX(Math.PI / 2);   // 윗면(+Y) → +Z(카메라 쪽)
  const rim = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.32, emissive: 0x3a2508 });
  const f1 = new THREE.MeshBasicMaterial({ map: _tex.t1 }), f2 = new THREE.MeshBasicMaterial({ map: _tex.t2 });
  const mesh = new THREE.Mesh(geo, [rim, f1, f2]);
  const spin = new THREE.Group(); spin.add(mesh);   // 뒤집기 회전(X축)
  const pos = new THREE.Group(); pos.add(spin);      // 위치
  return { pos, spin, mesh };
}

const ease = { out3: u => 1 - Math.pow(1 - u, 3), outBack: u => { const c = 1.6; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); } };
const clamp01 = v => Math.max(0, Math.min(1, v));

// stage = 캔버스를 넣을 상자 · A = 1팀 선픽 여부 · onShow = 결과 면이 멈춘 순간(글자 띄우기) · dur = 전체 길이(ms)
async function play({ stage, A, onShow, dur }) {
  const g = await load();
  const W = Math.max(200, stage.clientWidth), H = Math.max(240, stage.clientHeight);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'cn-3d';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x203040, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(1.5, 3, 4); scene.add(key);
  const teamCol = A ? 0x4aa8ff : 0xff5a6e;
  const glow = new THREE.PointLight(teamCol, 0, 1.6); scene.add(glow);

  const root = g.scene; root.position.set(0, 0, 0); scene.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const act = mixer.clipAction(g.animations.find(a => a.name === 'Taunt') || g.animations[0]);
  act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.play();
  let bone = null; root.traverse(o => { if (o.name === 'Coin') bone = o; });

  // 카메라: 사미라 정면(동전이 날아오는 쪽)·살짝 위 — 위로 튕긴 동전(2.6m)까지 보이게
  const cam = new THREE.PerspectiveCamera(33, W / H, 0.05, 50);
  const look = new THREE.Vector3(0, 1.62, 0);
  const camFrom = new THREE.Vector3(0.12, 2.0, 4.35), camTo = new THREE.Vector3(0.1, 1.95, 3.85);   // 위로 튕긴 동전 꼭대기(2.62m)까지 보이게   // 정면 가까이(동전이 손에서 화면 가운데로 곧장) · 튕기기 전까지 살짝 밀고 들어감
  cam.position.copy(camFrom); cam.lookAt(look);
  const dir = look.clone().sub(cam.position).normalize();
  const holdAt = () => cam.position.clone().add(dir.clone().multiplyScalar(0.95)).add(new THREE.Vector3(0, 0.03, 0));   // 결과 면이 멈출 자리(카메라 바로 앞)
  let hold = holdAt();   // 결과 면이 멈출 자리(카메라 바로 앞)

  const coin = makeCoin(); scene.add(coin.pos);
  coin.pos.quaternion.copy(cam.quaternion);   // 면이 카메라를 보게(결과 면 = spin 각도로)
  const wp = new THREE.Vector3(), from = new THREE.Vector3();
  let ang = 0, last = 0, caught = false, shown = false, angFrom = 0, angTo = 0;
  const finalAng = A ? 0 : Math.PI;

  const t0 = performance.now();
  await new Promise(done => {
    renderer.setAnimationLoop(() => {
      // 🎥 녹화용: window.__coinClock()(초)가 있으면 그 시각으로 그림(프레임 단위로 정확히 캡처) — 평소엔 없음
      const now = window.__coinClock ?t0 + window.__coinClock() * 1000 : performance.now(), t = (now - t0) / 1000, dt = Math.min(0.05, t - last); last = t;
      mixer.setTime(Math.min(t, act.getClip().duration)); root.updateMatrixWorld(true);
      if (t <= CATCH_AT) { cam.position.lerpVectors(camFrom, camTo, ease.out3(clamp01(t / FLICK))); cam.lookAt(look); dir.copy(look).sub(cam.position).normalize(); coin.pos.quaternion.copy(cam.quaternion); hold = holdAt(); }
      if (t < CATCH_AT) {
        if (bone) bone.getWorldPosition(wp); coin.pos.position.copy(wp);
        const w = (t > TOSS[0] && t < TOSS[1]) ? 26 : t >= FLICK ? 34 : 0;   // 튕긴 동안만 빙글
        ang += w * dt;
        if (t >= TOSS[1] && t < FLICK) ang += (Math.round(ang / Math.PI) * Math.PI - ang) * 0.2;   // 손에 쥐면 면이 보이게 정리
      } else {
        if (!caught) { caught = true; from.copy(coin.pos.position); angFrom = ang; angTo = ang + Math.PI * 4 + ((finalAng - ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); }
        const u = clamp01((t - CATCH_AT) / (SHOW_AT - CATCH_AT));
        coin.pos.position.lerpVectors(from, hold, ease.outBack(u));
        ang = angFrom + (angTo - angFrom) * ease.out3(u);
        if (u >= 1) {
          const k = t - SHOW_AT;
          coin.pos.position.y = hold.y + Math.sin(k * 3.2) * 0.006;           // 살짝 떠 있음
          coin.spin.rotation.y = Math.sin(k * 2.1) * 0.12;                     // 살짝 흔들림
          glow.intensity = 1.6 * Math.exp(-k * 1.6) + 0.35;                    // 「쾅」 빛 → 은은하게
          if (!shown) { shown = true; try { onShow && onShow(); } catch (_) {} }
        }
        glow.position.copy(coin.pos.position).add(dir.clone().multiplyScalar(-0.25));
      }
      coin.spin.rotation.x = ang;
      renderer.render(scene, cam);
      if (now - t0 >= dur) done();
    });
  });
  renderer.setAnimationLoop(null);
  scene.remove(root); mixer.stopAllAction(); mixer.uncacheRoot(root);
  coin.mesh.geometry.dispose(); [].concat(coin.mesh.material).forEach(m => m.dispose());
  renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
}

// 3D가 되는 PC인지(WebGL) — 안 되면 2D 동전
function canWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; } }

window.coin3d = {
  ok: canWebGL(),
  ready: () => !!_gltf,
  preload: () => load().then(() => true, () => false),
  play,
  FLICK, CATCH_AT, SHOW_AT,
};
// 드래프트 시작 순간 바로 재생할 수 있게 미리 받아둠(앱 켠 뒤 잠깐 쉬었다가 — 첫 화면 그리기 방해 안 하게)
if (window.coin3d.ok) setTimeout(() => window.coin3d.preload(), 2500);
