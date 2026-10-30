// My page — DIY 데스크. 위젯을 골라 넣고(추가 · 삭제 · 순서 바꾸기) 구성은 localStorage['il.diy']에 둔다.
// 기본 위젯: 시황(market_snapshot) · 퀀트 스튜디오(themes) · 실적발표(global_quotes). 숫자는 모두 Supabase 값 그대로.
(function () {
  'use strict';
  var s = IL.session() || {};
  var KEY = 'il.diy', DEFAULT = ['market', 'quant', 'earnings'];
  var STATE = { Leadership: '주도', Acceleration: '가속', Emerging: '부상', Crowded: '과열 주의', Cooling: '둔화', Reversal: '반전 시도' };
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var dot = function (d) { return String(d || '').slice(5, 10).replace('-', '.'); };
  var tone = function (v) { var t = String(v == null ? '' : v).trim(); return t.charAt(0) === '-' ? 'down' : t.charAt(0) === '+' ? 'up' : ''; };
  var none = function (msg) { return '<p class="mp-empty">' + (msg || '데이터를 불러오지 못했어요.') + '</p>'; };
  var q = function (pr) { return Promise.resolve(pr).then(function (r) { return r && r.data; }, function () { return null; }); };

  /* ---------- 위젯 목록 ---------- */
  var W = {
    market: { title: '시황', sub: '국내 증시 스냅샷', href: 'today.html', go: '오늘의 시황',
      load: function () {
        return q(sb.from('market_snapshot').select('*').order('snapshot_date', { ascending: false }).limit(1)).then(function (r) {
          var m = r && r[0]; if (!m) return none();
          var tile = function (k, v, c) { return '<div class="mp-tile"><span>' + k + '</span><b>' + esc(v || '-') + '</b><em class="' + tone(c) + '">' + esc(c || '') + '</em></div>'; };
          var flow = function (k, v) { return '<li><span>' + k + '</span><b class="' + tone(v) + '">' + esc(v || '-') + '</b></li>'; };
          return '<p class="mp-asof">' + esc(String(m.snapshot_date).replace(/-/g, '.')) + ' 기준</p>' +
            '<div class="mp-tiles">' + tile('KOSPI', m.kospi, m.kospi_chg) + tile('KOSDAQ', m.kosdaq, m.kosdaq_chg) + tile('원/달러', m.usdkrw, m.usdkrw_chg) + '</div>' +
            '<ul class="mp-flow">' + flow('외국인', m.foreign_net) + flow('기관', m.inst_net) + flow('개인', m.retail_net) + '</ul>' +
            ((m.strong_sectors || []).length ? '<p class="mp-k">강세 업종</p><div class="mp-chips">' + m.strong_sectors.slice(0, 4).map(function (x) {
              return '<span class="mp-chip">' + esc(x.name) + ' <b class="' + tone(x.chg) + '">' + esc(x.chg) + '</b></span>'; }).join('') + '</div>' : '');
        });
      } },
    quant: { title: '퀀트 스튜디오', sub: '테마 로테이션 · 자금 집중도 상위', href: 'quant.html', go: '퀀트 스튜디오',
      load: function () {
        return q(sb.from('themes').select('name,state,ret_1m,concentration,week_of').order('week_of', { ascending: false }).order('concentration', { ascending: false }).limit(60)).then(function (r) {
          if (!r || !r.length) return none();
          var wk = r[0].week_of, rows = r.filter(function (x) { return x.week_of === wk; }).slice(0, 5);
          return '<p class="mp-asof">' + esc(String(wk).replace(/-/g, '.')) + ' 주간 기준</p><ol class="mp-rank">' + rows.map(function (x) {
            return '<li><b>' + esc(x.name) + '</b><span class="mp-state">' + esc(STATE[x.state] || x.state || '-') + '</span><span class="mp-meta"><span class="mp-num">자금 집중도 ' + fmt(x.concentration, 1) + '</span><span class="mp-num ' + dirCls(x.ret_1m) + '">1개월 ' + sign(x.ret_1m, 1) + '</span></span></li>';
          }).join('') + '</ol>';
        });
      } },
    earnings: { title: '실적발표', sub: '해외 주요 종목 · 다가오는 발표와 최근 결과', href: 'today.html?region=global#stock-events', go: '실적 일정 전체',
      load: function () {
        return q(sb.from('global_quotes').select('ticker,name,next_earnings_date,last_earnings_date,eps,eps_estimate,eps_surprise').limit(500)).then(function (r) {
          if (!r || !r.length) return none();
          var t = iso(today), past = new Date(today); past.setDate(past.getDate() - 60);
          var up = r.filter(function (x) { return x.next_earnings_date && x.next_earnings_date >= t; }).sort(function (a, b) { return a.next_earnings_date.localeCompare(b.next_earnings_date); }).slice(0, 4);
          var done = r.filter(function (x) { return x.last_earnings_date && x.last_earnings_date >= iso(past) && x.eps_surprise != null; }).sort(function (a, b) { return b.last_earnings_date.localeCompare(a.last_earnings_date); }).slice(0, 3);
          var dday = function (d) { var n = Math.round((new Date(d) - today) / 864e5); return n === 0 ? '오늘' : 'D-' + n; };
          return '<p class="mp-k">다가오는 발표</p><ul class="mp-list">' + (up.length ? up.map(function (x) {
              return '<li><span class="mp-date">' + dot(x.next_earnings_date) + '</span><b>' + esc(x.name || x.ticker) + '</b><span class="mp-tk">' + esc(x.ticker) + '</span><span class="mp-dd">' + dday(x.next_earnings_date) + '</span></li>';
            }).join('') : '<li class="mp-empty">예정된 발표가 없어요.</li>') + '</ul>' +
            (done.length ? '<p class="mp-k">최근 결과 · EPS 서프라이즈</p><ul class="mp-list">' + done.map(function (x) {
              return '<li><span class="mp-date">' + dot(x.last_earnings_date) + '</span><b>' + esc(x.name || x.ticker) + '</b><span class="mp-tk">' + esc(x.ticker) + '</span><span class="mp-num ' + dirCls(x.eps_surprise) + '">' + sign(x.eps_surprise, 1) + '</span></li>';
            }).join('') + '</ul>' : '');
        });
      } },
    reports: { title: '최신 리포트', sub: '리서치센터 발간 순', href: 'reports.html', go: '리포트 전체',
      load: function () {
        return q(sb.from('reports').select('id,title,category,published_at').order('published_at', { ascending: false }).limit(5)).then(function (r) {
          if (!r || !r.length) return none();
          return '<ul class="mp-list mp-list--rep">' + r.map(function (x) {
            return '<li><a href="reports.html?id=' + encodeURIComponent(x.id) + '"><b>' + esc(x.title) + '</b><span>' + esc(x.category || '') + ' · ' + esc(String(x.published_at || '').slice(0, 10).replace(/-/g, '.')) + '</span></a></li>';
          }).join('') + '</ul>';
        });
      } },
    questions: { title: '내가 한 질문', sub: 'Home 근거형 Q&A 기록', href: 'home.html', go: '질문하기',
      load: function () {
        var l = []; try { l = JSON.parse(localStorage.getItem('il.home-questions') || '[]'); } catch (e) {}
        return Promise.resolve(l.length ? '<ul class="mp-list mp-list--rep">' + l.slice(0, 5).map(function (x) {
          return '<li><a href="home.html?q=' + encodeURIComponent(x.q) + '"><b>Q. ' + esc(x.q) + '</b><span>다시 보기</span></a></li>';
        }).join('') + '</ul>' : none('아직 물어본 질문이 없어요.'));
      } }
  };

  /* ---------- 구성 저장 ---------- */
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(v)) return v.filter(function (k) { return W[k]; }); } catch (e) {}
    return DEFAULT.slice();
  }
  function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} }
  var list = read(), editing = false;

  /* ---------- 그리기 ---------- */
  var grid = $('#mp-grid');
  var sectors = (s.profile && s.profile.sectors) || [];
  $('#mp-who').innerHTML = '<span class="avatar" aria-hidden="true">' + esc((s.name || '고객').charAt(0)) + '</span><div><b>' + esc(s.name || '고객') + '님의 데스크</b><span>' +
    esc([s.org || s.branch, s.cust_type].filter(Boolean).join(' · ') || '시연 계정') + (sectors.length ? ' · 관심 ' + esc(sectors.slice(0, 3).join(' · ')) : '') + '</span></div>';

  function render() {
    grid.classList.toggle('is-editing', editing);
    grid.innerHTML = list.length ? list.map(function (k, i) {
      var w = W[k];
      return '<article class="card mp-w" data-w="' + k + '"><div class="mp-w__h"><div><h3>' + w.title + '</h3><span>' + w.sub + '</span></div>' +
        '<div class="mp-w__ed"><button type="button" data-move="-1" aria-label="' + w.title + ' 앞으로"' + (i ? '' : ' disabled') + '>←</button>' +
        '<button type="button" data-move="1" aria-label="' + w.title + ' 뒤로"' + (i < list.length - 1 ? '' : ' disabled') + '>→</button>' +
        '<button type="button" data-del aria-label="' + w.title + ' 빼기">✕</button></div></div>' +
        '<div class="mp-w__b"><p class="mp-empty">불러오는 중…</p></div>' +
        '<a class="mp-w__go" href="' + w.href + '">' + w.go + ' →</a></article>';
    }).join('') : '<div class="mp-blank">위젯이 없어요. <b>DIY 편집</b>에서 원하는 위젯을 넣어 보세요.</div>';
    list.forEach(function (k) {
      var body = grid.querySelector('[data-w="' + k + '"] .mp-w__b');
      if (k !== 'questions' && !window.sb) { body.innerHTML = none('데이터에 연결할 수 없어요.'); return; }
      W[k].load().then(function (h) { body.innerHTML = h; }, function () { body.innerHTML = none(); });
    });
    $('#mp-add-list').innerHTML = Object.keys(W).filter(function (k) { return list.indexOf(k) < 0; }).map(function (k) {
      return '<button type="button" class="chip" data-add="' + k + '">+ ' + W[k].title + '</button>';
    }).join('') || '<span class="mp-empty">모든 위젯을 넣었어요.</span>';
  }

  $('#mp-edit').addEventListener('click', function () {
    editing = !editing; this.setAttribute('aria-pressed', editing); this.textContent = editing ? '편집 완료' : 'DIY 편집';
    $('#mp-add').hidden = !editing; grid.classList.toggle('is-editing', editing);
  });
  $('#mp-add').addEventListener('click', function (e) {
    var a = e.target.closest('[data-add]');
    if (a) { list.push(a.dataset.add); save(list); render(); return; }
    if (e.target.closest('#mp-reset')) { list = DEFAULT.slice(); save(list); render(); }
  });
  grid.addEventListener('click', function (e) {
    var card = e.target.closest('[data-w]'); if (!card) return;
    var i = list.indexOf(card.dataset.w), mv = e.target.closest('[data-move]');
    if (mv) { var j = i + (+mv.dataset.move); if (j < 0 || j >= list.length) return; list.splice(j, 0, list.splice(i, 1)[0]); save(list); render(); return; }
    if (e.target.closest('[data-del]')) { list.splice(i, 1); save(list); render(); }
  });
  render();
})();
