import { supabase } from './lib/supabase.js';

(function () {

  /* ------------------ Utilities ------------------ */

  const qs = s => document.querySelector(s);
  const qsa = s => [...document.querySelectorAll(s)];
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const get = (k, def) => {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  };

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const uid = () =>
    crypto.randomUUID?.() ||
    "id-" + Math.random().toString(36).slice(2, 9);

  /* ------------------ Storage Keys ------------------ */

  const PROFILE_KEY = "hydrate_profile";
  const ENTRIES_KEY = "hydrate_entries";
  const FRIENDS_KEY = "hydrate_friends";
  const PRESETS_KEY = "hydrate_presets";
  const REMINDERS_KEY = "hydrate_reminders";

  /* ------------------ State ------------------ */

  let profile = get(PROFILE_KEY, { id: uid(), name: "You", goal: 2000 });
  let entries = get(ENTRIES_KEY, []);
  let friends = get(FRIENDS_KEY, {});
  let presets = get(PRESETS_KEY, [200, 250, 500]);
  let reminders = get(REMINDERS_KEY, []);

  let currentUser = null;
  let goalCelebrated = false;

  const quotes = [
    "Good job — keep up the great work!",
    "Nice! Your body thanks you.",
    "Small steps add up. Well done!",
    "Refreshing choice — stay hydrated!",
    "Way to go! Keep sipping."
  ];

  function saveAll() {
    set(PROFILE_KEY, profile);
    set(ENTRIES_KEY, entries);
    set(FRIENDS_KEY, friends);
    set(PRESETS_KEY, presets);
    set(REMINDERS_KEY, reminders);
  }

  /* ------------------ Elements ------------------ */

  const todayEl = qs("#today");
  const goalEl = qs("#goal");
  const percentEl = qs("#percent");
  const amountInput = qs("#amount");
  const addBtn = qs("#addBtn");
  const entryList = qs("#entryList");
  const quoteEl = qs("#quote");

  const displayName = qs("#displayName");
  const dailyGoal = qs("#dailyGoal");
  const saveProfile = qs("#saveProfile");

  const exportMeBtn = qs("#exportMe");
  const importMeBtn = qs("#importMe");
  const importFile = qs("#importFile");
  const addFriendBtn = qs("#addFriend");
  const friendNameInput = qs("#friendName");
  const friendIdInput = qs("#friendId");
  const friendsList = qs("#friendsList");

  const presetsWrap = qs("#presets");
  const newPreset = qs("#newPreset");
  const addPreset = qs("#addPreset");

  const historyList = qs("#historyList");

  const reminderTime = qs("#reminderTime");
  const addReminder = qs("#addReminder");
  const reminderList = qs("#reminderList");

  /* ------------------ Core Logic ------------------ */

  function sumForDate(list, dateStr) {
    return (list || [])
      .filter(e => e.ts.slice(0, 10) === dateStr)
      .reduce((s, e) => s + e.amount, 0);
  }

  function updateRing(pct) {
    const svg = document.getElementById("progressRing");
    if (!svg) return;

    const fg = svg.querySelector(".fg");
    const r = 50;
    const c = 2 * Math.PI * r;

    fg.style.strokeDasharray = c;
    fg.style.strokeDashoffset = c * (1 - pct / 100);
    // brief pop on the ring to give feedback
    const wrap = document.querySelector('.progress-wrap');
    if (wrap) {
      wrap.classList.add('ring-pop');
      setTimeout(() => wrap.classList.remove('ring-pop'), 420);
    }
  }

  async function fetchEntriesFromSupabase() {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('water_logs')
        .select('id, amount_ml, logged_at')
        .eq('user_id', currentUser.id)
        .order('logged_at', { ascending: false });
      if (error) throw error;
      entries = (data || []).map(r => ({ id: r.id, amount: r.amount_ml, ts: r.logged_at }));
      saveAll();
    } catch (e) {
      console.warn('fetchEntriesFromSupabase failed', e);
    }
  }

  async function fetchProfileFromSupabase(){
    if(!currentUser) return;
    try{
      const { data, error } = await supabase.from('users').select('username,daily_goal_ml').eq('id', currentUser.id).single();
      if(error) throw error;
      if(data){ profile.name = data.username || profile.name; profile.goal = data.daily_goal_ml || profile.goal; saveAll(); }
    }catch(e){ console.warn('fetchProfileFromSupabase failed', e); }
  }

  function renderToday() {
    const total = sumForDate(entries, todayKey());

    todayEl.textContent = total;
    goalEl.textContent = profile.goal;

    const pct = Math.min(
      100,
      Math.round((total / profile.goal) * 100) || 0
    );
    // update numeric percent with a bounce animation
    if (percentEl) {
      percentEl.innerHTML = `<span class="num">${pct}</span>`;
      const numEl = percentEl.querySelector('.num');
      if (numEl) {
        numEl.style.transform = 'scale(1.25)';
        numEl.style.transition = 'transform 420ms cubic-bezier(.2,.9,.2,1)';
        setTimeout(() => (numEl.style.transform = 'scale(1)'), 80);
      }
    }

    updateRing(pct);
    // celebration when goal reached
    const wrap = document.querySelector('.progress-wrap');
    if (pct >= 100 && !goalCelebrated) {
      goalCelebrated = true;
      if (wrap) wrap.classList.add('goal-reached');
      launchConfetti();
      setTimeout(() => { if (wrap) wrap.classList.remove('goal-reached'); }, 2200);
    }
    if (pct < 100) goalCelebrated = false;
  }

  function renderEntries() {
    entryList.innerHTML = "";

    const todays = entries
      .filter(e => e.ts.slice(0, 10) === todayKey())
      .sort((a, b) => b.ts.localeCompare(a.ts));

    if (!todays.length) {
      entryList.innerHTML =
        '<li class="small">No entries yet — add some water.</li>';
      return;
    }

    todays.forEach(e => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>
          ${new Date(e.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })} — ${e.amount} ml
        </span>
        <button>Delete</button>
      `;

      // set initial state for appear animation
      li.style.opacity = '0';
      li.style.transform = 'translateY(8px)';
      li.style.transition = 'opacity 420ms cubic-bezier(.2,.9,.2,1), transform 420ms cubic-bezier(.2,.9,.2,1)';

      li.querySelector("button").addEventListener("click", () => {
        entries = entries.filter(x => x.id !== e.id);
        saveAll();
        renderEntries();
        renderToday();
      });

      entryList.appendChild(li);
      // trigger appear animation
      requestAnimationFrame(()=>{ li.style.opacity='1'; li.style.transform='translateY(0)'; });
    });
  }

  function addEntry(amount) {
    if (!amount || amount <= 0) return;

    // If logged in, insert to Supabase; otherwise fallback to local
    if (currentUser) {
      supabase.from('water_logs').insert([{ user_id: currentUser.id, amount_ml: amount }]).then(({ error }) => {
        if (error) {
          console.warn('Insert failed, falling back local', error);
          localInsert();
        } else {
          fetchEntriesFromSupabase().then(() => { renderEntries(); renderToday(); showQuote(); });
        }
      });
    } else {
      localInsert();
    }

    function localInsert() {
      entries.push({ id: uid(), ts: new Date().toISOString(), amount: +amount });
      saveAll();
      renderEntries();
      renderToday();
      showQuote();
    }
  }

  function showQuote() {
    quoteEl.textContent =
      quotes[Math.floor(Math.random() * quotes.length)];
    quoteEl.classList.remove("hidden");
    setTimeout(() => quoteEl.classList.add("hidden"), 3000);
  }

  /* ------------------ Presets ------------------ */

  function renderPresets() {
    presetsWrap.innerHTML = "";
    presets.forEach(p => {
      const b = document.createElement("button");
      b.className = "pill";
      b.textContent = p + " ml";
      b.addEventListener("click", () => addEntry(p));
      presetsWrap.appendChild(b);
    });
  }

  addPreset.addEventListener("click", () => {
    const v = Number(newPreset.value);
    if (v > 0) {
      presets.push(v);
      newPreset.value = "";
      saveAll();
      renderPresets();
    }
  });

  /* ------------------ Friends ------------------ */

  function renderFriends() {
    friendsList.innerHTML = "";

    const today = todayKey();
    const keys = Object.keys(friends);

    if (!keys.length) {
      friendsList.innerHTML =
        '<li class="small">No friends yet.</li>';
      return;
    }

    keys.forEach(k => {
      const f = friends[k];
      const total = sumForDate(f.entries || [], today);

      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>${f.name}</strong>
          <div class="small">${f.id}</div>
        </div>
        <div>
          <div class="small">Today: ${total} ml</div>
          <button>Remove</button>
        </div>
      `;

      li.querySelector("button").addEventListener("click", () => {
        delete friends[f.id];
        saveAll();
        renderFriends();
      });

      friendsList.appendChild(li);
    });
  }

  /* ------------------ Social Friends (Supabase) ------------------ */

  async function searchUsers(term){
    if(!term) return [];
    const { data, error } = await supabase.from('users').select('id,username,daily_goal_ml').ilike('username', `%${term}%`).limit(20);
    if (error) throw error;
    return data || [];
  }

  async function sendFriendRequest(receiverId){
    if(!currentUser) return alert('Sign in to add friends');
    if(receiverId === currentUser.id) return alert('Cannot add yourself');
    try{
      // check for existing friendship or pending request in either direction
      const cond = `(requester_id.eq.${currentUser.id}&receiver_id.eq.${receiverId}),(requester_id.eq.${receiverId}&receiver_id.eq.${currentUser.id})`;
      const { data:existing, error:errCheck } = await supabase.from('friendships').select('id,status,requester_id,receiver_id').or(cond).limit(1);
      if(errCheck) { console.warn('friend check failed', errCheck); }
      if(existing && existing.length){
        const row = existing[0];
        if(row.status === 'pending') return alert('A friend request is already pending between you and this user.');
        if(row.status === 'accepted') return alert('You are already friends with this user.');
      }

      const { data, error } = await supabase.from('friendships').insert([{ requester_id: currentUser.id, receiver_id: receiverId, status: 'pending' }]);
      if(error) throw error;
      alert('Friend request sent');
      loadPendingRequests();
    }catch(e){ console.warn('sendFriendRequest failed', e); alert(e?.message || 'Could not send request'); }
  }

  async function loadPendingRequests(){
    if(!currentUser) return;
    try{
      const { data, error } = await supabase.from('friendships').select('id,requester_id,created_at').eq('receiver_id', currentUser.id).eq('status','pending').order('created_at', {ascending:false});
      if(error) throw error;
      const reqs = data || [];
      const requesterIds = reqs.map(r=>r.requester_id);
      let usersMap = {};
      if(requesterIds.length){
        const { data:users } = await supabase.from('users').select('id,username').in('id', requesterIds);
        (users||[]).forEach(u=>usersMap[u.id]=u);
      }
      const ul = qs('#pendingList'); ul.innerHTML='';
      reqs.forEach(r=>{
        const u = usersMap[r.requester_id] || {username:'Unknown'};
        const li=document.createElement('li'); li.innerHTML = `<div><strong>${u.username}</strong><div class="small">${r.requester_id}</div></div><div><button data-id="${r.id}" class="accept">Accept</button><button data-id="${r.id}" class="reject">Reject</button></div>`;
        li.querySelector('.accept').addEventListener('click', ()=> respondRequest(r.id, 'accepted'));
        li.querySelector('.reject').addEventListener('click', ()=> respondRequest(r.id, 'rejected'));
        ul.appendChild(li);
      });
    }catch(e){ console.warn('loadPendingRequests failed', e); }
  }

  async function respondRequest(id, status){
    try{
      const { error } = await supabase.from('friendships').update({ status }).eq('id', id);
      if(error) throw error;
      loadPendingRequests(); loadAcceptedFriends();
    }catch(e){ console.warn('respondRequest failed', e); }
  }

  async function loadAcceptedFriends(){
    if(!currentUser) return;
    try{
      const { data:as1, error:err1 } = await supabase.from('friendships').select('id,requester_id,receiver_id').eq('requester_id', currentUser.id).eq('status','accepted');
      if(err1) throw err1;
      const { data:as2, error:err2 } = await supabase.from('friendships').select('id,requester_id,receiver_id').eq('receiver_id', currentUser.id).eq('status','accepted');
      if(err2) throw err2;
      const combined = [...(as1||[]), ...(as2||[])];
      const otherIds = combined.map(r=> r.requester_id === currentUser.id ? r.receiver_id : r.requester_id ).filter(Boolean);
      let users = [];
      if(otherIds.length){
        const { data } = await supabase.from('users').select('id,username,daily_goal_ml').in('id', otherIds);
        users = data || [];
      }
      // fetch today's logs for these users
      const today = new Date(); today.setHours(0,0,0,0);
      const { data:logs } = await supabase.from('water_logs').select('user_id,amount_ml,logged_at').in('user_id', otherIds).gte('logged_at', today.toISOString());
      const sums = {};
      (logs||[]).forEach(l=>{ sums[l.user_id] = (sums[l.user_id]||0) + l.amount_ml; });
      const ul = qs('#acceptedFriends'); ul.innerHTML = '';
      users.forEach(u=>{
        const total = sums[u.id]||0;
        const pct = Math.round((total / (u.daily_goal_ml || 2000)) * 100) || 0;
        const li = document.createElement('li');
        li.innerHTML = `<div><strong>${u.username}</strong><div class="small">Today: ${total} ml — ${pct}%</div></div><div><div style="width:80px;height:8px;background:#e6eef0;border-radius:6px"><div style="width:${Math.min(100,pct)}%;height:8px;background:var(--accent);border-radius:6px"></div></div></div>`;
        li.dataset.userid = u.id;
        li.style.cursor = 'pointer';
        // click to open friend profile modal (show today + week totals)
        li.addEventListener('click', (e)=>{ e.stopPropagation(); showFriendProfile(u.id, u); });
        ul.appendChild(li);
      });
    }catch(e){ console.warn('loadAcceptedFriends failed', e); }
  }

  /* ------------------ Friend profile view ------------------ */

  async function fetchFriendWeek(userId){
    try{
      const now = new Date();
      const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0);
      const { data, error } = await supabase.from('water_logs').select('amount_ml,logged_at').eq('user_id', userId).gte('logged_at', start.toISOString());
      if(error) throw error;
      return data || [];
    }catch(e){ console.warn('fetchFriendWeek failed', e); return []; }
  }

  function buildDailySums(logs){
    const map = {};
    logs.forEach(l=>{ const key = (new Date(l.logged_at)).toISOString().slice(0,10); map[key] = (map[key]||0) + (l.amount_ml || l.amount); });
    return map;
  }

  function closeFriendModal(backdrop){ backdrop.remove(); }

  async function showFriendProfile(userId, userObj){
    const logs = await fetchFriendWeek(userId);
    const sums = buildDailySums(logs);
    const now = new Date();
    const days = [];
    for(let i=6;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); const key=d.toISOString().slice(0,10); days.push({ key, label: d.toLocaleDateString([], { weekday:'short' }), total: sums[key] || 0 }); }

    const modalBack = document.createElement('div'); modalBack.className='friend-modal-backdrop';
    const modal = document.createElement('div'); modal.className='friend-modal';
    const name = userObj?.username || 'Friend';
    const goal = userObj?.daily_goal_ml || 2000;
    const todayTotal = days[days.length-1].total || 0;
    modal.innerHTML = `<button class="close">Close</button><h3>${name}</h3><div class="meta">Today: ${todayTotal} ml — ${Math.round((todayTotal/goal)*100) || 0}% of goal</div><div class="week-bars" aria-hidden="false"></div>`;
    modalBack.appendChild(modal);
    document.body.appendChild(modalBack);

    modal.querySelector('.close').addEventListener('click', ()=> closeFriendModal(modalBack));
    modalBack.addEventListener('click', (e)=>{ if(e.target === modalBack) closeFriendModal(modalBack); });

    const barsWrap = modal.querySelector('.week-bars');
    const max = Math.max(...days.map(d=>d.total), goal || 1);
    days.forEach(d=>{
      const b = document.createElement('div'); b.className='bar';
      const f = document.createElement('div'); f.className='fill'; f.style.height = '0%';
      const pct = Math.round((d.total / max) * 100) || 0;
      b.appendChild(f); barsWrap.appendChild(b);
      requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ f.style.height = pct + '%'; }); });
    });
  }


  /* ------------------ History ------------------ */

  function renderHistory() {
    historyList.innerHTML = "";
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);

      const key = d.toISOString().slice(0, 10);
      const total = sumForDate(entries, key);

      const li = document.createElement("li");
      li.textContent = `${d.toLocaleDateString([], {
        month: "short",
        day: "numeric"
      })}: ${total} ml`;

      historyList.appendChild(li);
    }

    renderWeeklyChart();
  }

  function renderWeeklyChart(){
    const container = qs('#weeklyChart');
    if(!container) return;
    container.innerHTML='';
    const now = new Date();
    const days = [];
    for(let i=6;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); const key=d.toISOString().slice(0,10); days.push({key, label:d.toLocaleDateString([], {weekday:'short'}) , total: sumForDate(entries,key)}); }
    const max = Math.max(...days.map(d=>d.total), profile.goal || 1);
    days.forEach(d=>{
      const bar = document.createElement('div'); bar.className='bar';
      const fill = document.createElement('div'); fill.className='fill';
      const pct = Math.round((d.total / max) * 100) || 0;
      // animate from 0 to target height for a smooth entrance
      fill.style.height = '0%';
      const value = document.createElement('div'); value.className='value'; value.textContent = d.total + 'ml';
      const label = document.createElement('div'); label.className='label'; label.textContent = d.label;
      bar.appendChild(fill); bar.appendChild(value); bar.appendChild(label); container.appendChild(bar);
      // accessibility
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', `${d.label}: ${d.total} ml`);

      // tooltip handling for each bar
      const tip = createChartTooltip();
      function showTip(e){ tip.textContent = `${d.label} — ${d.total} ml (${pct}%)`; tip.style.left = Math.min(window.innerWidth - 20, Math.max(20, e.clientX)) + 'px'; tip.style.top = Math.max(60, e.clientY - 10) + 'px'; tip.style.opacity = '1'; }
      function moveTip(e){ tip.style.left = Math.min(window.innerWidth - 20, Math.max(20, e.clientX)) + 'px'; tip.style.top = Math.max(60, e.clientY - 10) + 'px'; }
      function hideTip(){ tip.style.opacity = '0'; }
      bar.addEventListener('mouseenter', showTip);
      bar.addEventListener('mousemove', moveTip);
      bar.addEventListener('mouseleave', hideTip);

      // trigger animation on next frame
      requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ fill.style.height = pct + '%'; }); });
    });
  }

  /* ------------------ Confetti (lightweight JS) ------------------ */
  function launchConfetti(count = 40) {
    const primary = (getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#06b6d4').trim();
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const pieces = [];
    const spread = Math.min(window.innerWidth * 0.35, 360);
    const centerX = window.innerWidth / 2;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const size = 6 + Math.random() * 12;
      el.style.width = `${Math.round(size)}px`;
      el.style.height = `${Math.round(size * 1.4)}px`;
      el.style.left = `0px`;
      el.style.top = `0px`;
      el.style.background = primary;
      el.style.transform = `translate3d(0,0,0) rotate(${Math.random() * 360}deg)`;
      container.appendChild(el);

      const startX = centerX + (Math.random() - 0.5) * spread;
      pieces.push({ el, x: startX, y: -50, vx: (Math.random() - 0.5) * 6, vy: 6 + Math.random() * 6, rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 20 });
    }

    let t0 = performance.now();
    const gravity = 0.35;
    function frame(t) {
      const dt = (t - t0) / 16.6667; // approx frames
      t0 = t;
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vy += gravity * dt * 0.5;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.rotV * dt;
        p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg)`;
        p.el.style.opacity = `${1 - p.y / (window.innerHeight * 1.2)}`;
        if (p.y > window.innerHeight + 200) {
          p.el.remove();
          pieces.splice(i, 1);
        }
      }
      if (pieces.length) requestAnimationFrame(frame);
      else container.remove();
    }
    requestAnimationFrame(frame);
  }

  /* ------------------ Reminders ------------------ */

  function renderReminders() {
    reminderList.innerHTML = "";

    if (!reminders.length) {
      reminderList.innerHTML =
        '<li class="small">No reminders yet.</li>';
      return;
    }

    function to12hr(t){
      if(!t) return '';
      const [hh, mm] = t.split(':').map(Number);
      const d = new Date(); d.setHours(hh, mm, 0, 0);
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    reminders.forEach((r, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `${to12hr(r.time)} <button>Remove</button>`;

      li.querySelector("button").addEventListener("click", () => {
        reminders.splice(idx, 1);
        saveAll();
        renderReminders();
      });

      reminderList.appendChild(li);
      scheduleReminder(r);
    });
  }

  function scheduleReminder(r) {
    if (!("Notification" in window)) return;

    const [hh, mm] = r.time.split(":").map(Number);
    const now = new Date();
    const target = new Date();

    target.setHours(hh, mm, 0, 0);
    if (target < now) target.setDate(target.getDate() + 1);

    setTimeout(() => {
      if (Notification.permission === "granted") {
        new Notification("Hydrate — time to drink", {
          body: "Take a sip of water."
        });
      }
    }, target - now);
  }

  /* ------------------ Events ------------------ */

  addBtn.addEventListener("click", () => {
    addEntry(Number(amountInput.value));
    amountInput.value = "";
  });

  saveProfile.addEventListener("click", () => {
    const newName = displayName.value || profile.name;
    const newGoal = Number(dailyGoal.value) || profile.goal;
    profile.name = newName; profile.goal = newGoal; saveAll(); renderToday();
    // update server profile when logged in
    if(currentUser){
      supabase.from('users').update({ username: profile.name, daily_goal_ml: profile.goal }).eq('id', profile.id).then(({error})=>{ if(error) console.warn('update profile failed', error); });
    }
  });

  addReminder.addEventListener("click", () => {
    const t = reminderTime.value;
    if (!t) return;
    reminders.push({ time: t });
    saveAll();
    renderReminders();
    reminderTime.value = "";
  });

  // friend search/send UI
  qs('#searchFriend').addEventListener('click', async ()=>{
    const term = qs('#friendSearch').value.trim();
    const ul = qs('#searchResults'); ul.innerHTML='';
    if(!term) return;
    try{
      const results = await searchUsers(term);
      if(!results || !results.length){ ul.innerHTML = '<li class="small">No users found.</li>'; return; }
      results.forEach(u=>{
        const li = document.createElement('li');
        const isSelf = currentUser && currentUser.id === u.id;
        li.innerHTML = `<div><strong>${u.username}</strong><div class="small">${u.id}</div></div><div><button class="send" data-id="${u.id}" ${isSelf? 'disabled':''}>Send</button></div>`;
        const btn = li.querySelector('.send');
        if(!isSelf) btn.addEventListener('click', ()=> sendFriendRequest(u.id));
        else btn.title = 'This is you';
        ul.appendChild(li);
      });
    }catch(err){
      console.warn('search error', err);
      ul.innerHTML = `<li class="small">Search failed: ${err.message || 'no details'}. This may be due to database Row-Level Security blocking access to user rows. Try signing in or check RLS policies.</li>`;
    }
  });

  /* ------------------ Tabs: Feed / Friends / Profile ------------------ */

  const tabs = qsa('.tab');
  const panels = qsa('.panel');

  function showTab(name){
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    panels.forEach(p => p.classList.toggle('hidden', p.id !== name));
    // refresh data for specific tabs
    if(name === 'friends'){
      loadPendingRequests();
      loadAcceptedFriends();
      renderFriends();
    }
    if(name === 'profile'){
      displayName.value = profile.name;
      dailyGoal.value = profile.goal;
      renderReminders();
    }
    if(name === 'feed'){
      renderEntries(); renderToday(); renderHistory();
    }
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => showTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTab(t.dataset.tab); } });
  });

  /* ------------------ Export / Import ------------------ */

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* ------------------ Chart tooltip helper & CSV export ------------------ */

  function createChartTooltip() {
    let tip = document.querySelector('.chart-tooltip');
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    tip.style.position = 'fixed';
    tip.style.pointerEvents = 'none';
    tip.style.padding = '6px 8px';
    tip.style.background = 'rgba(0,0,0,0.85)';
    tip.style.color = '#fff';
    tip.style.fontSize = '13px';
    tip.style.borderRadius = '6px';
    tip.style.zIndex = 9999;
    tip.style.transform = 'translate(-50%, -120%)';
    tip.style.transition = 'opacity 160ms ease';
    tip.style.opacity = '0';
    document.body.appendChild(tip);
    return tip;
  }

  function exportWeeklyCsv() {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const total = sumForDate(entries, key);
      const pct = Math.round((total / (profile.goal || 1)) * 100) || 0;
      days.push({ date: key, label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), total, pct });
    }
    const lines = ['date,label,total_ml,percent_of_goal'];
    days.forEach(d => lines.push(`${d.date},"${d.label}",${d.total},${d.pct}`));
    const csv = lines.join('\n');
    const fname = 'hydrate-week-' + (new Date().toISOString().slice(0,10)) + '.csv';
    downloadFile(fname, csv);
  }

  async function exportData() {
    const payload = {
      exported_at: new Date().toISOString(),
      profile,
      local_entries: entries,
      presets,
      reminders
    };

    // If logged in, attempt to include server-side data
    if (currentUser) {
      try {
        const [{ data:serverProfile }, { data:serverEntries }, { data:friendRows }] = await Promise.all([
          supabase.from('users').select('*').eq('id', currentUser.id).single(),
          supabase.from('water_logs').select('*').eq('user_id', currentUser.id),
          supabase.from('friendships').select('*').or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        ]);
        payload.server_profile = serverProfile || null;
        payload.server_entries = serverEntries || [];
        payload.server_friendships = friendRows || [];
      } catch (e) {
        console.warn('exportData server fetch failed', e);
      }
    }

    downloadFile('hydrate-export-' + (currentUser?.id || 'local') + '.json', JSON.stringify(payload, null, 2));
  }

  async function importDataFile(file) {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      // merge basic structures into local state
      if (obj.profile) { profile = Object.assign({}, profile, obj.profile); }
      if (Array.isArray(obj.local_entries)) { entries = entries.concat(obj.local_entries || []); }
      if (Array.isArray(obj.server_entries)) { entries = entries.concat(obj.server_entries.map(r=>({ id: r.id || uid(), amount: r.amount_ml || r.amount, ts: r.logged_at || r.ts }))); }
      if (Array.isArray(obj.presets)) { presets = Array.from(new Set([...(presets||[]), ...(obj.presets||[])])); }
      if (Array.isArray(obj.reminders)) { reminders = Array.from(new Set([...(reminders||[]), ...(obj.reminders||[])])); }
      saveAll();
      renderPresets(); renderEntries(); renderToday(); renderReminders();
      // If logged in, optionally push imported profile or entries to Supabase (ask user)
      if (currentUser) {
        if (confirm('You are signed in. Do you want to push imported server/profile entries to your Supabase project?')) {
          // update profile
          if (obj.profile) await supabase.from('users').upsert([{ id: currentUser.id, username: obj.profile.name || obj.profile.username, daily_goal_ml: obj.profile.goal || obj.profile.daily_goal_ml }]);
          // insert entries (skip duplicates by id if present)
          const toInsert = (obj.local_entries||[]).map(e=>({ user_id: currentUser.id, amount_ml: e.amount || e.amount_ml, logged_at: e.ts || e.logged_at })).slice(0,500);
          if(toInsert.length) await supabase.from('water_logs').insert(toInsert);
        }
      }
      alert('Import complete');
    } catch (e) { console.warn('import failed', e); alert('Import failed'); }
  }

  exportMeBtn?.addEventListener('click', exportData);
  importMeBtn?.addEventListener('click', ()=> importFile?.click());
  importFile?.addEventListener('change', (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(f) importDataFile(f); importFile.value = ''; });
  qs('#exportWeekCsv')?.addEventListener('click', exportWeeklyCsv);


  /* ------------------ Init ------------------ */

  displayName.value = profile.name;
  dailyGoal.value = profile.goal;

  // initialize auth-aware state
  (async function initAuth() {
    try {
      const { data } = await supabase.auth.getUser();
      currentUser = data?.user || null;
    } catch (e) {
      currentUser = null;
    }
    if (currentUser) {
      profile.id = currentUser.id;
      await fetchProfileFromSupabase();
    }
    await fetchEntriesFromSupabase();
    await loadPendingRequests();
    await loadAcceptedFriends();
    renderToday();
    renderEntries();
    renderPresets();
    renderFriends();
    renderHistory();
    renderReminders();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  })();

})();