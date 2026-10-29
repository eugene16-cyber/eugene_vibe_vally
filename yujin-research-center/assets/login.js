// 이메일 로그인(Supabase 매직 링크) → lounge_members 등록 → 승인 상태에 따라 진입 (7-2)
(function () {
  'use strict';
  var KEY = 'il.pending-profile';

  $('#f-email').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = e.target.email.value.trim();
    if (!sb) { toast('지금은 로그인 서버에 연결할 수 없어요. 시연으로 둘러보기를 이용해 주세요.'); return; }
    try { localStorage.setItem(KEY, JSON.stringify(ILEntry.getProfile())); } catch (err) {}
    var btn = e.target.querySelector('button'); btn.disabled = true;
    sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
      btn.disabled = false;
      if (r.error) { toast('메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'); console.warn('[IL] 로그인 링크', r.error); return; }
      toast(email + '로 로그인 링크를 보냈어요. 메일에서 링크를 눌러 주세요.');
    });
  });

  // 메일 링크로 돌아왔을 때 — 세션이 있으면 회원 정보를 맞추고 승인 상태로 진입
  if (!sb) return;
  sb.auth.getSession().then(function (r) {
    var user = r.data && r.data.session && r.data.session.user;
    if (!user) return;
    var p = null;
    try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    var row = p && {
      user_id: user.id, name: p.name, role: 'customer', seg: p.seg, cust_type: p.cust_type, persona: p.persona,
      org: p.org || null, branch: p.branch || null, invite_code: p.invite_code || null
    };
    var save = row ? sb.from('lounge_members').upsert(row, { onConflict: 'user_id', ignoreDuplicates: true }) : Promise.resolve();
    Promise.resolve(save).catch(function () {}).then(function () {
      return sb.from('lounge_members').select('*').eq('user_id', user.id).maybeSingle();
    }).then(function (res) {
      var m = res && res.data;
      if (!m && !p) return;   // 프로필 없이 링크만 눌렀으면 처음부터
      try { localStorage.removeItem(KEY); } catch (e) {}
      var src = m || row;
      ILEntry.finish({
        role: 'customer', name: src.name, seg: src.seg, cust_type: src.cust_type, persona: src.persona,
        org: src.org || undefined, branch: src.branch || undefined,
        status: (m && m.status) || 'pending', via: 'email'
      });
    }).catch(function (e) { console.warn('[IL] 회원 정보 확인 실패', e); });
  });
})();
