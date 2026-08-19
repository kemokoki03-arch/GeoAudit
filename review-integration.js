(() => {
  'use strict';

  const REVIEW_URL = 'https://omaredgepro-web.github.io/system-review/';
  const SUPABASE_URL = 'https://gnpejzuxwqftxgfcsics.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_RZz9pDGfJXNtZYc7wADlHg_uMffms_6';
  const TABLE_NAME = 'system_review1';

  const $ = id => document.getElementById(id);
  const els = {
    loginBox: $('reviewLoginBox'), workspace: $('reviewWorkspace'), username: $('reviewUsername'), password: $('reviewPassword'),
    loginBtn: $('reviewLoginBtn'), loginError: $('reviewLoginError'), miniStatus: $('reviewMiniStatus'), userName: $('reviewUserName'),
    userRole: $('reviewUserRole'), logoutBtn: $('reviewLogoutBtn'), refreshBtn: $('reviewRefreshBtn'), badge: $('reviewQueueBadge'),
    pendingCount: $('reviewPendingCount'), activeDate: $('reviewActiveDate'), currentCard: $('reviewCurrentCard'), currentIndex: $('reviewCurrentIndex'),
    currentOrder: $('reviewCurrentOrder'), currentStatus: $('reviewCurrentStatus'), copyCurrentBtn: $('reviewCopyCurrentBtn'),
    currentCompany: $('reviewCurrentCompany'), currentReviewer: $('reviewCurrentReviewer'), currentReasonRow: $('reviewCurrentReasonRow'), currentReason: $('reviewCurrentReason'),
    acceptBtn: $('reviewAcceptBtn'), rejectBtn: $('reviewRejectBtn'), holdBtn: $('reviewHoldBtn'), qcBtn: $('reviewQcBtn'), statusActions: $('reviewStatusActions'), rejectBox: $('reviewRejectBox'), rejectReason: $('reviewRejectReason'), reasonTitle: $('reviewReasonTitle'),
    rejectCancelBtn: $('reviewRejectCancelBtn'), rejectConfirmBtn: $('reviewRejectConfirmBtn'), actionStatus: $('reviewActionStatus'),
    queueList: $('reviewQueueList'), queueSummary: $('reviewQueueSummary'), openFull1: $('reviewOpenFullBtn'), openFull2: $('reviewOpenFullBtn2'),
    fullModal: $('reviewFullModal'), fullFrame: $('reviewFullFrame'), fullClose: $('reviewFullCloseBtn'),
    datePicker: $('reviewDatePicker'), todayBtn: $('reviewTodayBtn')
  };

  if (!window.supabase || !els.loginBox) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  const state = {
    profile: null,
    all: [],
    visible: [],
    pending: [],
    activeId: null,
    activeDate: '',
    selectedDate: '',
    loading: false,
    channel: null,
    profiles: [],
    pendingDecisionStatus: null,
    dayCache: new Map(),
    lastLoadToken: 0
  };

  function setInline(el, text = '', type = '') {
    if (!el) return;
    el.textContent = text;
    el.className = el === els.loginError ? 'review-inline-error' : 'review-action-status';
    if (type) el.classList.add(type);
  }

  function setBusy(busy) {
    state.loading = busy;
    [els.loginBtn, els.acceptBtn, els.rejectBtn, els.holdBtn, els.qcBtn, els.rejectConfirmBtn, els.refreshBtn].forEach(btn => {
      if (btn) btn.disabled = busy;
    });
  }

  function parseDate(item) {
    const raw = item?.date || item?.created_at || item?.['التاريخ'] || item?.['تاريخ الطلب'] || '';
    if (!raw) return '';
    const s = String(raw).trim();

    // ISO / timestamps: 2026-08-19 or 2026-08-19T...
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;

    // Egyptian display/storage: 19-08-2026
    m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (m) return `${m[3]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;

    // Slash format used by the original system is commonly M/D/YYYY.
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
      if (y < 100) y += 2000;
      // If first part cannot be a month, treat as D/M/Y; otherwise M/D/Y like the original app.
      const month = a > 12 ? b : a;
      const day = a > 12 ? a : b;
      return `${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
    return '';
  }

  function getOrderNum(o) { return String(o?.order_number || o?.order_no || o?.['رقم الطلب'] || '—'); }
  function getCompany(o) { return String(o?.company || o?.['الشركة'] || '—'); }
  function getReviewer(o) { return String(o?.reviewer || o?.['المراجع'] || '—'); }
  function getStatus(o) { return String(o?.review_status || o?.['حالة المراجعة'] || 'لم يتم المراجعة').trim() || 'لم يتم المراجعة'; }
  function getReason(o) { return String(o?.rejection_reason || o?.reason || o?.['سبب الرفض'] || '—'); }
  function isDone(o) { const s = getStatus(o); return s === 'مقبول' || s === 'مرفوض'; }
  function rowKey(o) { return o?.id !== undefined && o?.id !== null ? `id:${o.id}` : `ord:${getOrderNum(o)}`; }

  function statusClass(status) {
    if (status === 'مقبول') return 'status-accepted';
    if (status === 'مرفوض') return 'status-rejected';
    if (status === 'معلق') return 'status-hold';
    if (String(status).toLowerCase() === 'qc') return 'status-qc';
    return 'status-unreviewed';
  }

  async function fetchOwnProfile(userId) {
    const { data, error } = await client.from('profiles').select('id, username, name, role').eq('id', userId).single();
    if (error) throw error;
    return data;
  }

  async function fetchAllProfiles() {
    const { data, error } = await client.from('profiles').select('id, username, name, role');
    if (error) return [];
    return data || [];
  }

  function getDisplayName(value) {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    const profile = state.profiles.find(p => p.username === raw || p.name === raw);
    return profile?.name || raw;
  }

  async function login() {
    const username = (els.username?.value || '').trim();
    const password = els.password?.value || '';
    setInline(els.loginError, '');
    if (!username || !password) {
      setInline(els.loginError, 'اكتب اسم المستخدم وكلمة المرور');
      return;
    }
    setBusy(true);
    try {
      const { data: email, error: lookupError } = await client.rpc('get_login_email', { p_username: username });
      if (lookupError || !email) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
      const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password });
      if (authError || !authData?.user) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
      const profile = await fetchOwnProfile(authData.user.id);
      await setupProfile(profile);
      if (els.password) els.password.value = '';
    } catch (err) {
      setInline(els.loginError, err?.message || 'تعذر تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  async function setupProfile(profile) {
    state.profile = profile;
    state.profiles = await fetchAllProfiles();
    els.loginBox?.classList.add('hidden');
    els.workspace?.classList.remove('hidden');
    if (els.userName) els.userName.textContent = profile?.name || profile?.username || 'مستخدم';
    if (els.userRole) els.userRole.textContent = profile?.role === 'admin' ? 'أدمن' : 'مراجع';
    if (els.miniStatus) els.miniStatus.textContent = `${profile?.name || profile?.username} · متصل`;
    state.selectedDate = todayLocal();
    if (els.datePicker) els.datePicker.value = state.selectedDate;
    subscribeRealtime();
    await loadQueue({ keepActive: false });
  }

  async function logout() {
    try { await client.auth.signOut(); } catch (_) {}
    if (state.channel) {
      try { await client.removeChannel(state.channel); } catch (_) {}
      state.channel = null;
    }
    state.profile = null;
    state.profiles = [];
    state.all = [];
    state.visible = [];
    state.pending = [];
    state.activeId = null;
    state.activeDate = '';
    state.selectedDate = '';
    state.dayCache.clear();
    if (els.datePicker) els.datePicker.value = '';
    els.workspace?.classList.add('hidden');
    els.loginBox?.classList.remove('hidden');
    if (els.miniStatus) els.miniStatus.textContent = 'غير مسجل';
    renderQueue();
  }

  function dateVariants(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return [iso].filter(Boolean);
    const y = m[1], mo = Number(m[2]), d = Number(m[3]);
    const mm = String(mo).padStart(2,'0'), dd = String(d).padStart(2,'0');
    return [...new Set([
      `${y}-${mm}-${dd}`,
      `${dd}-${mm}-${y}`, `${d}-${mo}-${y}`,
      `${mm}/${dd}/${y}`, `${mo}/${d}/${y}`,
      `${dd}/${mm}/${y}`, `${d}/${mo}/${y}`
    ])];
  }

  function reviewerCandidates() {
    if (!state.profile || state.profile.role === 'admin') return [null];
    return [...new Set([state.profile.username, state.profile.name].map(v => String(v || '').trim()).filter(Boolean))];
  }

  async function queryExactDate(dateValue, reviewerValue) {
    let q = client.from(TABLE_NAME).select('*').eq('date', dateValue).order('id', { ascending: true }).limit(1000);
    if (reviewerValue) q = q.eq('reviewer', reviewerValue);
    return await q;
  }

  async function fetchRecentForReviewer(reviewerValue, from = 0, step = 500) {
    let q = client.from(TABLE_NAME).select('*').order('id', { ascending: false }).range(from, from + step - 1);
    if (reviewerValue) q = q.eq('reviewer', reviewerValue);
    return await q;
  }

  async function fetchOrdersForDate(isoDate) {
    const target = isoDate || todayLocal();
    const reviewers = reviewerCandidates();
    const variants = dateVariants(target);
    const merged = new Map();
    let dateColumnIsTyped = false;

    // Fast path: ask Supabase for this day only. Usually this is one tiny query per reviewer alias.
    for (const v of variants) {
      const jobs = reviewers.map(r => queryExactDate(v, r));
      const results = await Promise.all(jobs.map(p => p.catch(error => ({ data:null, error }))));
      let gotRows = false;
      for (const res of results) {
        if (res?.error) {
          const msg = String(res.error?.message || res.error || '');
          if (/invalid input syntax.*date|date\/time field value out of range/i.test(msg)) dateColumnIsTyped = true;
          continue;
        }
        for (const row of (res?.data || [])) {
          if (parseDate(row) === target) merged.set(rowKey(row), row);
        }
        if ((res?.data || []).length) gotRows = true;
      }
      if (merged.size) break;
      // If the DB column is a real DATE type, ISO was the only valid representation.
      if (dateColumnIsTyped) break;
      if (gotRows && !merged.size) break;
    }

    if (merged.size) return [...merged.values()].sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));

    // Robust fallback for legacy rows whose date is stored in an unusual string format.
    // Only scan the current reviewer, newest first, and stop once we have moved past the target day.
    const step = 500, maxRowsPerReviewer = 5000;
    for (const reviewer of reviewers) {
      let foundForReviewer = false;
      for (let from = 0; from < maxRowsPerReviewer; from += step) {
        const { data, error } = await fetchRecentForReviewer(reviewer, from, step);
        if (error) throw error;
        const rows = data || [];
        if (!rows.length) break;
        let oldestParsed = '';
        for (const row of rows) {
          const d = parseDate(row);
          if (d) oldestParsed = !oldestParsed || d < oldestParsed ? d : oldestParsed;
          if (d === target) { merged.set(rowKey(row), row); foundForReviewer = true; }
        }
        if (foundForReviewer && oldestParsed && oldestParsed < target) break;
        if (!foundForReviewer && oldestParsed && oldestParsed < target) break;
        if (rows.length < step) break;
      }
    }
    return [...merged.values()].sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));
  }

  function todayLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDisplayDate(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso || '—');
  }

  function filterVisible(rows) {
    if (!state.profile) return { visible: [], pending: [], date: state.selectedDate || todayLocal() };
    const selected = state.selectedDate || todayLocal();
    let visible = (rows || []).filter(o => parseDate(o) === selected);
    if (state.profile.role !== 'admin') {
      visible = visible.filter(o => {
        const r = getReviewer(o);
        return r === state.profile.username || r === state.profile.name;
      });
    }
    visible = visible.sort((a,b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    return { visible, pending: visible.filter(o => !isDone(o)), date: selected };
  }

  function chooseDefaultActive(previous = null) {
    if (previous && state.visible.some(o => rowKey(o) === previous)) return previous;
    if (state.pending.length) return rowKey(state.pending[0]);
    if (state.visible.length) return rowKey(state.visible[0]);
    return null;
  }

  async function loadQueue({ keepActive = true, silent = false, force = false } = {}) {
    if (!state.profile) return;
    const selected = state.selectedDate || todayLocal();
    const cacheKey = `${state.profile.username || state.profile.name || 'user'}|${selected}`;
    const previous = keepActive ? state.activeId : null;

    // Show cached day immediately while the small server query refreshes in the background.
    if (!force && state.dayCache.has(cacheKey)) {
      const cached = state.dayCache.get(cacheKey) || [];
      const out = filterVisible(cached);
      state.all = cached;
      state.visible = out.visible;
      state.pending = out.pending;
      state.activeDate = out.date;
      state.activeId = chooseDefaultActive(previous);
      renderQueue();
      silent = true;
    }

    const token = ++state.lastLoadToken;
    setBusy(true);
    if (!silent && !state.visible.length) setInline(els.actionStatus, 'جاري تحميل طلبات اليوم…');
    try {
      const rows = await fetchOrdersForDate(selected);
      if (token !== state.lastLoadToken) return;
      state.dayCache.set(cacheKey, rows);
      state.all = rows;
      const out = filterVisible(rows);
      state.visible = out.visible;
      state.pending = out.pending;
      state.activeDate = out.date;
      state.activeId = chooseDefaultActive(previous);
      renderQueue();
      setInline(els.actionStatus, '');
    } catch (err) {
      if (token === state.lastLoadToken) setInline(els.actionStatus, err?.message || 'تعذر تحميل الطلبات', 'error');
    } finally {
      if (token === state.lastLoadToken) setBusy(false);
    }
  }

  function activeOrder() {
    return state.visible.find(o => rowKey(o) === state.activeId) || state.pending[0] || state.visible[0] || null;
  }

  async function copyText(text, btn = null) {
    const value = String(text || '');
    if (!value || value === '—') return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch (_) {}
    }
    if (ok && btn) {
      const old = btn.innerHTML;
      btn.innerHTML = '✓ <span>تم</span>';
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = old; btn.classList.remove('copied'); }, 700);
    }
  }

  function renderCurrent(active) {
    const all = state.visible;
    if (!active) {
      if (els.currentOrder) els.currentOrder.textContent = `لا توجد طلبات بتاريخ ${formatDisplayDate(state.activeDate)}`;
      if (els.currentCompany) els.currentCompany.textContent = '—';
      if (els.currentReviewer) els.currentReviewer.textContent = '—';
      if (els.currentIndex) els.currentIndex.textContent = '0 / 0';
      if (els.currentStatus) {
        els.currentStatus.textContent = '—';
        els.currentStatus.className = 'review-status-badge status-unreviewed';
      }
      els.currentReasonRow?.classList.add('hidden');
      [els.acceptBtn, els.rejectBtn, els.holdBtn, els.qcBtn].forEach(b => { if (b) b.disabled = true; });
      return;
    }

    const idx = all.findIndex(o => rowKey(o) === rowKey(active));
    const status = getStatus(active);
    const done = isDone(active);
    if (els.currentOrder) els.currentOrder.textContent = getOrderNum(active);
    if (els.currentCompany) els.currentCompany.textContent = getCompany(active);
    if (els.currentReviewer) els.currentReviewer.textContent = getDisplayName(getReviewer(active)) || state.profile?.name || '—';
    if (els.currentIndex) els.currentIndex.textContent = `${idx + 1} / ${all.length}`;
    if (els.currentStatus) {
      els.currentStatus.textContent = status;
      els.currentStatus.className = `review-status-badge ${statusClass(status)}`;
    }
    if ((status === 'مرفوض' || status === 'معلق') && getReason(active) && getReason(active) !== '-') {
      els.currentReasonRow?.classList.remove('hidden');
      if (els.currentReason) els.currentReason.textContent = getReason(active);
      const label = els.currentReasonRow?.querySelector('span'); if (label) label.textContent = status === 'معلق' ? 'سبب التعليق' : 'سبب الرفض';
    } else {
      els.currentReasonRow?.classList.add('hidden');
      if (els.currentReason) els.currentReason.textContent = '—';
    }
    [els.acceptBtn, els.rejectBtn, els.holdBtn, els.qcBtn].forEach(b => { if (b) b.disabled = state.loading; });
    if (done) els.rejectBox?.classList.add('hidden');
  }

  function renderQueue() {
    const all = state.visible || [];
    const pending = state.pending || [];
    const active = activeOrder();
    if (els.badge) {
      els.badge.textContent = String(pending.length);
      els.badge.classList.toggle('has-items', pending.length > 0);
    }
    if (els.pendingCount) els.pendingCount.textContent = String(pending.length);
    if (els.activeDate) els.activeDate.textContent = formatDisplayDate(state.activeDate);
    if (els.datePicker && els.datePicker.value !== state.activeDate) els.datePicker.value = state.activeDate || todayLocal();
    if (els.queueSummary) els.queueSummary.textContent = `${all.length} طلب · ${pending.length} متبقي`;

    renderCurrent(active);

    if (!els.queueList) return;
    els.queueList.innerHTML = '';
    all.slice(0, 120).forEach((o, i) => {
      const status = getStatus(o);
      const row = document.createElement('div');
      row.className = 'review-queue-item';
      if (rowKey(o) === state.activeId) row.classList.add('active');
      row.innerHTML = `
        <span class="review-queue-index">${String(i + 1).padStart(2,'0')}</span>
        <button type="button" class="review-queue-open" title="فتح الطلب">
          <span class="review-queue-main"><b>${escapeHtml(getOrderNum(o))}</b><small>${escapeHtml(getCompany(o))} · ${escapeHtml(getDisplayName(getReviewer(o)))}</small></span>
        </button>
        <span class="review-status-badge ${statusClass(status)}">${escapeHtml(status)}</span>
        <button type="button" class="review-copy-icon" title="نسخ رقم الطلب">⧉</button>`;

      row.querySelector('.review-queue-open')?.addEventListener('click', () => {
        state.activeId = rowKey(o);
        state.pendingDecisionStatus = null;
        els.rejectBox?.classList.add('hidden');
        if (els.rejectReason) els.rejectReason.value = '';
        setInline(els.actionStatus, '');
        renderQueue();
      });
      row.querySelector('.review-copy-icon')?.addEventListener('click', e => {
        e.stopPropagation();
        copyText(getOrderNum(o), e.currentTarget);
      });
      els.queueList.appendChild(row);
    });
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }

  function nextPendingAfter(order) {
    const currentIndex = state.visible.findIndex(o => rowKey(o) === rowKey(order));
    const key = rowKey(order);
    // Prefer the next actionable request after the current one; never loop straight back
    // to the just-saved request when it is Qc/معلق.
    const after = state.visible.slice(currentIndex + 1).find(o => !isDone(o) && rowKey(o) !== key);
    if (after) return after;
    const before = state.visible.slice(0, Math.max(0, currentIndex)).find(o => !isDone(o) && rowKey(o) !== key);
    return before || null;
  }

  async function syncDecisionToWorkSite(status, reason, orderNumber) {
    if (status === 'معلق') return { ok: true, skipped: true };
    const res = await fetch('/api/work-review-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason: reason || '', orderNumber: orderNumber || '' })
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = { ok: false, message: 'تعذر قراءة رد موقع العمل' }; }
    if (!res.ok || !data?.ok) throw new Error(data?.message || 'تعذر تطبيق القرار على موقع العمل');
    return data;
  }

  async function applyDecision(status, reason = '') {
    const order = activeOrder();
    if (!order || state.loading) return;
    const needsReason = status === 'مرفوض' || status === 'معلق';
    const finalReason = needsReason ? reason.trim() : '-';
    if (needsReason && !finalReason) {
      setInline(els.actionStatus, status === 'معلق' ? 'اكتب سبب التعليق أولًا' : 'اكتب سبب الرفض أولًا', 'error');
      els.rejectReason?.focus();
      return;
    }

    setBusy(true);
    setInline(els.actionStatus, 'جاري حفظ القرار…');
    const matchColumn = order.id !== undefined ? 'id' : (order['رقم الطلب'] !== undefined ? 'رقم الطلب' : 'order_number');
    const matchValue = order[matchColumn];
    const updateData = {};
    if ('review_status' in order) updateData.review_status = status;
    if ('حالة المراجعة' in order) updateData['حالة المراجعة'] = status;
    if ('rejection_reason' in order) updateData.rejection_reason = finalReason;
    if ('سبب الرفض' in order) updateData['سبب الرفض'] = finalReason;
    if (!Object.keys(updateData).some(k => k === 'review_status' || k === 'حالة المراجعة')) updateData.review_status = status;
    if (!Object.keys(updateData).some(k => k === 'rejection_reason' || k === 'سبب الرفض')) updateData.rejection_reason = finalReason;

    try {
      // First mirror the decision into the open landsurvey form. If this fails,
      // do not advance or mark the tracker as completed, so the two systems stay aligned.
      await syncDecisionToWorkSite(status, finalReason, getOrderNum(order));

      // Rejected intentionally stops after writing the exact comment and clicking
      // Add Comment on the work site. No work-site Save, no tracker update, and no
      // automatic move to the next request. The reviewer decides when to continue.
      if (status === 'مرفوض') {
        state.pendingDecisionStatus = null;
        els.rejectBox?.classList.add('hidden');
        if (els.rejectReason) els.rejectReason.value = '';
        setInline(els.actionStatus, 'تم إضافة التعليق · بدون حفظ', 'ok');
        return;
      }

      const { data, error } = await client.from(TABLE_NAME).update(updateData).eq(matchColumn, matchValue).select();
      if (error) throw error;
      if (!data || !data.length) throw new Error('لم يتم حفظ القرار. قد تكون صلاحية الطلب تغيرت.');

      // Update the visible list in-place first for a smooth next-request transition.
      const local = state.visible.find(o => rowKey(o) === rowKey(order));
      if (local) {
        if ('review_status' in local || !('حالة المراجعة' in local)) local.review_status = status;
        if ('حالة المراجعة' in local) local['حالة المراجعة'] = status;
        if ('rejection_reason' in local || !('سبب الرفض' in local)) local.rejection_reason = finalReason;
        if ('سبب الرفض' in local) local['سبب الرفض'] = finalReason;
      }
      state.pending = state.visible.filter(o => !isDone(o));
      const next = nextPendingAfter(order);
      state.activeId = next ? rowKey(next) : rowKey(order);
      state.pendingDecisionStatus = null;
      els.rejectBox?.classList.add('hidden');
      if (els.rejectReason) els.rejectReason.value = '';
      setInline(els.actionStatus, `${status} · انتقلت للطلب التالي`, 'ok');
      renderQueue();
      setTimeout(() => setInline(els.actionStatus, ''), 900);
      const selected = state.selectedDate || todayLocal();
      const cacheKey = `${state.profile.username || state.profile.name || 'user'}|${selected}`;
      state.dayCache.set(cacheKey, state.visible.map(o => ({...o})));
    } catch (err) {
      setInline(els.actionStatus, err?.message || 'تعذر حفظ القرار', 'error');
    } finally {
      setBusy(false);
    }
  }

  function subscribeRealtime() {
    if (state.channel) return;
    try {
      state.channel = client.channel(`geoaudit-review-${state.profile?.username || 'user'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, payload => {
          const row = payload?.new && Object.keys(payload.new).length ? payload.new : payload?.old;
          if (!row) return;
          const selected = state.selectedDate || todayLocal();
          if (parseDate(row) !== selected) return;
          if (state.profile?.role !== 'admin') {
            const reviewer = getReviewer(row);
            if (reviewer !== state.profile?.username && reviewer !== state.profile?.name) return;
          }

          const key = rowKey(row);
          if (payload.eventType === 'DELETE') {
            state.visible = state.visible.filter(o => rowKey(o) !== key);
          } else {
            const idx = state.visible.findIndex(o => rowKey(o) === key);
            if (idx >= 0) state.visible[idx] = { ...state.visible[idx], ...row };
            else state.visible.push(row);
          }
          state.visible.sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));
          state.pending = state.visible.filter(o => !isDone(o));
          state.all = state.visible.slice();
          const cacheKey = `${state.profile.username || state.profile.name || 'user'}|${selected}`;
          state.dayCache.set(cacheKey, state.visible.map(o => ({...o})));
          if (!state.activeId || !state.visible.some(o => rowKey(o) === state.activeId)) state.activeId = chooseDefaultActive(null);
          renderQueue();
        }).subscribe();
    } catch (_) {}
  }

  function openFullSystem() {
    if (!els.fullModal || !els.fullFrame) return;
    if (els.fullFrame.src === 'about:blank') els.fullFrame.src = REVIEW_URL;
    els.fullModal.classList.add('show');
  }
  function closeFullSystem() { els.fullModal?.classList.remove('show'); }

  els.loginBtn?.addEventListener('click', login);
  [els.username, els.password].forEach(input => input?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); }));
  els.logoutBtn?.addEventListener('click', logout);
  els.refreshBtn?.addEventListener('click', () => loadQueue({ keepActive: true }));
  els.copyCurrentBtn?.addEventListener('click', e => copyText(getOrderNum(activeOrder()), e.currentTarget));
  els.acceptBtn?.addEventListener('click', () => applyDecision('مقبول'));
  els.qcBtn?.addEventListener('click', () => applyDecision('Qc'));

  function openReasonDecision(status) {
    const order = activeOrder();
    if (!order) return;
    state.pendingDecisionStatus = status;
    if (els.reasonTitle) els.reasonTitle.textContent = status === 'معلق' ? 'سبب التعليق' : 'سبب الرفض';
    if (els.rejectReason) els.rejectReason.placeholder = status === 'معلق' ? 'اكتب سبب التعليق...' : 'اكتب سبب الرفض...';
    els.rejectBox?.classList.remove('hidden');
    els.rejectReason?.focus();
  }

  els.rejectBtn?.addEventListener('click', () => {
    if (state.pendingDecisionStatus === 'مرفوض' && !els.rejectBox?.classList.contains('hidden')) {
      applyDecision('مرفوض', els.rejectReason?.value || '');
    } else {
      openReasonDecision('مرفوض');
    }
  });
  els.holdBtn?.addEventListener('click', () => openReasonDecision('معلق'));
  els.rejectCancelBtn?.addEventListener('click', () => {
    state.pendingDecisionStatus = null;
    els.rejectBox?.classList.add('hidden');
    if (els.rejectReason) els.rejectReason.value = '';
  });
  els.rejectConfirmBtn?.addEventListener('click', () => {
    const status = state.pendingDecisionStatus || 'مرفوض';
    applyDecision(status, els.rejectReason?.value || '');
  });

  async function selectReviewDate(iso) {
    const next = String(iso || '').trim() || todayLocal();
    state.selectedDate = next;
    state.activeId = null;
    state.pendingDecisionStatus = null;
    els.rejectBox?.classList.add('hidden');
    if (els.rejectReason) els.rejectReason.value = '';
    await loadQueue({ keepActive: false, silent: true });
  }

  els.datePicker?.addEventListener('change', e => selectReviewDate(e.target.value));
  els.todayBtn?.addEventListener('click', () => {
    const today = todayLocal();
    if (els.datePicker) els.datePicker.value = today;
    selectReviewDate(today);
  });

  [els.openFull1, els.openFull2].forEach(b => b?.addEventListener('click', openFullSystem));
  els.fullClose?.addEventListener('click', closeFullSystem);
  els.fullModal?.addEventListener('mousedown', e => { if (e.target === els.fullModal) closeFullSystem(); });

  (async () => {
    try {
      const { data: { session } } = await client.auth.getSession();
      if (session?.user) {
        const profile = await fetchOwnProfile(session.user.id);
        if (profile) await setupProfile(profile);
      }
    } catch (_) {}
    renderQueue();
  })();
})();
