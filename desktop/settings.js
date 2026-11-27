// ⚙️ 설정 · 🔄 업데이트 · 버전 (v0.1.39) — 왼쪽(overlay)·오른쪽(sidepanel) 창이 같이 씀 · 팟지 창은 효과음 크기만
//  창 머리에 ⚙ 버튼(최소화 버튼 왼쪽) → 창 안에 설정 화면(버전·업데이트 / 효과음 / 창 / 단축키 / 종료)
//  업데이트가 준비되면 머리 바로 아래 금색 알림 줄 + ⚙에 점 (전엔 오른쪽 아래 따로 뜨는 창이라 게임 중에도 튀어나왔음)
//  효과음 크기 = window.__tnVol (0~1) — 각 화면의 효과음이 재생할 때 곱함
(function () {
  const api = window.api; if (!api || !api.getSettings) return;
  const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pubDay = t => { const d = new Date(t || 0); return t ? `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` : ''; };   // 🔒 v0.1.253
  let invEdit = false;   // 🎧 v0.1.138 초대 링크 입력 중
  let S = { discordRpc: true, discordMove: true, discord: null, autoSeat: true, lolPing: true, sfxOn: true, sfxVol: 1, dock: true, sidePanel: true, closeAsk: true, autoLaunch: true, hotkey: 'Shift+F7' }, U = { state: 'idle' }, hideStrip = false;
  const applyVol = () => { window.__tnVol = S.sfxOn ? S.sfxVol : 0; };
  applyVol();
  const header = document.querySelector('#bar, #sbar'), minBtn = document.querySelector('#ov-min, #s-min');
  const ui = !!(header && minBtn);
  let gear, strip, panel;
  if (ui) {
    gear = $(`<button class="tn-gear ${minBtn.className}" title="설정 · 버전·업데이트"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M9.44 4.53L9.57 1.89A10.4 10.4 0 0 1 14.43 1.89L14.56 4.53A7.9 7.9 0 0 1 15.48 4.91L15.48 4.91L17.43 3.13A10.4 10.4 0 0 1 20.87 6.57L19.09 8.52A7.9 7.9 0 0 1 19.47 9.44L19.47 9.44L22.11 9.57A10.4 10.4 0 0 1 22.11 14.43L19.47 14.56A7.9 7.9 0 0 1 19.09 15.48L19.09 15.48L20.87 17.43A10.4 10.4 0 0 1 17.43 20.87L15.48 19.09A7.9 7.9 0 0 1 14.56 19.47L14.56 19.47L14.43 22.11A10.4 10.4 0 0 1 9.57 22.11L9.44 19.47A7.9 7.9 0 0 1 8.52 19.09L8.52 19.09L6.57 20.87A10.4 10.4 0 0 1 3.13 17.43L4.91 15.48A7.9 7.9 0 0 1 4.53 14.56L4.53 14.56L1.89 14.43A10.4 10.4 0 0 1 1.89 9.57L4.53 9.44A7.9 7.9 0 0 1 4.91 8.52L4.91 8.52L3.13 6.57A10.4 10.4 0 0 1 6.57 3.13L8.52 4.91A7.9 7.9 0 0 1 9.44 4.53Z M15.3 12A3.3 3.3 0 1 0 8.7 12A3.3 3.3 0 1 0 15.3 12Z" fill="currentColor"/></svg><i class="tn-gear-dot"></i></button>`);
    header.insertBefore(gear, minBtn);
    strip = $(`<div class="tn-upstrip" style="display:none;"><span class="tn-up-tx"></span><button class="tn-up-go">업데이트</button><button class="tn-up-x" title="닫기(설정 ⚙에서 다시 볼 수 있습니다)">✕</button></div>`);
    header.insertAdjacentElement('afterend', strip);
    panel = $(`<div class="tn-set" style="display:none;"></div>`);
    document.body.appendChild(panel);
    gear.onclick = (e) => { e.stopPropagation(); panel.style.display === 'none' ? openPanel() : closePanel(); };
    strip.querySelector('.tn-up-go').onclick = updateNow;
    strip.querySelector('.tn-up-x').onclick = () => { hideStrip = true; renderStrip(); };
    // 📢 v0.1.245 운영 공지 띠(운영 보드에서 씀 · ✕로 닫으면 그 공지는 다시 안 뜸)
    const nstrip = $(`<div class="tn-notice" style="display:none;"><span class="tn-nt-en">NOTICE</span><span class="tn-nt-tx"></span><button class="tn-nt-x" title="닫기(이 공지는 다시 안 떠요)">✕</button></div>`);
    strip.insertAdjacentElement('afterend', nstrip);
    let N = null;
    const drawNotice = n => { N = n; nstrip.style.display = n ? '' : 'none'; nstrip.classList.toggle('warn', !!(n && n.lv === 'warn')); nstrip.querySelector('.tn-nt-tx').textContent = n ? n.text : ''; };
    nstrip.querySelector('.tn-nt-x').onclick = () => { if (N) api.noticeDismiss(N.id); drawNotice(null); };
    if (api.onNotice) { api.onNotice(drawNotice); api.getNotice().then(drawNotice).catch(() => {}); }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  }
  function updateNow() { api.updateNow(); }   // v0.1.143: 윈도우 기본 확인 창 뺌(톤앤매너) — 누르면 「설치 중」 줄 → 조용히 설치 → 다시 켜짐
  const upLine = () => ({
    ready: [`새 버전 <b>v${esc(U.version)}</b> 준비됨`, 'gold'], downloading: [`새 버전 v${esc(U.version || '')} 받는 중 · ${U.pct || 0}%`, ''], checking: ['새 버전 확인 중…', ''],
    installing: [`새 버전 v${esc(U.version || '')} 설치 중 · 몇 초 뒤 다시 켜집니다`, 'gold'], updated: [`v${esc(U.cur || '')}로 업데이트됐습니다`, 'ok'],
    latest: ['최신 버전입니다', 'ok'], error: ['업데이트를 확인하지 못했습니다', 'err'], dev: ['개발 실행(자동 업데이트 꺼짐)', ''], idle: ['', ''],
  }[U.state] || ['', '']);
  function renderStrip() {
    if (!ui) return;
    const ready = U.state === 'ready', inst = U.state === 'installing', done = U.state === 'updated';
    gear.classList.toggle('has-up', ready);
    strip.style.display = (ready && !hideStrip) || inst || done ? '' : 'none';
    strip.classList.toggle('busy', inst || done);   // 설치 중·업데이트됨 = 버튼 숨김
    // v0.1.148: 두 줄 → 한 줄(사장님: 왼쪽 창 위쪽이 번잡) · 둘째 줄 설명은 마우스 올림(title → tip.js)
    const tx = strip.querySelector('.tn-up-tx');
    if (ready) { tx.innerHTML = `<span>🔄 새 버전 <b>v${esc(U.version)}</b> 준비됨</span>`; tx.title = '누르면 잠깐 꺼졌다가 새 버전으로 다시 켜집니다'; }
    else if (inst) { tx.innerHTML = `<span>🔄 <b>v${esc(U.version || '')}</b> 설치 중 · 끄지 마세요</span>`; tx.title = '몇 초 뒤 다시 켜집니다'; }
    else if (done) { tx.innerHTML = `<span>✅ <b>v${esc(U.cur || '')}</b>로 업데이트됐습니다</span>`; tx.title = U.from ? `v${U.from}에서` : ''; }
  }
  // 🗂️ v0.1.269 설정 = 탭 4개(일반·내전·디스코드·계정) + 묶음 카드(사장님: 설정창이 번잡 — 한 줄로 25칸 넘게 이어지고 구역 제목이 흐려 안 나뉘어 보였음)
  //   자세한 설명은 줄에 마우스를 올리면(title → tip.js) · 줄 아래 작은 글은 짧게 한 줄 · ⓘ 아이콘·이모지 없앰
  let tab = 'gen';
  const TABS = [['gen', '일반'], ['game', '내전'], ['dc', '디스코드'], ['acct', '계정']];
  const tip = t => t ? ` title="${esc(t)}"` : '';
  const tog = (key, label, sub, more) => `<label class="tn-row"${tip(more)}><span class="tn-row-tx"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="tn-sw" data-k="${key}" ${S[key] ? 'checked' : ''}></label>`;
  const row = (label, sub, btn, cls, more) => `<div class="tn-row tn-row-act${cls ? ' ' + cls : ''}"${tip(more)}><span class="tn-row-tx"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>${btn || ''}</div>`;
  const grp = (title, body) => body ? `<div class="tn-sec">${title}</div><div class="tn-grp">${body}</div>` : '';
  function tabGen() {
    const [line, cls] = upLine();
    return `<div class="tn-ver"><div class="tn-ver-tx"><b>투데이 내전 <span class="num">v${esc(U.cur || '')}</span></b><small class="${cls}">${line}</small></div>
        ${U.state === 'ready' ? '<button class="ui-btn-gold tn-ver-go" data-act="up">지금 업데이트</button>'
          : `<button class="tn-btn" data-act="check" ${['checking', 'downloading', 'dev', 'installing'].includes(U.state) ? 'disabled' : ''}>업데이트 확인</button>`}</div>
      ${U.state === 'downloading' ? `<div class="tn-prog"><i style="width:${U.pct || 0}%"></i></div>` : ''}
      ${grp('소리', tog('sfxOn', '효과음', '선픽·픽·팟지 소리')
        + `<div class="tn-row tn-vol${S.sfxOn ? '' : ' off'}"><span class="tn-row-tx"><b>크기</b></span><input type="range" min="0" max="100" step="5" value="${Math.round(S.sfxVol * 100)}" class="tn-range" ${S.sfxOn ? '' : 'disabled'}><span class="tn-vol-n num">${Math.round(S.sfxVol * 100)}</span></div>`)}
      ${grp('창', tog('dock', '롤 클라이언트 옆에 붙이기', '끄면 창이 따로 떠 있습니다')
        + tog('sidePanel', '오른쪽 창 보이기', '홈·기록·프로필·증강')
        + tog('closeAsk', '✕ 누르면 숨길지 묻기', '끄면 묻지 않고 숨깁니다')
        + tog('autoLaunch', '윈도우 시작할 때 켜기', '트레이에 켜 두고 롤을 켜면 나타납니다')
        + row('왼쪽 창 켜기·끄기', '단축키', `<span class="tn-key num">${esc(S.hotkey)}</span>`))}
      <div class="tn-foot"><button class="tn-btn tn-tut" data-act="tut">사용법 다시 보기</button><button class="tn-quit" data-act="quit">완전히 종료</button></div>`;
  }
  function tabGame() {
    const mute = (S.chatMute || []).length;
    return grp('대기실 채팅', tog('chatFilter', '욕설 가리기', '욕설을 ●로 · 내 화면에서만')
        + (mute ? row(`말을 숨긴 사람 ${mute}명`, '채팅 줄 「숨기기」로 숨김', '<button class="tn-btn" data-act="unmute">다시 보기</button>') : ''))
      + grp('롤 클라이언트', tog('autoSeat', '팀 자리로 자동 이동', '롤 방에서 내 자리를 1팀·2팀으로',
          '팀이 정해지면 롤 사용자 설정 게임 방에서 내 자리를 1팀·2팀·관전석으로 옮깁니다(롤의 「팀 참가」 버튼과 같은 동작 · 내 자리만). 한 번 옮긴 뒤 직접 바꾸면 그대로 둡니다.')
        + tog('lolRemake', '롤 방 자동으로 만들기', '방장 · 팀이 정해지면 만들고 초대',
          '방장일 때 · 내전 팀이 정해지면 그 판 다리(드래프트 = 선픽이 아닌 팀장이 고름 · 나머지 = 무작위)로 롤 사용자 설정 방을 만들고(이미 있으면 다시 만듦) 그 판 사람 전원을 초대합니다. 큐 잡는 중이나 게임 중엔 건드리지 않습니다.')
        + tog('lolAutoAccept', '방장 초대 자동 수락', '방장이 롤 방을 다시 만들면 바로 들어감')
        + tog('lolPing', '롤 화면에서 핑', 'Alt + 끌기 · 방 사람에게 보임',
          '롤 클라이언트(게임 밖)에서 Alt + 왼쪽 버튼을 누른 채 끌면 핑 바퀴가 뜹니다. 방 사람 모두의 롤 화면 같은 자리에 보입니다. 그 Alt+클릭은 롤에 눌리지 않습니다. 끄면 롤의 Alt+클릭이 원래대로 동작합니다.'));
  }
  function tabDc() {
    const D = S.discord || null, on = !!(D && D.on), app = !!(D && D.app);
    const st = `<div class="tn-ver tn-dcst"><i class="tn-dc-dot${on ? ' on' : ''}"></i><div class="tn-ver-tx"><b>${on ? `연결됨 · ${esc(D.name || '디스코드')}` : app ? '디스코드 앱이 꺼져 있습니다' : '연결 준비 중'}</b><small>${on ? '이 PC의 디스코드 앱과 연결됐습니다' : app ? 'PC 디스코드 앱을 켜면 저절로 연결됩니다' : '디스코드 연동을 준비하고 있습니다'}</small></div></div>`;
    const room = D && D.room ? row(`이 방 · ${esc(D.room.name)}`, D.room.ch ? '내전 대기실 음성 채널' : '서버 초대 링크로 들어가기', `<button class="tn-btn" data-act="dcroom" ${D.room.ch || D.room.code ? '' : 'disabled'}>${D.room.ch ? '음성 채널 열기' : '들어가기'}</button>`) : '';
    const host = app ? row(D.guild ? `서버 · ${esc(D.guild)}` : '디스코드 서버', D.guild ? '팀이 정해지면 1팀·2팀 채널로' : '봇을 우리 서버에 넣고 연결', `<button class="tn-btn" data-act="dcgo" ${D.connecting ? 'disabled' : ''}>${D.connecting ? '고르는 중' : D.guild ? '바꾸기' : '서버 연결'}</button>`)
      + (invEdit ? `<div class="tn-row tn-row-act"><input class="tn-inv-in" placeholder="https://discord.gg/…  (비우면 지움)" value="${D.invite ? 'https://discord.gg/' + esc(D.invite) : ''}" maxlength="80"><button class="tn-btn" data-act="dcinvsave">저장</button></div>`
        : row('초대 링크', D.invite ? `discord.gg/${esc(D.invite)}` : '서버에 없는 방 사람에게 「들어가기」', `<button class="tn-btn" data-act="dcinv">${D.invite ? '바꾸기' : '넣기'}</button>`, '', D.invite ? '서버에 없는 방 사람에게 「들어가기」 버튼이 보입니다' : ''))
      + tog('discordMove', '음성 채널 자동 나누기', '팀이 정해지면 1팀·2팀 채널로',
          '내가 방장일 때 팀이 정해지면 디스코드 음성 채널 「1팀」「2팀」으로 옮기고, 게임이 끝나면 원래 채널로 모읍니다. 서버에 투데이 내전 봇과 「1팀」「2팀」 음성 채널이 있어야 하고, 음성 채널에 들어와 있고 디스코드 앱을 켠 사람만 옮깁니다.') : '';
    return st + grp('지금 방', room)
      + grp('내 디스코드', tog('discordRpc', '내 상태 보이기', '디스코드 프로필에 대기실·내전 중',
          '디스코드 프로필에 「투데이 내전 · 대기실 · 방 이름 · 6명 모임」처럼 지금 하고 있는 것을 보여 줍니다(디스코드 설정 「활동 상태」가 켜져 있어야 보입니다).'))
      + grp('방장일 때', host);
  }
  function tabAcct() {
    const P = S.pub, C = S.comm;
    return grp('커뮤니티 · 기록', (C ? row(`커뮤니티 · ${esc(C.name || '기본')}`, '바꾸면 앱이 다시 켜집니다', '<button class="tn-btn" data-act="comm">바꾸기</button>', '', '방·기록·순위가 이 커뮤니티 것만 보입니다') : '')
        + (P ? row(`기록 공개 · ${P.need ? '동의 안 함' : '동의함'}`, P.need ? '동의해야 내전에 참가할 수 있습니다' : `${pubDay(P.at)} 동의`, P.need ? '<button class="ui-btn-gold tn-ver-go" data-act="pubon">동의하기</button>' : '<button class="tn-btn" data-act="puboff">철회</button>', P.need ? 'tn-need' : '', P.need ? '지금은 보기만 할 수 있습니다' : '내 전적이 앱을 쓰는 다른 사람에게 보입니다') : ''))
      + grp('개인정보', row('개인정보 처리방침', '저장하는 것·보관 기간·지우는 방법', '<button class="tn-btn" data-act="privacy">보기</button>')
        + row('내 정보 지우기', '서버의 내 계정·디스코드·전적 점수', '<button class="tn-btn tn-danger" data-act="wipe">지우기</button>'))
      + `<p class="tn-legal">Today In-House isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>`;
  }
  function renderPanel() {
    if (!ui || panel.style.display === 'none') return;
    const keep = panel.querySelector('.tn-set-body'), top = keep && keep.dataset.tab === tab ? keep.scrollTop : 0;
    const body = { gen: tabGen, game: tabGame, dc: tabDc, acct: tabAcct }[tab] || tabGen;
    const dot = { gen: U.state === 'ready', acct: !!(S.pub && S.pub.need) };
    panel.innerHTML = `<div class="tn-set-hd"><span class="tn-set-en">SETTINGS</span><b>설정</b><button class="tn-set-x" title="닫기">✕</button></div>
      <div class="tn-tabs">${TABS.map(([k, n]) => `<button class="tn-tab${k === tab ? ' on' : ''}" data-tab="${k}">${n}${dot[k] ? '<i class="tn-tab-dot"></i>' : ''}</button>`).join('')}</div>
      <div class="tn-set-body ui-scroll" data-tab="${tab}">${body()}</div>`;
    panel.querySelector('.tn-set-body').scrollTop = top;
    panel.querySelectorAll('.tn-tab').forEach(t => t.onclick = () => { if (tab !== t.dataset.tab) { tab = t.dataset.tab; invEdit = false; renderPanel(); } });
    panel.querySelector('.tn-set-x').onclick = closePanel;
    panel.querySelectorAll('.tn-sw').forEach(c => c.onchange = async () => { api.setSetting(c.dataset.k, c.checked).then(v => { if (v) { S = v; applyVol(); renderPanel(); } }); });
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
      else if (b.dataset.act === 'dcgo' && api.discordConnect) api.discordConnect().then(r => { if (r && !r.ok && r.err) tnAlert('디스코드 서버 연결 · ' + r.err); else if (r && r.ok && r.lack && r.lack.length) tnAlert(`연결됐습니다 · 서버에 음성 채널 ${r.lack.join('·')}을 만들어 주세요`); }).catch(() => {});
      else if (b.dataset.act === 'unmute' && api.chatMute) api.chatMute(null, false).then(v => { if (v) { S = v; renderPanel(); } });
      else if (b.dataset.act === 'comm' && api.communityJoin) tnPrompt('운영진에게 받은 초대 코드를 넣어 주세요. 비워 두면 기본 커뮤니티로 돌아갑니다.', { title: '커뮤니티 바꾸기', placeholder: '초대 코드(비우면 기본)', ok: '바꾸기', max: 12, allowEmpty: true }).then(v => { if (v === null || v === undefined) return; api.communityJoin(v).then(r => { if (!r || !r.ok) tnAlert((r && r.err) || '바꾸지 못했습니다'); else if (r.restart) tnAlert(`${r.community ? r.community.name : '기본'} 커뮤니티로 바꿉니다. 앱이 다시 켜집니다.`); }).catch(() => {}); });
      else if (b.dataset.act === 'pubon' && api.pubSet) tnPubAsk().then(y => { if (y) api.pubSet(true).catch(() => {}); });
      else if (b.dataset.act === 'puboff' && api.pubSet) tnConfirm('내전 기록 공개 동의를 철회할까요?\n\n철회하면 내 프로필·순위가 다른 사람에게 안 보이고, 내전에는 참가할 수 없습니다(보기만).\n지금 방에 있으면 방에서 나갑니다. 언제든 다시 동의할 수 있습니다.', { ok: '철회', danger: true }).then(y => { if (y) api.pubSet(false).catch(() => {}); });
      else if (b.dataset.act === 'privacy' && api.openPrivacy) api.openPrivacy();
      else if (b.dataset.act === 'wipe' && api.privacyWipe) tnConfirm('서버에 있는 내 정보를 지우고 앱을 끕니다.\n\n지우는 것: 디스코드 연결 · 계정(이름#태그·아이콘) · 전적 점수 · 접속 표시 · 지금 방의 내 칸\n남는 것: 같이 한 경기 기록(다른 사람 기록이기도 해서 · 이름 지우기는 처리방침의 방법으로 요청)\n\n앱을 다시 켜고 롤에 로그인하면 계정·접속 표시는 다시 생깁니다. 완전히 그만두려면 지운 뒤 앱을 삭제해 주세요.', { title: '내 정보 지우기', ok: '지우고 끄기', danger: true }).then(y => { if (!y) return; api.privacyWipe().then(r => { if (r && r.ok) tnAlert('지웠습니다. 잠시 뒤 앱이 꺼집니다.'); else tnAlert((r && r.err) || '지우지 못했습니다'); }); });
      else if (b.dataset.act === 'quit') tnConfirm('투데이 내전을 완전히 종료할까요?', { ok: '종료', danger: true }).then(y => { if (y) api.quitApp(); });
    });
  }
  window.tnSettingsOpen = (t) => { if (!ui) return; if (t) { tab = t; invEdit = false; } if (panel.style.display === 'none') openPanel(); else renderPanel(); };   // v0.1.269 바깥(대기실 「초대 링크」·사용법)에서 그 탭으로 열기
  function openPanel() { const r = (strip.style.display === 'none' ? header : strip).getBoundingClientRect(); panel.style.top = Math.round(r.bottom) + 'px'; panel.style.display = ''; gear.classList.add('on'); renderPanel(); api.getSettings().then(v => { if (v) { S = v; renderPanel(); } }).catch(() => {}); if (U.state === 'idle' || U.state === 'error') api.checkUpdate(); }
  function closePanel() { if (!ui) return; panel.style.display = 'none'; gear.classList.remove('on'); }
  api.getSettings().then(v => { if (v) { S = v; applyVol(); renderPanel(); } }).catch(() => {});
  api.onSettings(v => { S = v; applyVol(); renderPanel(); });
  if (api.getUpdate) api.getUpdate().then(u => { if (u) { U = u; renderStrip(); renderPanel(); } }).catch(() => {});
  if (api.onUpdate) api.onUpdate(u => { const was = U.state; U = u; if (u.state === 'ready' && was !== 'ready') hideStrip = false; renderStrip(); renderPanel(); });
})();
