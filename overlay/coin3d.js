// ── 🪙 선픽 동전 던지기 3D — 동전만(v0.1.229) ─────────────────────────────────
// 사장님: 사미라 3D 모델이 별로 → 동전만 나와서 튕긴 다음 회전하다가 딱 멈춘 순간(어차피 동전으로 확인하는 것)
//   아래에 비스듬히 누워 있던 동전이 「틱!」 튕겨 올라 빙글빙글 돌며 화면 쪽으로 다가옴 → 꼭대기(화면 가운데)에서 결과 면(1팀 파랑/2팀 빨강)이 정면을 본 채 「착」 멈춤
//   → 멈춘 뒤엔 살짝 커졌다 가라앉고 팀 색 빛만 은은하게(흔들림·섬광·유리 금 없음 — v0.1.23~27의 화면에 꽂히는 연출은 뺌)
//   예전(v0.1.21~228) = 라이엇 사미라 모델(assets/models/samira-taunt.glb)의 Taunt 동작이 동전을 던짐 → 모델·GLTF 불러오기 전부 없앰(동전 그림 = 사장님이 만든 assets/coin-t1·t2.webp)
//   시각(초): FLICK 튕김 · STOP 멈춤 — 소리 파일(assets/sfx/coin-flip.ogg = tools/coin-flip-sfx.py)·2D 동전(overlay.js playCoin)과 같은 값 · 바꾸면 세 곳 같이
// ⚠️ 한 번만 재생 후 렌더러를 버림 — 투명 창에서 계속 그리면 CPU를 먹음(성능 규칙). 3D가 안 되면 overlay.js가 2D 동전으로.
import * as THREE from 'three';

const FLICK = 0.34;        // 튕기는 순간(초)
const STOP = 1.62;         // 결과 면에서 딱 멈추는 순간
const TURNS = 5.5;         // 튕김~멈춤 사이 최소 회전 수(실제 = 결과 면에 맞게 반 바퀴 안에서 더함)
const LIE = -1.12;         // 처음 누워 있는 각도(라디안 · 위에서 비스듬히 보이는 타원)

let _tex = null, _loading = null;
function load() {
  if (_tex) return Promise.resolve(_tex);
  if (_loading) return _loading;
  const tl = new THREE.TextureLoader();
  const tex = f => new Promise((ok, no) => tl.load(f, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, no));
  _loading = Promise.all([tex('../assets/coin-t1.webp'), tex('../assets/coin-t2.webp')]).then(([t1, t2]) => { _tex = { t1, t2 }; return _tex; });
  _loading.catch(() => { _loading = null; });
  return _loading;
}

// 금화: 두께 있는 원기둥 — 앞면(+Z)=1팀 동전 그림, 뒷면(-Z)=2팀, 옆=금색 테
function makeCoin(R) {
  const TH = R * 0.16;
  const geo = new THREE.CylinderGeometry(R, R, TH, 64, 1);
  geo.rotateX(Math.PI / 2);   // 윗면(+Y) → +Z(카메라 쪽)
  const rim = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.32, emissive: 0x3a2508 });
  const f1 = new THREE.MeshBasicMaterial({ map: _tex.t1 }), f2 = new THREE.MeshBasicMaterial({ map: _tex.t2 });
  const mesh = new THREE.Mesh(geo, [rim, f1, f2]);
  const spin = new THREE.Group(); spin.add(mesh);   // 뒤집기 회전(X축) + 날아가는 동안 축 흔들림(Z)
  const pos = new THREE.Group(); pos.add(spin);      // 위치·크기
  return { pos, spin, mesh };
}

const clamp01 = v => Math.max(0, Math.min(1, v));
const TAU = Math.PI * 2;

// stage = 캔버스를 넣을 상자 · A = 1팀 선픽 여부 · onStart = 시계가 도는 순간(소리 시작) · onShow({x,y,r}) = 결과 면이 멈춘 순간(무대 안 px) · dur = 전체 길이(ms)
async function play({ stage, A, onStart, onShow, dur }) {
  await load();
  const W = Math.max(200, stage.clientWidth), H = Math.max(240, stage.clientHeight);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'cn-3d';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x203040, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(1.5, 3, 4); scene.add(key);
  const glow = new THREE.PointLight(A ? 0x4aa8ff : 0xff5a6e, 0, 6); scene.add(glow);

  // 카메라는 고정(정면) · 보이는 크기에서 동전 크기·자리를 정함 → 창 폭(300~430)·높이가 달라도 같은 비율
  const FOV = 30, CZ = 6;
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 40);
  cam.position.set(0, 0, CZ); cam.lookAt(0, 0, 0);
  const visH = 2 * CZ * Math.tan(FOV * Math.PI / 360), visW = visH * W / H;
  const R = Math.min(visW * 0.27, visH * 0.2);                 // 멈췄을 때 지름 = 창 폭의 54%쯤(낮은 창이면 높이의 40%)
  const p0 = new THREE.Vector3(0, -visH * 0.36, -5.5);         // 처음: 아래쪽 · 멀리(작게)
  const p1 = new THREE.Vector3(0, visH * 0.07, 0);             // 멈출 자리: 가운데보다 살짝 위(아래에 결과 글자)
  const drift = (Math.random() < 0.5 ? -1 : 1) * visW * (0.05 + Math.random() * 0.04);   // 날아가는 동안 옆으로 살짝 휘었다 돌아옴(매번 조금씩 다르게)
  const coin = makeCoin(R); scene.add(coin.pos);
  const finalAng = A ? 0 : Math.PI;
  const ang0 = LIE + (Math.random() < 0.5 ? Math.PI : 0);      // 처음 보이는 면은 무작위(결과와 상관없음)
  const angEnd = finalAng + TAU * Math.ceil((ang0 + TAU * TURNS - finalAng) / TAU);   // 같은 빠르기로 돌다가 멈추는 순간 정확히 결과 면
  let shown = false, started = false;

  const t0 = performance.now();
  await new Promise(done => {
    renderer.setAnimationLoop(() => {
      // 🎥 녹화·캡처용: window.__coinClock()(초)가 있으면 그 시각으로 그림(프레임 단위로 정확히) — 평소엔 없음
      const now = window.__coinClock ? t0 + window.__coinClock() * 1000 : performance.now(), t = (now - t0) / 1000;
      if (!started) { started = true; try { onStart && onStart(); } catch (_) {} }
      if (t < FLICK) {   // 누워서 기다림 → 튕기기 직전 살짝 눌림
        const d = clamp01((t - (FLICK - 0.13)) / 0.13);
        coin.pos.position.copy(p0); coin.pos.position.y -= visH * 0.012 * d * d;
        coin.pos.scale.setScalar(1);
        coin.spin.rotation.set(ang0 + 0.06 * d, 0, 0);
      } else if (t < STOP) {   // 튕겨 올라 빙글 — 포물선 꼭대기(= 멈출 자리)까지 점점 느리게 올라옴 · 회전은 같은 빠르기
        const u = (t - FLICK) / (STOP - FLICK), k = 2 * u - u * u;
        coin.pos.position.lerpVectors(p0, p1, k); coin.pos.position.x += drift * Math.sin(Math.PI * u);
        coin.pos.scale.setScalar(1);
        coin.spin.rotation.set(ang0 + (angEnd - ang0) * u, 0, 0.2 * Math.sin(u * 10) * (1 - u));   // 축이 살짝 흔들리다 멈출 때 반듯해짐
      } else {   // 딱 멈춤 — 결과 면 정면 · 살짝 커졌다 가라앉음(흔들림 없음) · 팀 색 빛
        const k = t - STOP;
        coin.pos.position.copy(p1);
        coin.pos.scale.setScalar(1 + 0.085 * Math.exp(-k * 13));
        coin.spin.rotation.set(finalAng, 0, 0);
        glow.position.set(p1.x, p1.y + R * 0.4, 1.4);
        glow.intensity = 5 * Math.exp(-k * 2.2) + 1.2;
        if (!shown) { shown = true;
          const p = p1.clone().project(cam), e = p1.clone().add(new THREE.Vector3(R, 0, 0)).project(cam);
          try { onShow && onShow({ x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, r: Math.abs((e.x - p.x) / 2 * W) }); } catch (_) {} }
      }
      renderer.render(scene, cam);
      if (now - t0 >= dur) done();
    });
  });
  renderer.setAnimationLoop(null);
  coin.mesh.geometry.dispose(); [].concat(coin.mesh.material).forEach(m => m.dispose());
  renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
}

// 3D가 되는 PC인지(WebGL) — 안 되면 2D 동전
function canWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; } }

window.coin3d = {
  ok: canWebGL(),
  ready: () => !!_tex,
  preload: () => load().then(() => true, () => false),
  play,
  FLICK, STOP,
};
// 드래프트 시작 순간 바로 재생할 수 있게 동전 그림을 미리 받아둠(앱 켠 뒤 잠깐 쉬었다가 — 첫 화면 그리기 방해 안 하게)
if (window.coin3d.ok) setTimeout(() => window.coin3d.preload(), 2500);
