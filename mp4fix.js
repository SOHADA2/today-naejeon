// 🎞️ v0.1.212 크롬 MediaRecorder mp4 바로잡기 — 「효과 넣어 저장」 mp4(H.264)의 영상 프레임이 mp4 규칙(NAL 앞에 4바이트 길이)이 아니라
//   방송용 구분 표시(00 00 00 01)로 들어가 있음(2026-11-18 실측: 영상 샘플 1254개 전부) → ffmpeg는 알아서 복구하지만(「Invalid NAL unit size」 868줄)
//   아이폰·윈도우 기본 재생기처럼 엄격한 재생기는 깨질 수 있음 → 저장 전에 영상 트랙 샘플마다 구분 표시를 그 뒤 NAL 길이로 바꿔 씀
//   구분 표시와 길이 칸이 둘 다 4바이트라 파일 크기·위치는 그대로(조각 mp4 moof/trun 표를 고칠 필요 없음)
//   3바이트 구분 표시(00 00 01)가 섞인 샘플은 크기가 달라져 손대지 않음(건너뛴 수를 돌려줌) · 이미 길이 방식이면 그대로
const kids = (b, s, e) => { const o = []; let p = s; while (p + 8 <= e) { let sz = b.readUInt32BE(p); const ty = b.toString('latin1', p + 4, p + 8); if (sz === 1) sz = Number(b.readBigUInt64BE(p + 8)); if (sz < 8) sz = e - p; o.push({ ty, p, sz }); p += sz; } return o; };
function trackKinds(b, moov) {
  const kind = {};
  for (const t of kids(b, moov.p + 8, moov.p + moov.sz).filter(x => x.ty === 'trak')) {
    const tk = kids(b, t.p + 8, t.p + t.sz), tkhd = tk.find(x => x.ty === 'tkhd'), mdia = tk.find(x => x.ty === 'mdia');
    if (!tkhd || !mdia) continue;
    const id = b.readUInt32BE(tkhd.p + 8 + (b[tkhd.p + 8] ? 20 : 12)) ;
    const hdlr = kids(b, mdia.p + 8, mdia.p + mdia.sz).find(x => x.ty === 'hdlr');
    if (hdlr) kind[id] = b.toString('latin1', hdlr.p + 16, hdlr.p + 20);
  }
  return kind;
}
function fixSample(b, s, e) {   // s~e = 샘플 하나 · 00000001 로 시작해야 손댐
  if (e - s < 5 || b.readUInt32BE(s) !== 1) return 'skip';
  const starts = [];
  for (let i = s; i + 4 <= e; i++) {
    if (b[i] === 0 && b[i + 1] === 0) {
      if (b[i + 2] === 0 && b[i + 3] === 1) { starts.push(i); i += 3; continue; }
      if (b[i + 2] === 1) return 'three';   // 3바이트 구분 표시 → 크기가 달라져 못 고침
    }
  }
  for (let k = 0; k < starts.length; k++) { const from = starts[k] + 4, to = k + 1 < starts.length ? starts[k + 1] : e; b.writeUInt32BE(to - from, starts[k]); }
  return 'fixed';
}
function fixAnnexB(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf), top = kids(b, 0, b.length), moov = top.find(x => x.ty === 'moov');
  const res = { fixed: 0, skipped: 0, three: 0 };
  if (!moov) return res;
  const kind = trackKinds(b, moov);
  for (const moof of top.filter(x => x.ty === 'moof')) {
    for (const traf of kids(b, moof.p + 8, moof.p + moof.sz).filter(x => x.ty === 'traf')) {
      const tk = kids(b, traf.p + 8, traf.p + traf.sz), tfhd = tk.find(x => x.ty === 'tfhd'), trun = tk.find(x => x.ty === 'trun');
      if (!tfhd || !trun) continue;
      const tid = b.readUInt32BE(tfhd.p + 12), tff = b.readUInt32BE(tfhd.p + 8) & 0xffffff;
      if (kind[tid] !== 'vide') continue;
      let q = tfhd.p + 16, base = moof.p; if (tff & 1) { base = Number(b.readBigUInt64BE(q)); q += 8; } if (tff & 2) q += 4; if (tff & 8) q += 4;
      const defSize = (tff & 0x10) ? b.readUInt32BE(q) : 0;
      const fl = b.readUInt32BE(trun.p + 8) & 0xffffff, n = b.readUInt32BE(trun.p + 12);
      let r = trun.p + 16, off = 0; if (fl & 1) { off = b.readInt32BE(r); r += 4; } if (fl & 4) r += 4;
      let pos = base + off;
      for (let k = 0; k < n; k++) {
        let sz = defSize; if (fl & 0x100) r += 4; if (fl & 0x200) { sz = b.readUInt32BE(r); r += 4; } if (fl & 0x400) r += 4; if (fl & 0x800) r += 4;
        if (pos + sz <= b.length) { const x = fixSample(b, pos, pos + sz); res[x === 'fixed' ? 'fixed' : x === 'three' ? 'three' : 'skipped']++; }
        pos += sz;
      }
    }
  }
  return res;
}
module.exports = { fixAnnexB };
