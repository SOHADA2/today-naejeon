// ⚙️ 설정 · 🔄 업데이트 · 버전 (v0.1.39) — 왼쪽(overlay)·오른쪽(sidepanel) 창이 같이 씀 · 팟지 창은 효과음 크기만
//  창 머리에 ⚙ 버튼(최소화 버튼 왼쪽) → 창 안에 설정 화면(버전·업데이트 / 효과음 / 창 / 단축키 / 종료)
//  업데이트가 준비되면 머리 바로 아래 금색 알림 줄 + ⚙에 점 (전엔 오른쪽 아래 따로 뜨는 창이라 게임 중에도 튀어나왔음)
//  효과음 크기 = window.__tnVol (0~1) — 각 화면의 효과음이 재생할 때 곱함
(function () {
  const api = window.api; if (!api || !api.getSettings) return;
  const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let S = { ingame: false, sfxOn: true, sfxVol: 1, dock: true, sidePanel: true, closeAsk: true, hotkey: 'Shift+F7' }, U = { state: 'idle' }, hideStrip = false;
  const applyVol = () => { window.__tnVol = S.sfxOn ? S.sfxVol : 0; };
  applyVol();
  const header = document.querySelector('#bar, #sbar'), minBtn = document.querySelector('#ov-min, #s-min');
  const ui = !!(header && minBtn);
  let gear, strip, panel;
  if (ui) {
    gear = $(`<button class="tn-gear ${minBtn.className}" title="설정 · 버전·업데이트"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M9.44 4.53L9.57 1.89A10.4 10.4 0 0 1 14.43 1.89L14.56 4.53A7.9 7.9 0 0 1 15.48 4.91L15.48 4.91L17.43 3.13A10.4 10.4 0 0 1 20.87 6.57L19.09 8.52A7.9 7.9 0 0 1 19.47 9.44L19.47 9.44L22.11 9.57A10.4 10.4 0 0 1 22.11 14.43L19.47 14.56A7.9 7.9 0 0 1 19.09 15.48L19.09 15.48L20.87 17.43A10.4 10.4 0 0 1 17.43 20.87L15.48 19.09A7.9 7.9 0 0 1 14.56 19.47L14.56 19.47L14.43 22.11A10.4 10.4 0 0 1 9.57 22.11L9.44 19.47A7.9 7.9 0 0 1 8.52 19.09L8.52 19.09L6.57 20.87A10.4 10.4 0 0 1 3.13 17.43L4.91 15.48A7.9 7.9 0 0 1 4.53 14.56L4.53 14.56L1.89 14.43A10.4 10.4 0 0 1 1.89 9.57L4.53 9.44A7.9 7.9 0 0 1 4.91 8.52L4.91 8.52L3.13 6.57A10.4 10.4 0 0 1 6.57 3.13L8.52 4.91A7.9 7.9 0 0 1 9.44 4.53Z M15.3 12A3.3 3.3 0 1 0 8.7 12A3.3 3.3 0 1 0 15.3 12Z" fill="currentColor"/></svg><i class="tn-gear-dot"></i></button>`);
    header.insertBefore(gear, minBtn);
    strip = $(`<div class="tn-upstrip" style="display:none;"><span class="tn-up-tx"></span><button class="tn-up-go">지금 업데이트</button><button class="tn-up-x" title="닫기(설정 ⚙에서 다시 볼 수 있어요)">✕</button></div>`);
    header.insertAdjacentElement('afterend', strip);
    panel = $(`<div class="tn-set" style="display:none;"></div>`);
    document.body.appendChild(panel);
    gear.onclick = (e) => { e.stopPropagation(); panel.style.display === 'none' ? openPanel() : closePanel(); };
    strip.querySelector('.tn-up-go').onclick = updateNow;
    strip.querySelector('.tn-up-x').onclick = () => { hideStrip = true; renderStrip(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  }
  function updateNow() { if (confirm('지금 업데이트할까요?\n투데이 내전이 잠깐 꺼졌다가 새 버전으로 다시 켜져요.')) api.updateNow(); }
  const upLine = () => ({
    ready: [`새 버전 <b>v${esc(U.version)}</b> 준비됨`, 'gold'], downloading: [`새 버전 v${esc(U.version || '')} 받는 중 · ${U.pct || 0}%`, ''], checking: ['새 버전 확인 중…', ''],
    latest: ['최신 버전이에요', 'ok'], error: ['업데이트를 확인하지 못했어요', 'err'], dev: ['개발 실행(자동 업데이트 꺼짐)', ''], idle: ['', ''],
  }[U.state] || ['', '']);
  function renderStrip() {
    if (!ui) return;
    const ready = U.state === 'ready';
    gear.classList.toggle('has-up', ready);
    strip.style.display = ready && !hideStrip ? '' : 'none';
    if (ready) strip.querySelector('.tn-up-tx').innerHTML = `<span>🔄 새 버전 <b>v${esc(U.version)}</b> 준비됨</span><small>재시작하면 바로 적용돼요</small>`;
  }
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
        <div class="tn-sec">게임 중</div>
        ${tog('ingame', '게임 중 정보 창 <span class=\"tn-tip\" data-tip=\"켜면 챔피언 선택 때 롤 화면 모드를 「테두리 없는 창」으로 바꾸고 게임이 끝나면 원래대로 돌려요(전체 화면이면 어떤 창도 게임 위에 못 떠요). 다음 판부터 적용 · 게임 중 Shift+F7로 숨기기\">ⓘ</span>', '양 팀 아이템 골드·킬 · 테두리 없는 창으로')}
        <div class="tn-sec">창</div>
        ${tog('dock', '롤 클라이언트 옆에 붙이기', '끄면 두 창이 따로 떠 있어요')}
        ${tog('sidePanel', '오른쪽 창 보이기', '진행·오늘·프로필')}
        ${tog('closeAsk', '✕ 누르면 「숨기기/종료」 묻기', '끄면 묻지 않고 숨기기만')}
        <div class="tn-sec">단축키</div>
        <div class="tn-row"><span class="tn-row-tx"><b>왼쪽 창 켜기/끄기</b><small>게임 중엔 정보 창</small></span><span class="tn-key num">${esc(S.hotkey)}</span></div>
        <button class="tn-quit" data-act="quit">투데이 내전 완전히 종료</button>
      </div>`;
    panel.querySelector('.tn-set-x').onclick = closePanel;
    panel.querySelectorAll('.tn-sw').forEach(c => c.onchange = () => api.setSetting(c.dataset.k, c.checked).then(v => { if (v) { S = v; applyVol(); renderPanel(); } }));
    const r = panel.querySelector('.tn-range'), n = panel.querySelector('.tn-vol-n');
    if (r) { r.oninput = () => { n.textContent = r.value; S.sfxVol = r.value / 100; applyVol(); }; r.onchange = () => api.setSetting('sfxVol', r.value / 100); }
    panel.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      if (b.dataset.act === 'up') updateNow();
      else if (b.dataset.act === 'check') api.checkUpdate();
      else if (b.dataset.act === 'quit' && confirm('투데이 내전을 완전히 종료할까요?')) api.quitApp();
    });
  }
  function openPanel() { const r = (strip.style.display === 'none' ? header : strip).getBoundingClientRect(); panel.style.top = Math.round(r.bottom) + 'px'; panel.style.display = ''; gear.classList.add('on'); renderPanel(); if (U.state === 'idle' || U.state === 'error') api.checkUpdate(); }
  function closePanel() { if (!ui) return; panel.style.display = 'none'; gear.classList.remove('on'); }
  api.getSettings().then(v => { if (v) { S = v; applyVol(); renderPanel(); } }).catch(() => {});
  api.onSettings(v => { S = v; applyVol(); renderPanel(); });
  if (api.getUpdate) api.getUpdate().then(u => { if (u) { U = u; renderStrip(); renderPanel(); } }).catch(() => {});
  if (api.onUpdate) api.onUpdate(u => { const was = U.state; U = u; if (u.state === 'ready' && was !== 'ready') hideStrip = false; renderStrip(); renderPanel(); });
})();
