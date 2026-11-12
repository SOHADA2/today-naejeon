// ⚙️ 설정 · 🔄 업데이트 · 버전 (v0.1.39) — 왼쪽(overlay)·오른쪽(sidepanel) 창이 같이 씀 · 팟지 창은 효과음 크기만
//  창 머리에 ⚙ 버튼(최소화 버튼 왼쪽) → 창 안에 설정 화면(버전·업데이트 / 효과음 / 창 / 단축키 / 종료)
//  업데이트가 준비되면 머리 바로 아래 금색 알림 줄 + ⚙에 점 (전엔 오른쪽 아래 따로 뜨는 창이라 게임 중에도 튀어나왔음)
//  효과음 크기 = window.__tnVol (0~1) — 각 화면의 효과음이 재생할 때 곱함
(function () {
  const api = window.api; if (!api || !api.getSettings) return;
  const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let invEdit = false;   // 🎧 v0.1.138 초대 링크 입력 중
  let S = { discordRpc: true, discordMove: true, discord: null, autoSeat: true, augRank: false, sfxOn: true, sfxVol: 1, dock: true, sidePanel: true, closeAsk: true, autoLaunch: true, hotkey: 'Shift+F7' }, U = { state: 'idle' }, hideStrip = false;
  const applyVol = () => { window.__tnVol = S.sfxOn ? S.sfxVol : 0; };
  applyVol();
  const header = document.querySelector('#bar, #sbar'), minBtn = document.querySelector('#ov-min, #s-min');
  const ui = !!(header && minBtn);
  let gear, strip, panel;
  if (ui) {
    gear = $(`<button class="tn-gear ${minBtn.className}" title="설정 · 버전·업데이트"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M9.44 4.53L9.57 1.89A10.4 10.4 0 0 1 14.43 1.89L14.56 4.53A7.9 7.9 0 0 1 15.48 4.91L15.48 4.91L17.43 3.13A10.4 10.4 0 0 1 20.87 6.57L19.09 8.52A7.9 7.9 0 0 1 19.47 9.44L19.47 9.44L22.11 9.57A10.4 10.4 0 0 1 22.11 14.43L19.47 14.56A7.9 7.9 0 0 1 19.09 15.48L19.09 15.48L20.87 17.43A10.4 10.4 0 0 1 17.43 20.87L15.48 19.09A7.9 7.9 0 0 1 14.56 19.47L14.56 19.47L14.43 22.11A10.4 10.4 0 0 1 9.57 22.11L9.44 19.47A7.9 7.9 0 0 1 8.52 19.09L8.52 19.09L6.57 20.87A10.4 10.4 0 0 1 3.13 17.43L4.91 15.48A7.9 7.9 0 0 1 4.53 14.56L4.53 14.56L1.89 14.43A10.4 10.4 0 0 1 1.89 9.57L4.53 9.44A7.9 7.9 0 0 1 4.91 8.52L4.91 8.52L3.13 6.57A10.4 10.4 0 0 1 6.57 3.13L8.52 4.91A7.9 7.9 0 0 1 9.44 4.53Z M15.3 12A3.3 3.3 0 1 0 8.7 12A3.3 3.3 0 1 0 15.3 12Z" fill="currentColor"/></svg><i class="tn-gear-dot"></i></button>`);
    header.insertBefore(gear, minBtn);
    strip = $(`<div class="tn-upstrip" style="display:none;"><span class="tn-up-tx"></span><button class="tn-up-go">업데이트</button><button class="tn-up-x" title="닫기(설정 ⚙에서 다시 볼 수 있어요)">✕</button></div>`);
    header.insertAdjacentElement('afterend', strip);
    panel = $(`<div class="tn-set" style="display:none;"></div>`);
    document.body.appendChild(panel);
    gear.onclick = (e) => { e.stopPropagation(); panel.style.display === 'none' ? openPanel() : closePanel(); };
    strip.querySelector('.tn-up-go').onclick = updateNow;
    strip.querySelector('.tn-up-x').onclick = () => { hideStrip = true; renderStrip(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  }
  function updateNow() { api.updateNow(); }   // v0.1.143: 윈도우 기본 확인 창 뺌(톤앤매너) — 누르면 「설치 중」 줄 → 조용히 설치 → 다시 켜짐
  const upLine = () => ({
    ready: [`새 버전 <b>v${esc(U.version)}</b> 준비됨`, 'gold'], downloading: [`새 버전 v${esc(U.version || '')} 받는 중 · ${U.pct || 0}%`, ''], checking: ['새 버전 확인 중…', ''],
    installing: [`새 버전 v${esc(U.version || '')} 설치 중 · 몇 초 뒤 다시 켜져요`, 'gold'], updated: [`v${esc(U.cur || '')}로 업데이트됐어요`, 'ok'],
    latest: ['최신 버전이에요', 'ok'], error: ['업데이트를 확인하지 못했어요', 'err'], dev: ['개발 실행(자동 업데이트 꺼짐)', ''], idle: ['', ''],
  }[U.state] || ['', '']);
  function renderStrip() {
    if (!ui) return;
    const ready = U.state === 'ready', inst = U.state === 'installing', done = U.state === 'updated';
    gear.classList.toggle('has-up', ready);
    strip.style.display = (ready && !hideStrip) || inst || done ? '' : 'none';
    strip.classList.toggle('busy', inst || done);   // 설치 중·업데이트됨 = 버튼 숨김
    // v0.1.148: 두 줄 → 한 줄(사장님: 왼쪽 창 위쪽이 번잡) · 둘째 줄 설명은 마우스 올림(title → tip.js)
    const tx = strip.querySelector('.tn-up-tx');
    if (ready) { tx.innerHTML = `<span>🔄 새 버전 <b>v${esc(U.version)}</b> 준비됨</span>`; tx.title = '누르면 잠깐 꺼졌다가 새 버전으로 다시 켜져요'; }
    else if (inst) { tx.innerHTML = `<span>🔄 <b>v${esc(U.version || '')}</b> 설치 중 · 끄지 마세요</span>`; tx.title = '몇 초 뒤 다시 켜져요'; }
    else if (done) { tx.innerHTML = `<span>✅ <b>v${esc(U.cur || '')}</b>로 업데이트됐어요</span>`; tx.title = U.from ? `v${U.from}에서` : ''; }
  }
  // ⚠️ 2026-11-09 배포 위험 점검 #5: 증강 순위를 켤 때 한 번 더 확인(라이엇이 따로 승인한 기능이 아님)
  const AUG_ASK = '증강 순위는 라이엇이 따로 승인한 기능이 아닙니다.\n게임 화면에 보이는 증강 이름만 읽고 게임 파일이나 메모리는 건드리지 않지만, 라이엇 정책이 바뀌면 문제가 될 수 있습니다.\n\n켤까요?';
  const tog = (key, label, sub) => `<label class="tn-row"><span class="tn-row-tx"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="tn-sw" data-k="${key}" ${S[key] ? 'checked' : ''}></label>`;
  function renderPanel() {
    if (!ui || panel.style.display === 'none') return;
    const [line, cls] = upLine();
    panel.innerHTML = `<div class="tn-set-hd"><span class="tn-set-en">SETTINGS</span><b>설정</b><button class="tn-set-x" title="닫기">✕</button></div>
      <div class="tn-set-body ui-scroll">
        <div class="tn-sec">버전</div>
        <div class="tn-ver"><div class="tn-ver-tx"><b>투데이 내전 <span class="num">v${esc(U.cur || '')}</span></b><small class="${cls}">${line}</small></div>
          ${U.state === 'ready' ? '<button class="ui-btn-gold tn-ver-go" data-act="up">지금 업데이트</button>'
            : `<button class="tn-btn" data-act="check" ${['checking', 'downloading', 'dev'].includes(U.state) ? 'disabled' : ''}>업데이트 확인</button>`}</div>
        ${U.state === 'downloading' ? `<div class="tn-prog"><i style="width:${U.pct || 0}%"></i></div>` : ''}
        <div class="tn-sec">소리</div>
        ${tog('sfxOn', '효과음', '동전·픽·팟지 소리')}
        <div class="tn-row tn-vol${S.sfxOn ? '' : ' off'}"><span class="tn-row-tx"><b>크기</b></span><input type="range" min="0" max="100" step="5" value="${Math.round(S.sfxVol * 100)}" class="tn-range" ${S.sfxOn ? '' : 'disabled'}><span class="tn-vol-n num">${Math.round(S.sfxVol * 100)}</span></div>
        <div class="tn-sec">대기방</div>
        ${tog('autoSeat', '팀 자리로 자동 이동 <span class=\"tn-tip\" data-tip=\"팀이 정해지면 롤 사용자 설정 게임 방에서 내 자리를 1팀·2팀·관전석으로 옮겨요(롤의 「팀 참가」 버튼과 같은 동작 · 내 자리만). 한 번 옮긴 뒤 직접 바꾸면 그대로 둬요\">ⓘ</span>', '롤 대기방에서 1팀·2팀으로')}
        ${tog('lolRemake', '팀 정할 때 롤 방 다시 만들기 <span class=\"tn-tip\" data-tip=\"방장일 때 · 롤 사용자 설정 방에 있으면, 팀이 정해질 때 그 판 다리(드래프트 = 선픽이 아닌 팀장이 고름 · 나머지 = 무작위)로 방을 다시 만들고 그 판 사람 전원을 초대해요. 같은 방으로 계속하면 다리가 안 바뀌어서요\">ⓘ</span>', '방장 · 판마다 다리 바뀜')}
        ${tog('lolAutoAccept', '방장 롤 초대 자동 수락', '방장이 롤 방을 다시 만들면 바로 들어가요')}
        <div class="tn-sec">디스코드</div>
        ${S.discord && S.discord.room ? `<div class="tn-row tn-dc"><span class="tn-row-tx"><b>이 방 디스코드 · ${esc(S.discord.room.name)}</b><small>${S.discord.room.ch ? '내전 대기실 음성 채널을 디스코드 앱으로' : '서버 초대 링크를 디스코드 앱으로'}</small></span><button class="tn-btn" data-act="dcroom" ${S.discord.room.ch || S.discord.room.code ? '' : 'disabled'}>${S.discord.room.ch ? '음성 채널 열기' : '들어가기'}</button></div>` : ''}
        <div class="tn-row tn-dc"><span class="tn-row-tx"><b>${S.discord && S.discord.on ? `연결됨 · ${esc(S.discord.name || '디스코드')}` : S.discord && S.discord.app ? '디스코드 앱이 꺼져 있어요' : '준비 중'}</b><small>${S.discord && S.discord.on ? '이 PC의 디스코드 앱과 연결' : S.discord && S.discord.app ? 'PC 디스코드 앱을 켜면 저절로 연결돼요' : '디스코드 연동 준비 중이에요'}</small></span><i class="tn-dc-dot${S.discord && S.discord.on ? ' on' : ''}"></i></div>
        ${S.discord && S.discord.app ? `<div class="tn-row tn-dc"><span class="tn-row-tx"><b>${S.discord.guild ? `서버 · ${esc(S.discord.guild)}` : '디스코드 서버'}</b><small>${S.discord.guild ? '팀이 정해지면 이 서버의 1팀·2팀 채널로' : '봇을 우리 서버에 넣고 연결(방장)'}</small></span><button class="tn-btn" data-act="dcgo" ${S.discord.connecting ? 'disabled' : ''}>${S.discord.connecting ? '브라우저에서 고르는 중' : S.discord.guild ? '바꾸기' : '서버 연결'}</button></div>` : ''}
        ${S.discord && S.discord.app ? (invEdit ? `<div class="tn-row tn-dc"><input class="tn-inv-in" placeholder="https://discord.gg/…  (비우면 지움)" value="${S.discord.invite ? 'https://discord.gg/' + esc(S.discord.invite) : ''}" maxlength="80"><button class="tn-btn" data-act="dcinvsave">저장</button></div>`
          : `<div class="tn-row tn-dc"><span class="tn-row-tx"><b>초대 링크</b><small>${S.discord.invite ? `discord.gg/${esc(S.discord.invite)} · 서버에 없는 방 사람에게 「들어가기」` : '방장이 넣으면 서버에 없는 친구에게 「들어가기」 버튼'}</small></span><button class="tn-btn" data-act="dcinv">${S.discord.invite ? '바꾸기' : '넣기'}</button></div>`) : ''}
        ${tog('discordRpc', '디스코드에 내 상태 보이기 <span class=\"tn-tip\" data-tip=\"디스코드 프로필에 「투데이 내전 · 대기실 · 방 이름 · 6명 모임」처럼 지금 하고 있는 걸 보여 줘요(디스코드 설정 「활동 상태」가 켜져 있어야 보여요)\">ⓘ</span>', '대기실·드래프트·내전 중')}
        ${tog('discordMove', '음성 채널 자동 나누기 <span class=\"tn-tip\" data-tip=\"내가 방장일 때 팀이 정해지면 디스코드 음성 채널 「1팀」「2팀」으로 옮기고, 게임이 끝나면 원래 채널로 모아요. 서버에 투데이 내전 봇과 「1팀」「2팀」 음성 채널이 있어야 하고, 음성 채널에 들어와 있고 디스코드 앱을 켠 사람만 옮겨요\">ⓘ</span>', '방장일 때 · 1팀/2팀 채널로')}
        <div class="tn-sec">게임 중</div>
        ${tog('augRank', '증강 순위 <span class=\"tn-tip\" data-tip=\"증강 3개가 뜨면 게임 화면에서 이름을 읽어(Windows 글자 읽기) 내 챔피언 기준 1·2·3위를 카드 위에 띄워요. 리롤하면 바로 다시 매겨요. 화면을 보기만 하고 게임 파일은 안 건드리지만, 라이엇 정책상 위험할 수 있어요. 게임 중 Shift+F8 = 그 화면을 개발용으로 보내기\">ⓘ</span>', '뜬 증강에 1·2·3위 · 베타 · 라이엇 승인 기능 아님')}
        <div class="tn-sec">창</div>
        ${tog('dock', '롤 클라이언트 옆에 붙이기', '끄면 두 창이 따로 떠 있어요')}
        ${tog('sidePanel', '오른쪽 창 보이기', '진행·오늘·프로필')}
        ${tog('closeAsk', '✕ 누르면 「숨기기/종료」 묻기', '끄면 묻지 않고 숨기기만')}
        ${tog('autoLaunch', '윈도우 시작할 때 자동 실행', '트레이에만 켜 두고 롤을 켜면 나타나요')}
        <div class="tn-sec">단축키</div>
        <div class="tn-row"><span class="tn-row-tx"><b>왼쪽 창 켜기/끄기</b></span><span class="tn-key num">${esc(S.hotkey)}</span></div>
        <div class="tn-sec">도움말</div>
        <button class="tn-btn tn-tut" data-act="tut">📘 사용법 다시 보기</button>
        <button class="tn-quit" data-act="quit">투데이 내전 완전히 종료</button>
      </div>`;
    panel.querySelector('.tn-set-x').onclick = closePanel;
    panel.querySelectorAll('.tn-sw').forEach(c => c.onchange = async () => { if (c.dataset.k === 'augRank' && c.checked && !(await tnConfirm(AUG_ASK, { ok: '켜기' }))) { c.checked = false; return; } api.setSetting(c.dataset.k, c.checked).then(v => { if (v) { S = v; applyVol(); renderPanel(); } }); });
    const r = panel.querySelector('.tn-range'), n = panel.querySelector('.tn-vol-n');
    if (r) { r.oninput = () => { n.textContent = r.value; S.sfxVol = r.value / 100; applyVol(); }; r.onchange = () => api.setSetting('sfxVol', r.value / 100); }
    { const ii = panel.querySelector('.tn-inv-in'); if (ii) ii.onkeydown = e => { if (e.key === 'Enter') panel.querySelector('[data-act=dcinvsave]').click(); }; }
    panel.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      if (b.dataset.act === 'tut') { closePanel(); if (api.openTutorial) api.openTutorial(); }
      else if (b.dataset.act === 'up') updateNow();
      else if (b.dataset.act === 'check') api.checkUpdate();
      else if (b.dataset.act === 'dcinv') { invEdit = true; renderPanel(); const i = panel.querySelector('.tn-inv-in'); if (i) { i.focus(); i.select(); } }
      else if (b.dataset.act === 'dcinvsave' && api.discordInvite) { const i = panel.querySelector('.tn-inv-in'); api.discordInvite(i ? i.value : '').then(r => { if (r && !r.ok) tnAlert('초대 링크 · ' + r.err); else { invEdit = false; renderPanel(); } }).catch(() => {}); }
      else if (b.dataset.act === 'dcroom' && api.discordJoin && S.discord && S.discord.room) { const R = S.discord.room; api.discordJoin(R.ch ? { gid: R.gid, ch: R.ch } : { gid: R.gid, code: R.code }); }   // v0.1.157 「이 방 디스코드」
      else if (b.dataset.act === 'dcgo' && api.discordConnect) api.discordConnect().then(r => { if (r && !r.ok && r.err) tnAlert('디스코드 서버 연결 · ' + r.err); else if (r && r.ok && r.lack && r.lack.length) tnAlert(`연결됐어요 · 서버에 음성 채널 ${r.lack.join('·')}을 만들어 주세요`); }).catch(() => {});
      else if (b.dataset.act === 'quit') tnConfirm('투데이 내전을 완전히 종료할까요?', { ok: '종료', danger: true }).then(y => { if (y) api.quitApp(); });
    });
  }
  function openPanel() { const r = (strip.style.display === 'none' ? header : strip).getBoundingClientRect(); panel.style.top = Math.round(r.bottom) + 'px'; panel.style.display = ''; gear.classList.add('on'); renderPanel(); api.getSettings().then(v => { if (v) { S = v; renderPanel(); } }).catch(() => {}); if (U.state === 'idle' || U.state === 'error') api.checkUpdate(); }
  function closePanel() { if (!ui) return; panel.style.display = 'none'; gear.classList.remove('on'); }
  api.getSettings().then(v => { if (v) { S = v; applyVol(); renderPanel(); } }).catch(() => {});
  api.onSettings(v => { S = v; applyVol(); renderPanel(); });
  if (api.getUpdate) api.getUpdate().then(u => { if (u) { U = u; renderStrip(); renderPanel(); } }).catch(() => {});
  if (api.onUpdate) api.onUpdate(u => { const was = U.state; U = u; if (u.state === 'ready' && was !== 'ready') hideStrip = false; renderStrip(); renderPanel(); });
})();
