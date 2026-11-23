// 🏠 홈 화면(v0.1.127) — 롤 클라 없이 투데이 내전만 켰을 때 한 창 · 게스트는 보기만 · 게임 시작 때는 로고만
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _last = '';

function render(d) {
  if (!d) return;
  const sig = JSON.stringify(d); if (sig === _last) return; _last = sig;   // 같은 내용이면 다시 안 그림
  document.body.classList.toggle('logo', d.mode === 'logo');
  $('h-ver').textContent = d.ver ? 'v' + d.ver : '';
  // 🎬 v0.1.177 게임 시작 화면 — 내전(팀이 짜인 판) = 포스터 · 그 밖 = 제목 카드 · 날짜 = 오늘(새벽 6시 기준 day) · 내전이면 오늘 몇 번째 판
  if (d.mode === 'logo') {
    const mt = d.match || null;
    document.body.classList.toggle('lgp', !!mt); document.body.classList.toggle('lgc', !mt);
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(d.day || '');
    $('lg-date').textContent = m ? `${m[1]} . ${m[2]} . ${m[3]}  ${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(+m[1], +m[2] - 1, +m[3]).getDay()]}` : '';
    $('lg-gotx').textContent = mt && mt.n ? `GAME ${mt.n} · START` : 'GAME START';
  }
  // 나
  const me = $('me');
  me.classList.toggle('guest', !d.me);
  // 🚀 v0.1.227 롤 로그인 전(처음 켠 사람이 가장 먼저 보는 화면) = 「게스트」 한 줄 대신 시작하는 법 3단계 + 「롤 클라이언트 켜기」
  //   예전엔 맨 아래 작은 회색 글(「롤 클라이언트를 켜고 로그인하면…」)이 유일한 안내라 무엇을 해야 하는지 안 보였음
  const st = d.start || {};
  me.classList.toggle('start', !d.me);
  me.innerHTML = d.me
    ? `<i class="dot"></i><span><b>${esc(d.me.name)}</b> <span class="tag">#${esc(d.me.tag)}</span></span><span class="st">${d.room ? `「${esc(d.room.name)}」에 들어가 있음` : '롤 클라이언트가 내려가 있습니다'}</span>`
    : `<div class="st-tx"><span class="col-en">START</span><b>롤 클라이언트에 로그인하면 시작됩니다</b>
        <ol class="st-steps"><li class="now"><i>1</i><span><b>롤 로그인</b><small>그 계정으로 자동 입장</small></span></li>
          <li><i>2</i><span><b>방 들어가기 · 만들기</b><small>만든 사람이 방장</small></span></li>
          <li><i>3</i><span><b>방장이 게임 시작</b><small>기록 · 투표 · 하이라이트 자동</small></span></li></ol></div>
       <div class="st-act">${st.launching ? '<button class="ui-btn-gold" disabled>롤 클라이언트를 켜는 중</button>'
        : st.launch ? '<button class="ui-btn-gold" id="st-go">롤 클라이언트 켜기</button>'
        : `<span class="st-wait"><i></i>${st.lol === 'login' ? '롤 계정을 확인하는 중' : '롤 로그인을 기다리는 중'}</span>`}</div>`;
  const sg = $('st-go'); if (sg) sg.onclick = () => { sg.disabled = true; window.api.lolLaunch().then(r => { if (r && !r.ok && r.err) { sg.disabled = false; sg.textContent = r.err; } }).catch(() => { sg.disabled = false; }); };
  // 방 목록 — 롤 로그인한 사람이 방 밖이면 여기서 바로 들어가거나 만듦(대기실 창이 열림 · v0.1.227)
  const rooms = d.rooms || [], canJoin = !!d.me && !d.room;
  $('rooms-n').textContent = rooms.length ? rooms.length : '';
  if (d.ban) {   // 🚫 v0.1.244 운영 정지
    const B = d.ban, dt = new Date(B.until), when = B.perm ? '기간 없이 정지되었습니다' : `${dt.getMonth() + 1}월 ${dt.getDate()}일 ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}에 풀립니다`;
    $('rooms-n').textContent = '';
    $('rooms').innerHTML = `<div class="empty ban">이용이 정지되었습니다<small>${B.reason ? '사유 · ' + esc(B.reason) + ' · ' : ''}${when}</small></div>`;
  } else
  $('rooms').innerHTML = !d.ready ? `<div class="empty">${d.slow ? '서버에 연결하지 못했습니다<small>인터넷 연결을 확인해 주세요 · 연결되면 자동으로 이어집니다</small>' : '방 목록을 불러오는 중입니다'}</div>`
    : rooms.length ? rooms.map(r => `<div class="rm${r.mine ? ' mine' : ''}${canJoin ? ' go' : ''}"${canJoin ? ` data-rid="${esc(r.id)}"` : ''}>
        <div class="rm-top"><span class="rm-nm">${esc(r.name)}</span>${r.mine ? '<span class="rm-tag me">내 방</span>' : ''}${r.priv ? '<span class="rm-tag">비공개</span>' : ''}<span class="rm-n"><b>${r.n}</b>/10</span>${canJoin ? '<button class="rm-join">들어가기</button>' : ''}</div>
        <div class="rm-mem">${(r.members || []).length ? (r.members || []).map(m => `<span>${esc(m)}</span>`).join(' · ') : '아직 아무도 없습니다'}</div>
      </div>`).join('')
    : `<div class="empty">아직 만들어진 방이 없습니다${canJoin ? '<button class="ui-btn-gold" id="rm-make">방 만들기</button>' : ''}</div>`;
  $('rooms').querySelectorAll('.rm.go').forEach(el => el.onclick = () => window.api.homeJoin(el.dataset.rid));
  const mk = $('rm-make'); if (mk) mk.onclick = () => window.api.homeJoin('+new');
  // 접속 중(앱 켠 사람 전체)
  const on = d.online || [];
  $('online-n').textContent = on.length;
  $('online').innerHTML = on.map(p => `<div class="on${p.guest ? ' guest' : ''}"><i class="dot"></i>
      <span class="nm">${esc(p.name)}${p.tag ? `<small>#${esc(p.tag)}</small>` : ''}</span>
      ${p.me ? '<span class="me-tag">나</span>' : `<span class="where">${p.room ? esc(p.room) : (p.guest ? '' : '방 밖')}</span>`}
    </div>`).join('');
  // 아래 줄
  $('foot').innerHTML = d.me
    ? `<span>롤 클라이언트를 켜면 창이 좌우로 붙습니다.</span><button class="ui-btn-ghost" id="f-panels">대기실 창 열기</button>`
    : `<span>지금은 게스트입니다. 방 목록과 접속 중인 사람만 보입니다.</span><button class="ui-btn-ghost" id="f-tut">사용법 둘러보기</button>`;   // 🧭 v0.1.228 롤을 켜기 전에도 예시 화면으로 따라 해 봄(왼쪽 창이 이 창 위에 뜸)
  const ft = $('f-tut'); if (ft) ft.onclick = () => window.api.openTutorial();
  const fp = $('f-panels'); if (fp) fp.onclick = () => window.api.homePanels();
}

// 처음 나타날 때·게임 시작 로고 = 한 번만 움직임(무한 애니메이션 없음)
function intro(mode) {
  if (mode === 'plain') return;   // v0.1.165 합쳐진 창에서 이어질 때 = 차례로 나타나는 연출 없이 한 번에(왼쪽 먼저·오른쪽 나중에 보이던 것)
  if (mode === 'zip') {   // 🤐 v0.1.167 좌우 창이 그린 지퍼 테두리를 그대로 이어받아(상자 하나) 천천히 평소 테두리로 가라앉음 · 내용은 한 번에
    document.querySelectorAll('.h-zip').forEach(e => e.remove());
    const z = document.createElement('i'); z.className = 'h-zip'; document.body.appendChild(z);
    z.animate([{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' }).onfinish = () => z.remove();
    return;
  }
  const E = 'cubic-bezier(.2,.8,.2,1)';
  const pop = (el, d, dy) => el && el.animate([{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: d, easing: E, fill: 'both' });
  if (mode === 'logo') {   // 문이 맞닿은 가운데 이음선이 위아래로 그어짐 → 선이 옅어지며 그 자리에서 로고가 피어남
    document.querySelector('.seam').animate([{ opacity: .9, transform: 'scaleY(0)' }, { opacity: .9, transform: 'scaleY(1)', offset: .45 }, { opacity: 0, transform: 'scaleY(1)' }], { duration: 760, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    // v0.1.177 글자 중심(전부 한 번만 · 번쩍임·흔들림 없음): 이음선 → 좌우 팀 빛 → (포스터) 큰 윤곽 글자가 자간을 좁히며 자리 잡음 / (카드) 위아래 금색 선이 가운데서 벌어짐 → 제목 → 날짜 → GAME START 양옆 선
    document.querySelector('.lg-bg').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 620, delay: 140, easing: 'ease-out', fill: 'both' });
    $('lg-big').animate([{ opacity: 0, letterSpacing: '.16em', transform: 'skewX(-8deg) scale(1.05)' }, { opacity: 1, letterSpacing: '.02em', transform: 'skewX(-8deg) scale(1)' }], { duration: 760, delay: 180, easing: E, fill: 'both' });
    document.querySelectorAll('.lg-ln').forEach(e => e.animate([{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 560, delay: 200, easing: E, fill: 'both' }));
    pop($('lg-en'), 340, 8); pop($('lg-ko'), 380, 14); pop($('lg-date'), 520, 8); pop($('lg-go'), 640, 6);
    for (const [el, o] of [[$('lg-go').firstElementChild, '100% 50%'], [$('lg-go').lastElementChild, '0% 50%']]) { el.style.transformOrigin = o; el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 420, delay: 740, easing: E, fill: 'both' }); }
    return;
  }
  $('hero').querySelector('.mk').animate([{ opacity: 0, transform: 'rotate(-30deg) scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: E, fill: 'both' });
  pop(document.querySelector('.tt'), 80, 10); pop($('me'), 200, 10); pop($('c-rooms'), 280, 14); pop($('c-online'), 360, 14); pop($('foot'), 440, 6);
}

$('h-min').onclick = () => window.api.homeMin();
$('h-close').onclick = () => window.api.homeClose();
window.api.onHome(render);
window.api.onHomeIntro(intro);
window.api.getHome().then(render);
