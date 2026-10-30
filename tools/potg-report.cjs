// 🎬 팟지 한 판 점검(읽기만 함) — 실제 내전 한 판 끝난 뒤 팟지가 어디까지 됐는지 한눈에
// 사용: node tools/potg-report.cjs            (오늘 날짜 · 하루 = 새벽 6시 기준)
//       node tools/potg-report.cjs 2026-10-28 (날짜 지정)
// 보는 것: ① 각 PC 수집(today/potg/raw) ② 방장이 고른 장면(session.potg·경기 기록 potg) ③ 영상(today/clips) ④ 리플레이 확인(replayProbe)
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app/today';
const get = async p => { const r = await fetch(`${DB}/${p}.json`); return r.ok ? r.json() : null; };
const dayKey = (t = Date.now()) => { const d = new Date(t - 6 * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const when = t => t ? new Date(t).toLocaleTimeString('ko-KR') : '-';
const mmss = s => s == null ? '-' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
(async () => {
  const day = process.argv[2] || dayKey();
  console.log(`📅 ${day}`);
  const [raw, session, matches, clips, probe] = await Promise.all([get(`potg/raw/${day}`), get('session'), get(`days/${day}/matches`), get(`clips/${day}`), get('bridge/replayProbe')]);
  const games = Object.keys(matches || {}).sort((a, b) => (matches[a].ts || 0) - (matches[b].ts || 0));
  if (!games.length) console.log('  이 날 경기 기록 없음');
  for (const gid of games) {
    const m = matches[gid], r = (raw || {})[gid] || {}, c = (clips || {})[gid];
    console.log(`\n■ 경기 ${gid} · ${m.source || '?'} · ${m.winner === 'teamA' ? '1팀' : m.winner === 'teamB' ? '2팀' : '?'} 승 · ${mmss(m.gameTime)}`);
    // ① 수집
    const recs = Object.values(r);
    console.log(`  ① 수집 ${recs.length}명 / 참가 ${(m.teamA || []).length + (m.teamB || []).length}명`);
    for (const x of recs) console.log(`     - ${x.name} · 사건 ${(x.events || []).length}개 · 체력 기록 ${(x.hp || []).length}개 · 선수 ${(x.players || []).length}명 · ${when(x.at)}`);
    const names = new Set(); recs.forEach(x => (x.events || []).forEach(e => e.k && names.add(e.k)));
    if (names.size) console.log(`     킬한 사람 이름(라이브 클라이언트 표기): ${[...names].join(', ')}`);
    // ② 고른 장면
    const p = m.potg || (session && session.game && String(session.game.id) === gid ? session.potg : null);
    if (!p) console.log('  ② 팟지: 아직 안 고름(방장 앱이 투표/결과 화면에서 골라요)');
    else if (p.none) console.log('  ② 팟지: 고를 장면 없음(킬 사건이 하나도 없었음)');
    else console.log(`  ② 팟지: ${p.name}(${p.champ}) · ${p.label} ${p.tags ? '· ' + [].concat(p.tags).join('·') : ''} · ${mmss(p.t0)}~${mmss(p.t1)} · 킬 ${(p.kills || []).length}개${p.clip ? ' · 영상 있음' : ' · 영상 없음(카드로 나옴)'}`);
    if (p && p.hero) { const h = p.hero; console.log(`  ②-2 숨은 영웅: ${h.name}(${h.champ}) · ${h.label}(${h.kind}) · ${[].concat(h.tags || []).join('·')} · 핵심 ${mmss(h.peak)} · 점수 ${h.score}${h.clip ? ' · 영상 있음' : ' · 영상 없음(지표 카드)'}`); }
    else if (p && !p.none) console.log('  ②-2 숨은 영웅: 없음(문턱 넘는 서포터·탱커 장면 없음)');
    const eogRole = (m.stats || []).filter(x => x.taken != null || x.xs);   // 정산 지표 실제 키 확인용
    if (eogRole.length) console.log(`     정산 지표 키: ${Object.keys(eogRole[0].xs || {}).join(', ') || '(없음)'} · 힐·보호막 ${eogRole.map(x => (x.healMates || 0) + (x.shieldMates || 0)).join('/')}`);
    // ③ 영상
    if (m.potgRec) { const r = m.potgRec; console.log(`  ③ 리플레이 녹화(방장 PC): ${r.ok ? '✅ 성공' : '❌ ' + (r.why || '실패')} · ${r.sec}초${r.mb ? ' · ' + r.mb + 'MB' : ''}${r.hero != null ? ` · 숨은 영웅 ${r.hero ? '✅' + (r.mbHero ? ' ' + r.mbHero + 'MB' : '') : '❌'}` : ''}`); for (const l of r.lines || []) console.log('       ' + l); }
    console.log(`  ③ 영상: ${c && c.meta ? `${c.meta.n}조각 · ${(c.meta.size / 1048576).toFixed(1)}MB · ${c.meta.mime}` : '없음(리플레이 녹화는 아직 없음 — 정상)'}`);
    // ④ 리플레이 확인
    const pr = (probe || {})[gid];
    if (pr) for (const x of Object.values(pr)) console.log(`  ④ 리플레이 ${x.name || '?'}${x.host ? '(방장)' : ''}: ${x.result} · ${(x.steps || []).map(s => `${s.t}초 ${s.state}`).join(' → ')}${x.file ? ' · 파일 ' + JSON.stringify(x.file) : ''}`);
    else console.log('  ④ 리플레이 확인 기록 없음');
    // ⑤ 타임라인 확인(v0.1.46) — 원본(raw)은 크니 요약만
    const [tlOk, tlSum, tlTries, tlBytes] = await Promise.all([get(`bridge/timelineProbe/${gid}/ok`), get(`bridge/timelineProbe/${gid}/sum`), get(`bridge/timelineProbe/${gid}/tries`), get(`bridge/timelineProbe/${gid}/bytes`)]);
    if (tlOk == null && !tlTries) console.log('  ⑤ 타임라인 확인 기록 없음(v0.1.46 이후 방장 앱에서만)');
    else {
      console.log(`  ⑤ 타임라인: ${tlOk ? `✅ 받음 ${((tlBytes || 0) / 1024).toFixed(0)}KB` : '❌ 못 받음'} · 시도 ${(tlTries || []).map(t => `${t.t}초 ${t.status}`).join(', ')}`);
      if (tlSum) {
        console.log(`     프레임 ${tlSum.frames}개(간격 ${tlSum.interval}) · 프레임 키 ${(tlSum.frameKeys || []).join(',')}`);
        console.log(`     선수 프레임 키 ${(tlSum.pfKeys || []).join(',')}${tlSum.damageKeys ? ' · 딜 ' + tlSum.damageKeys.join(',') : ''}`);
        console.log(`     사건 ${Object.entries(tlSum.eventTypes || {}).map(([k, v]) => k + ' ' + v).join(' · ')}`);
        console.log(`     킬 키 ${(tlSum.killKeys || []).join(',')} · ★ 킬마다 딜 상세 ${tlSum.killDamage ? '있음' : '없음'}`);
        if (tlSum.sample && tlSum.sample.CHAMPION_KILL) console.log(`     킬 예시 ${tlSum.sample.CHAMPION_KILL.slice(0, 600)}`);
      }
    }
  }
  if (session) console.log(`\n지금 판 상태: phase ${session.phase} · 게임 ${session.game ? session.game.id : '-'} · potg ${session.potg ? (session.potg.none ? '없음' : session.potg.name) : '-'}`);
})().catch(e => console.log('읽기 실패:', e.message));
