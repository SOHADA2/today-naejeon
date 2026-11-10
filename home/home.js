// 🏠 홈 화면(v0.1.127) — 롤 클라 없이 투데이 내전만 켰을 때 한 창 · 게스트는 보기만 · 게임 시작 때는 로고만
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _last = '';

function render(d) {
  if (!d) return;
  const sig = JSON.stringify(d); if (sig === _last) return; _last = sig;   // 같은 내용이면 다시 안 그림
  document.body.classList.toggle('logo', d.mode === 'logo');
  $('h-ver').textContent = d.ver ? 'v' + d.ver : '';
  // 나
  const me = $('me');
  me.classList.toggle('guest', !d.me);
  me.innerHTML = d.me
    ? `<i class="dot"></i><span><b>${esc(d.me.name)}</b> <span class="tag">#${esc(d.me.tag)}</span></span><span class="st">${d.room ? `「${esc(d.room.name)}」에 들어가 있음` : '롤 클라이언트가 내려가 있습니다'}</span>`
    : `<i class="dot"></i><span><b>게스트</b></span><span class="st">롤에 로그인하면 그 계정으로 바뀝니다</span>`;
  // 방 목록
  const rooms = d.rooms || [];
  $('rooms-n').textContent = rooms.length ? rooms.length : '';
  $('rooms').innerHTML = !d.ready ? `<div class="empty">방 목록을 불러오는 중입니다</div>`
    : rooms.length ? rooms.map(r => `<div class="rm${r.mine ? ' mine' : ''}">
        <div class="rm-top"><span class="rm-nm">${esc(r.name)}</span>${r.mine ? '<span class="rm-tag me">내 방</span>' : ''}${r.priv ? '<span class="rm-tag">비공개</span>' : ''}<span class="rm-n"><b>${r.n}</b>/10</span></div>
        <div class="rm-mem">${(r.members || []).length ? (r.members || []).map(m => `<span>${esc(m)}</span>`).join(' · ') : '아직 아무도 없습니다'}</div>
      </div>`).join('')
    : `<div class="empty">아직 만들어진 방이 없습니다</div>`;
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
    : `<span>게스트는 보기만 할 수 있습니다. 롤 클라이언트를 켜고 로그인하면 방에 들어갈 수 있습니다.</span>`;
  const fp = $('f-panels'); if (fp) fp.onclick = () => window.api.homePanels();
}

// 처음 나타날 때·게임 시작 로고 = 한 번만 움직임(무한 애니메이션 없음)
function intro(mode) {
  const E = 'cubic-bezier(.2,.8,.2,1)';
  const pop = (el, d, dy) => el && el.animate([{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: d, easing: E, fill: 'both' });
  if (mode === 'logo') {   // 문이 맞닿은 가운데 이음선이 위아래로 그어짐 → 선이 옅어지며 그 자리에서 로고가 피어남
    document.querySelector('.seam').animate([{ opacity: .9, transform: 'scaleY(0)' }, { opacity: .9, transform: 'scaleY(1)', offset: .45 }, { opacity: 0, transform: 'scaleY(1)' }], { duration: 760, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    $('hero').querySelector('.mk').animate([{ opacity: 0, transform: 'scale(.6)', filter: 'brightness(1.6)' }, { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 560, delay: 260, easing: E, fill: 'both' });
    pop(document.querySelector('.tt'), 420, 10); pop($('go'), 560, 6);
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
