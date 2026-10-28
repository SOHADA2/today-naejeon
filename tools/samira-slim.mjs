// 사미라.glb → Taunt만 남겨 압축(assets/models/samira-taunt.glb) — v0.1.21
// 사용: 작업 폴더에 samira.glb를 두고 npm i @gltf-transform/core@4.1.1 @gltf-transform/functions@4.1.1 @gltf-transform/extensions@4.1.1 meshoptimizer@0.21.0 → node samira-slim.mjs
// ⚠️ 지울 동작의 샘플러·접근자까지 직접 dispose해야 함(anim.dispose()만 하면 키프레임 1만7천 개가 파일에 남아 9MB)
// ⚠️ ALL_EXTENSIONS 등록 필수(안 하면 KHR_materials_unlit이 빠져 재질이 바뀜)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('samira.glb');
const anims = doc.getRoot().listAnimations();
const ta = anims.find(a => a.getName() === 'Taunt');
const keys = ta.listSamplers().reduce((n, s) => n + s.getInput().getCount(), 0);
console.log('Taunt keyframes total', keys, 'channels', ta.listChannels().length);
for (const a of anims) if (a !== ta) { for (const c of a.listChannels()) c.dispose(); for (const sm of a.listSamplers()) { const i = sm.getInput(), o = sm.getOutput(); sm.dispose(); if (i && i.listParents().length <= 1) i.dispose(); if (o && o.listParents().length <= 1) o.dispose(); } a.dispose(); }
await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune());
await io.write('samira-taunt-raw.glb', doc);
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write('samira-taunt.glb', doc);
const mb = f => (fs.statSync(f).size / 1e6).toFixed(2) + 'MB';
console.log('원본', mb('samira.glb'), '→ Taunt만', mb('samira-taunt-raw.glb'), '→ 압축', mb('samira-taunt.glb'));
const b = fs.readFileSync('samira-taunt.glb'); const len = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + len).toString());
console.log('extensionsUsed', JSON.stringify(j.extensionsUsed), 'anims', j.animations.map(a => a.name));
