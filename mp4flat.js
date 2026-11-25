// 🎞️ v0.1.249 조각난 mp4(fragmented · 크롬 MediaRecorder가 만드는 moof/mdat 반복) → 일반 mp4(목차 moov를 맨 앞 · faststart)
//   사장님: 저장한 팟지 영상이 안 됨 · 웬만한 곳에서 문제없이 나오게 — 실측(2026-11-25 저장본): 윈도우 탐색기가 길이·크기·프레임 속도를 하나도 못 읽음
//   원인 = 목차의 표(stts·stsz·stco)가 비어 있고 샘플 정보는 조각(moof)마다 흩어짐 + tkhd 「트랙 켜짐」 표시가 0 → 윈도우 기본 재생기·카톡·아이폰·SNS 업로드에서 길이 0·안 열림
//   여기서 = 다시 인코딩 없이 샘플만 옮겨 담음(화질·소리 그대로) · 영상 트랙 먼저 · 트랙 켜짐 · mvhd/tkhd/mdhd 버전 0(오래된 재생기용) · 모르는 모양이면 그대로 돌려줌(throw)
'use strict';

const u32 = (b, o) => b.readUInt32BE(o);
const u64 = (b, o) => Number(b.readBigUInt64BE(o));
function boxes(buf, start, end) {   // [{type, start, size, hdr}]
  const out = []; let i = start;
  while (i + 8 <= end) {
    let size = u32(buf, i), hdr = 8; const type = buf.toString('latin1', i + 4, i + 8);
    if (size === 1) { size = u64(buf, i + 8); hdr = 16; } else if (size === 0) size = end - i;
    if (size < hdr || i + size > end) throw new Error('mp4 상자 크기 이상 ' + type);
    out.push({ type, start: i, size, hdr, body: i + hdr, end: i + size });
    i += size;
  }
  return out;
}
const child = (buf, box, type) => boxes(buf, box.body, box.end).find(b => b.type === type);
const children = (buf, box, type) => boxes(buf, box.body, box.end).filter(b => b.type === type);
function mk(type, ...parts) {   // 상자 만들기
  const body = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));
  const h = Buffer.alloc(8); h.writeUInt32BE(8 + body.length, 0); h.write(type, 4, 'latin1');
  return Buffer.concat([h, body]);
}
const full = (type, ver, flags, ...parts) => { const h = Buffer.alloc(4); h.writeUInt32BE(((ver & 255) << 24) | (flags & 0xffffff), 0); return mk(type, h, ...parts); };
const be32 = v => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0, 0); return b; };
const raw = (buf, box) => buf.subarray(box.start, box.end);

// v1(64비트 시각) → v0로 줄이기 · 값이 32비트를 넘으면 v1 그대로
function headerV0(buf, box, kind, duration) {
  const b = buf.subarray(box.body, box.end), v = b[0], flags = b.readUIntBE(1, 3);
  let p = 4, ct, mt, a, c, rest;
  if (v === 1) { ct = Number(b.readBigUInt64BE(p)); mt = Number(b.readBigUInt64BE(p + 8)); p += 16; }
  else { ct = b.readUInt32BE(p); mt = b.readUInt32BE(p + 4); p += 8; }
  a = b.readUInt32BE(p); p += 4;                         // mvhd·mdhd = timescale · tkhd = track_ID
  if (kind === 'tkhd') { c = b.readUInt32BE(p); p += 4; }   // tkhd = reserved
  p += v === 1 ? 8 : 4;                                  // 옛 duration 건너뜀
  rest = b.subarray(p);
  const fits = ct < 2 ** 32 && mt < 2 ** 32 && duration < 2 ** 32;
  const fl = kind === 'tkhd' ? (flags | 3) : flags;     // tkhd = 트랙 켜짐 + 영상에 들어감
  if (fits) return full(kind, 0, fl, be32(ct), be32(mt), be32(a), ...(kind === 'tkhd' ? [be32(c)] : []), be32(duration), rest);
  const t = Buffer.alloc(8), m = Buffer.alloc(8), d = Buffer.alloc(8); t.writeBigUInt64BE(BigInt(ct)); m.writeBigUInt64BE(BigInt(mt)); d.writeBigUInt64BE(BigInt(duration));
  return full(kind, 1, fl, t, m, be32(a), ...(kind === 'tkhd' ? [be32(c)] : []), d, rest);
}
// dref = 「데이터가 이 파일 안에 있음」(url 상자 flags 1) — 크롬 녹화본은 flags 0(= 다른 파일)이라 윈도우 기본 재생기가 못 엶(2026-11-25 실측)
const drefSelf = () => full('dref', 0, 0, be32(1), full('url ', 0, 1));
// esds(소리 설정) = 표준 모양으로 다시: ES 설명(ES_ID 1) › 디코더 설정(AAC 0x40 · 소리 0x15) › 디코더 정보(그대로) + SLConfig(02) — 크롬 녹화본은 SLConfig가 없음
function readDesc(b, p) { const tag = b[p++]; let len = 0, k = 0; do { len = (len << 7) | (b[p] & 0x7f); } while ((b[p++] & 0x80) && ++k < 4); return { tag, len, body: p }; }
function esdsFix(buf, box) {
  const b = buf.subarray(box.body + 4, box.end);   // 버전·flags 다음
  const es = readDesc(b, 0); if (es.tag !== 3) throw new Error('esds 모양');
  let p = es.body; const fl = b[p + 2]; p += 3; if (fl & 0x80) p += 2; if (fl & 0x40) p += 1 + b[p]; if (fl & 0x20) p += 2;
  const dc = readDesc(b, p); if (dc.tag !== 4) throw new Error('esds 디코더 설정');
  const dcHead = b.subarray(dc.body, dc.body + 13);   // 종류·스트림·버퍼·최대/평균 비트레이트
  const ds = readDesc(b, dc.body + 13); const asc = ds.tag === 5 ? b.subarray(ds.body, ds.body + ds.len) : null;
  if (!asc || !asc.length) throw new Error('esds 디코더 정보 없음');
  const desc = (tag, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([Buffer.from([tag, 0x80, 0x80, 0x80, body.length & 0x7f]), body]); };
  const head = Buffer.from(dcHead); head[0] = head[0] || 0x40; head[1] = head[1] || 0x15;
  const esd = desc(3, Buffer.from([0, 1, 0]), desc(4, head, desc(5, asc)), desc(6, Buffer.from([2])));
  return full('esds', 0, 0, esd);
}
function stsdFix(buf, stsd) {   // 샘플 설명 안의 mp4a = esds 고치고 맨 앞으로(btrt 등은 뒤로)
  const b = buf.subarray(stsd.body, stsd.end), n = b.readUInt32BE(4); const ents = []; let p = stsd.body + 8;
  for (let i = 0; i < n; i++) {
    const size = u32(buf, p), type = buf.toString('latin1', p + 4, p + 8), e = { start: p, end: p + size, body: p + 8 };
    if (type === 'mp4a') {
      const fixed = 28, kidsAt = e.body + fixed;   // 소리 샘플 항목 고정 칸 28바이트(버전 0)
      const kids = boxes(buf, kidsAt, e.end), es = kids.find(k => k.type === 'esds');
      if (es) { ents.push(mk('mp4a', buf.subarray(e.body, kidsAt), esdsFix(buf, es), ...kids.filter(k => k.type !== 'esds').map(k => raw(buf, k)))); p += size; continue; }
    }
    ents.push(buf.subarray(e.start, e.end)); p += size;
  }
  return full('stsd', 0, 0, be32(n), ...ents);
}
const timescaleOf =(buf, mdhd) => { const b = buf.subarray(mdhd.body); return b[0] === 1 ? b.readUInt32BE(20) : b.readUInt32BE(12); };
const mvhdScale = (buf, mvhd) => { const b = buf.subarray(mvhd.body); return b[0] === 1 ? b.readUInt32BE(20) : b.readUInt32BE(12); };

function flatten(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  const top = boxes(buf, 0, buf.length);
  const moov = top.find(b => b.type === 'moov');
  if (!moov || !top.some(b => b.type === 'moof')) return { buf, changed: false, why: '조각난 mp4 아님' };
  const mvhd = child(buf, moov, 'mvhd');
  const trex = {}; const mvex = child(buf, moov, 'mvex');
  if (mvex) for (const t of children(buf, mvex, 'trex')) { const b = buf.subarray(t.body); trex[b.readUInt32BE(4)] = { sdi: b.readUInt32BE(8), dur: b.readUInt32BE(12), size: b.readUInt32BE(16), flags: b.readUInt32BE(20) }; }
  // 트랙
  const tracks = {};
  for (const trak of children(buf, moov, 'trak')) {
    const tkhd = child(buf, trak, 'tkhd'), mdia = child(buf, trak, 'mdia'), mdhd = child(buf, mdia, 'mdhd'), hdlr = child(buf, mdia, 'hdlr');
    const minf = child(buf, mdia, 'minf'), stbl = child(buf, minf, 'stbl'), stsd = child(buf, stbl, 'stsd');
    const tb = buf.subarray(tkhd.body), id = tb[0] === 1 ? tb.readUInt32BE(20) : tb.readUInt32BE(12);
    tracks[id] = { id, trak, tkhd, mdia, mdhd, hdlr, minf, stbl, stsd, scale: timescaleOf(buf, mdhd), handler: buf.toString('latin1', hdlr.body + 8, hdlr.body + 12),
      chunks: [], samples: [], start: null };
  }
  // 조각 읽기
  let order = 0;
  for (const moof of top.filter(b => b.type === 'moof')) {
    for (const traf of children(buf, moof, 'traf')) {
      const tfhd = child(buf, traf, 'tfhd'), hb = buf.subarray(tfhd.body), hf = hb.readUIntBE(1, 3), id = hb.readUInt32BE(4);
      const T = tracks[id], X = trex[id] || {}; if (!T) throw new Error('모르는 트랙 ' + id);
      let p = 8, base = moof.start;
      if (hf & 0x1) { base = u64(hb, p); p += 8; }
      if (hf & 0x2) p += 4;
      const dDur = hf & 0x8 ? (p += 4, hb.readUInt32BE(p - 4)) : X.dur || 0;
      const dSize = hf & 0x10 ? (p += 4, hb.readUInt32BE(p - 4)) : X.size || 0;
      const dFlags = hf & 0x20 ? (p += 4, hb.readUInt32BE(p - 4)) : X.flags || 0;
      if (!(hf & 0x1) && !(hf & 0x20000)) base = moof.start;   // 기본 = moof 시작(크롬은 default-base-is-moof)
      const tfdt = child(buf, traf, 'tfdt');
      let dts = tfdt ? (buf[tfdt.body] === 1 ? u64(buf, tfdt.body + 4) : u32(buf, tfdt.body + 4)) : (T.next || 0);
      let dataPos = null;
      for (const trun of children(buf, traf, 'trun')) {
        const rb = buf.subarray(trun.body), ver = rb[0], rf = rb.readUIntBE(1, 3), n = rb.readUInt32BE(4);
        let q = 8; let off = dataPos;
        if (rf & 0x1) { off = base + rb.readInt32BE(q); q += 4; }
        if (off == null) off = base;
        let first = null; if (rf & 0x4) { first = rb.readUInt32BE(q); q += 4; }
        const chunk = { off, size: 0, n: 0, order: order++ };
        for (let k = 0; k < n; k++) {
          const dur = rf & 0x100 ? (q += 4, rb.readUInt32BE(q - 4)) : dDur;
          const size = rf & 0x200 ? (q += 4, rb.readUInt32BE(q - 4)) : dSize;
          let fl = rf & 0x400 ? (q += 4, rb.readUInt32BE(q - 4)) : dFlags; if (k === 0 && first != null) fl = first;
          const cto = rf & 0x800 ? (q += 4, ver === 1 ? rb.readInt32BE(q - 4) : rb.readUInt32BE(q - 4)) : 0;
          if (T.start == null) T.start = dts;
          T.samples.push({ dur, size, cto, sync: !(fl & 0x10000), chunk: T.chunks.length });
          chunk.size += size; chunk.n++; dts += dur;
        }
        if (chunk.off + chunk.size > buf.length) throw new Error('샘플이 파일 밖');
        T.chunks.push(chunk); dataPos = chunk.off + chunk.size;
      }
      T.next = dts;
    }
  }
  const list = Object.values(tracks).filter(t => t.samples.length).sort((a, b) => (a.handler === 'vide' ? 0 : 1) - (b.handler === 'vide' ? 0 : 1) || a.id - b.id);   // 영상 먼저
  if (!list.length) throw new Error('샘플 없음');
  for (const T of list) {   // 길이 0인 샘플(크롬 첫 소리 조각에 가끔) = 1로 · 마지막 샘플 길이 0이면 앞 샘플과 같게
    for (let i = 0; i < T.samples.length; i++) if (!T.samples[i].dur) T.samples[i].dur = i === T.samples.length - 1 && i ? T.samples[i - 1].dur : 1;
    T.mediaDur = T.samples.reduce((s, x) => s + x.dur, 0);
  }
  const movieScale = mvhdScale(buf, mvhd);
  const movDur = T => Math.round((T.start || 0) / T.scale * movieScale) + Math.round(T.mediaDur / T.scale * movieScale);
  const movieDur = Math.max(...list.map(movDur));
  // 새 mdat 안 순서 = 원래 조각 순서(소리·영상이 1~2초씩 섞여 있음 = 재생할 때 멀리 안 뜀)
  const allChunks = []; for (const T of list) T.chunks.forEach((c, i) => allChunks.push({ T, i, c }));
  allChunks.sort((a, b) => a.c.order - b.c.order);
  const build = (coBig, mdatStart) => {   // mdatStart = 새 mdat 데이터 시작 위치
    let pos = mdatStart; for (const x of allChunks) { x.c.newOff = pos; pos += x.c.size; }
    const traks = list.map(T => {
      const S = T.samples;
      const stts = []; for (const s of S) { const l = stts[stts.length - 1]; if (l && l[1] === s.dur) l[0]++; else stts.push([1, s.dur]); }
      const anyCto = S.some(s => s.cto), negCto = S.some(s => s.cto < 0);
      const ctts = []; if (anyCto) for (const s of S) { const l = ctts[ctts.length - 1]; if (l && l[1] === s.cto) l[0]++; else ctts.push([1, s.cto]); }
      const stsc = []; T.chunks.forEach((c, i) => { const l = stsc[stsc.length - 1]; if (!l || l[1] !== c.n) stsc.push([i + 1, c.n, 1]); });
      const sync = S.every(s => s.sync) ? null : S.map((s, i) => s.sync ? i + 1 : 0).filter(Boolean);
      const tbl = [
        stsdFix(buf, T.stsd),
        full('stts', 0, 0, be32(stts.length), ...stts.flatMap(([n, d]) => [be32(n), be32(d)])),
        ...(anyCto ? [full('ctts', negCto ? 1 : 0, 0, be32(ctts.length), ...ctts.flatMap(([n, o]) => { const b = Buffer.alloc(4); negCto ? b.writeInt32BE(o) : b.writeUInt32BE(o); return [be32(n), b]; }))] : []),
        ...(sync ? [full('stss', 0, 0, be32(sync.length), ...sync.map(be32))] : []),
        full('stsc', 0, 0, be32(stsc.length), ...stsc.flatMap(r => r.map(be32))),
        full('stsz', 0, 0, be32(0), be32(S.length), ...S.map(s => be32(s.size))),
        coBig ? full('co64', 0, 0, be32(T.chunks.length), ...T.chunks.map(c => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(c.newOff)); return b; }))
          : full('stco', 0, 0, be32(T.chunks.length), ...T.chunks.map(c => be32(c.newOff))),
      ];
      const stbl = mk('stbl', ...tbl);
      const minfKids = boxes(buf, T.minf.body, T.minf.end).filter(b => b.type !== 'stbl').map(b => b.type === 'dinf' ? mk('dinf', drefSelf()) : raw(buf, b));
      const minf = mk('minf', ...minfKids, stbl);
      const mdiaKids = boxes(buf, T.mdia.body, T.mdia.end).map(b => b.type === 'mdhd' ? headerV0(buf, b, 'mdhd', T.mediaDur) : b.type === 'minf' ? minf : raw(buf, b));
      const lead = Math.round((T.start || 0) / T.scale * movieScale);   // 첫 샘플이 0이 아닌 시각에 시작 = 빈 편집으로 그만큼 띄움
      const edts = lead > 0 ? mk('edts', full('elst', 0, 0, be32(2), be32(lead), be32(0xffffffff), be32(0x00010000), be32(movDur(T) - lead), be32(0), be32(0x00010000))) : null;
      const trakKids = boxes(buf, T.trak.body, T.trak.end).filter(b => b.type !== 'edts').map(b => b.type === 'tkhd' ? headerV0(buf, b, 'tkhd', movDur(T)) : b.type === 'mdia' ? mk('mdia', ...mdiaKids) : raw(buf, b));
      if (edts) trakKids.splice(1, 0, edts);
      return mk('trak', ...trakKids);
    });
    const moovKids = boxes(buf, moov.body, moov.end).filter(b => b.type !== 'mvex' && b.type !== 'trak').map(b => b.type === 'mvhd' ? headerV0(buf, b, 'mvhd', movieDur) : raw(buf, b));
    return mk('moov', ...moovKids, ...traks);
  };
  const ftypBox = mk('ftyp', Buffer.from('isom', 'latin1'), be32(0x200), Buffer.from('isomiso2avc1mp41', 'latin1'));
  const dataLen = allChunks.reduce((s, x) => s + x.c.size, 0);
  const big = ftypBox.length + 2e6 + dataLen > 0xffffffff;
  const mdatHdr = big ? 16 : 8;
  let moovBuf = build(big, 0);
  moovBuf = build(big, ftypBox.length + moovBuf.length + mdatHdr);   // 목차 크기가 정해진 뒤 실제 위치로 다시
  const mdatHead = Buffer.alloc(mdatHdr);
  if (big) { mdatHead.writeUInt32BE(1, 0); mdatHead.write('mdat', 4, 'latin1'); mdatHead.writeBigUInt64BE(BigInt(mdatHdr + dataLen), 8); }
  else { mdatHead.writeUInt32BE(mdatHdr + dataLen, 0); mdatHead.write('mdat', 4, 'latin1'); }
  const out = Buffer.concat([ftypBox, moovBuf, mdatHead, ...allChunks.map(x => buf.subarray(x.c.off, x.c.off + x.c.size))]);
  return { buf: out, changed: true, tracks: list.map(T => ({ type: T.handler, samples: T.samples.length, sec: Math.round(T.mediaDur / T.scale * 100) / 100, sync: T.samples.filter(s => s.sync).length })), sec: Math.round(movieDur / movieScale * 100) / 100 };
}
module.exports = { flatten };
