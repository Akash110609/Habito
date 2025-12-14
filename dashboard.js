// ---------------- USER LOAD ----------------
let user = JSON.parse(localStorage.getItem("loggedInUser"));
if (!user) window.location.href = "login.html";

document.getElementById("userName").textContent = "👤 " + user.name;
document.getElementById("userEmail").textContent = user.email;


// ---------------- LOGIN SESSION TRACK ----------------
function getTodayNormalizedTs() {
    const d = new Date();
    // normalize to midday local time to avoid timezone day-shifts
    d.setHours(12,0,0,0);
    return d.getTime();
}

let sessionKey = "loginSession_" + user.email;
let currentSession = getTodayNormalizedTs(); // normalized session id for today
localStorage.setItem(sessionKey, currentSession);


// ---------------- SIDEBAR TOGGLE ----------------
document.getElementById("toggleSidebar").onclick = () => {
    document.getElementById("sidebar").classList.toggle("hide");
    document.querySelector(".main").classList.toggle("full");
};


// ---------------- LOGOUT ----------------
document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("loggedInUser");
    window.location.href = "login.html";
};


// ---------------- MOTIVATION ----------------
let motives = [
    "Winter Arc is coming — time to rebuild yourself",
    "Your future self is watching… make them proud.",
    "Discipline > Motivation. Show up daily.",
    "One good habit can change your life.",
    "Consistency is your hidden superpower.",
    "Small daily wins = Massive success."
];
let index = 0;
function showMotive() {
    document.getElementById("motiveText").textContent = motives[index];
    index = (index + 1) % motives.length;
}
showMotive();
setInterval(showMotive, 4000);


// ---------------- HABIT STORAGE ----------------
let habits = JSON.parse(localStorage.getItem("habits_" + user.email)) || [];

// Upgrade old habits to login-based system
habits = habits.map(h => {
    if (!h.sessions) h.sessions = []; // login streak list
    return h;
});

function saveHabits() {
    localStorage.setItem("habits_" + user.email, JSON.stringify(habits));
    // record local update time and mark pending sync
    const t = Date.now();
    localStorage.setItem('local_last_update_' + user.email, String(t));
    localStorage.setItem('pending_sync_' + user.email, '1');
    updateSyncStatus('Local changes (unsynced)');
}

// ---------------- HISTORY (UNDO / REDO) ----------------
const historyKey = 'history_' + user.email;
let historyState = JSON.parse(localStorage.getItem(historyKey) || 'null') || { snapshots: [], index: -1 };
function saveHistory() { localStorage.setItem(historyKey, JSON.stringify(historyState)); }
function updateUndoRedoButtons() {
    const undo = document.getElementById('undoBtn');
    const redo = document.getElementById('redoBtn');
    if (undo) undo.disabled = !(historyState.index > 0);
    if (redo) redo.disabled = !(historyState.index < historyState.snapshots.length - 1);
}
function pushHistorySnapshot(label) {
    try {
        const snap = JSON.parse(JSON.stringify(habits || []));
        // truncate if we undid some actions before a new action
        if (historyState.index < historyState.snapshots.length - 1) historyState.snapshots = historyState.snapshots.slice(0, historyState.index + 1);
        historyState.snapshots.push({ ts: Date.now(), label: label || '', data: snap });
        // limit size
        if (historyState.snapshots.length > 80) historyState.snapshots.shift();
        historyState.index = historyState.snapshots.length - 1;
        saveHistory();
        updateUndoRedoButtons();
    } catch (e) { console.warn('Failed to push history', e); }
}
function applySnapshotAt(idx) {
    if (idx < 0 || idx >= historyState.snapshots.length) return;
    historyState.index = idx;
    const snap = JSON.parse(JSON.stringify(historyState.snapshots[idx].data || []));
    habits = snap;
    saveHabits();
    saveHistory();
    renderHabits(); analyseHabits();
    updateUndoRedoButtons();
}
function undoAction() { if (historyState.index > 0) applySnapshotAt(historyState.index - 1); }
function redoAction() { if (historyState.index < historyState.snapshots.length - 1) applySnapshotAt(historyState.index + 1); }

// expose for console debugging
window._historyState = historyState;

// ensure there is an initial snapshot so undo has a baseline
if (historyState.index === -1) {
    pushHistorySnapshot('Initial');
}

// ---------------- REMINDERS (simple in-page scheduler) ----------------
const remindersKey = 'reminders_' + user.email;
let reminders = JSON.parse(localStorage.getItem(remindersKey) || 'null') || [];
function saveReminders() { localStorage.setItem(remindersKey, JSON.stringify(reminders)); }

// check reminders every 20 seconds; for a simple local reminder system while page is open
let reminderIntervalId = null;
function startReminderLoop() {
    if (reminderIntervalId) clearInterval(reminderIntervalId);
    reminderIntervalId = setInterval(checkReminders, 20 * 1000);
    checkReminders();
}

function checkReminders() {
    if (!reminders || !reminders.length) return;
    const now = new Date();
    const hhmm = now.toTimeString().slice(0,5);
    reminders.forEach(r => {
        // r: { id, enabled, time: 'HH:MM', text, oncePerDay }
        if (!r.enabled) return;
        if (r.lastShown === (new Date()).toISOString().slice(0,10)) return; // already shown today
        if (r.time === hhmm) {
            showNotification(r.text || 'Reminder');
            r.lastShown = (new Date()).toISOString().slice(0,10);
            saveReminders();
        }
    });
}

function showNotification(text) {
    if (window.Notification && Notification.permission === 'granted') {
        try { new Notification('Habito Reminder', { body: String(text) }); } catch (e) {}
    } else {
        // fallback in-page toast
        const t = document.createElement('div'); t.textContent = text; t.style.position='fixed'; t.style.right='18px'; t.style.bottom='18px'; t.style.background='#111'; t.style.color='#fff'; t.style.padding='10px 14px'; t.style.borderRadius='10px'; t.style.zIndex=99999; document.body.appendChild(t);
        setTimeout(()=>t.remove(), 4500);
    }
}

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
}

// Reminders UI (simple modal)
function openRemindersModal() {
    let modal = document.getElementById('reminderModal');
    if (!modal) {
        modal = document.createElement('div'); modal.id = 'reminderModal'; modal.style.position='fixed'; modal.style.left='50%'; modal.style.top='50%'; modal.style.transform='translate(-50%,-50%)'; modal.style.background='#071029'; modal.style.color='#fff'; modal.style.padding='16px'; modal.style.borderRadius='8px'; modal.style.zIndex=99998; modal.style.minWidth='320px';
        modal.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><strong>Reminders</strong><button id='closeRemModal' class='small-btn'>Close</button></div><div id='remList'></div><div style='margin-top:8px; display:flex; gap:8px;'><input id='remTime' type='time' style='flex:1'/><input id='remText' placeholder='Reminder text' style='flex:2'/><button id='addRemBtn' class='small-btn'>Add</button></div>`;
        document.body.appendChild(modal);
        document.getElementById('closeRemModal').onclick = () => modal.remove();
        document.getElementById('addRemBtn').onclick = () => {
            const t = document.getElementById('remTime').value; const txt = document.getElementById('remText').value || 'Reminder';
            if (!t) return alert('Set a time');
            reminders.push({ id: Date.now(), enabled: true, time: t, text: txt, oncePerDay: true }); saveReminders(); renderReminderList();
        };
    }
    renderReminderList();
}

function renderReminderList() {
    const list = document.getElementById('remList'); if (!list) return;
    list.innerHTML = '';
    if (!reminders.length) list.innerHTML = '<div style="padding:8px 0; color:#bcd">No reminders set.</div>';
    reminders.forEach((r, idx) => {
        const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.padding='6px 0';
        row.innerHTML = `<div>${r.time} — ${r.text}</div><div style='display:flex; gap:6px;'><input type='checkbox' ${r.enabled ? 'checked' : ''} id='rchk${r.id}'/><button class='small-btn' id='rdel${r.id}'>Del</button></div>`;
        list.appendChild(row);
        document.getElementById('rchk' + r.id).onchange = (e) => { r.enabled = e.target.checked; saveReminders(); };
        document.getElementById('rdel' + r.id).onclick = () => { reminders.splice(idx,1); saveReminders(); renderReminderList(); };
    });
}

document.getElementById('remindersBtn')?.addEventListener('click', () => { requestNotificationPermission(); openRemindersModal(); startReminderLoop(); });



// ---------------- DUMMY DATA (seed if empty) ----------------
function seedDummyHabits() {
    // if habits exist and not forcing, keep them
    const force = arguments[0] === true;
    if (habits && habits.length && !force) return;

    const names = ["Read React", "Walk 5k", "Meditation", "Learn Geography", "Practice JS", "Sleep Early"];
    const daysBack = 60; // larger window so charts show up/down movement
    const now = new Date();

    const makeSessions = (freqBase) => {
        const sessions = [];
        for (let d = daysBack; d >= 0; d--) {
            // give a small day-to-day fluctuation
            const freq = Math.min(0.95, Math.max(0.05, freqBase + (Math.random() - 0.5) * 0.25));
            if (Math.random() < freq) {
                const day = new Date(now);
                day.setDate(now.getDate() - d);
                // timestamp at midday to normalize
                day.setHours(12, 0, 0, 0);
                sessions.push(day.getTime());
            }
            // sometimes add a second session on same day to slightly vary counts
            if (Math.random() < 0.02) {
                const extra = new Date(now); extra.setDate(now.getDate() - d); extra.setHours(12,0,0,0);
                sessions.push(extra.getTime());
            }
        }
        // dedupe by date
        const seen = new Set();
        return sessions.map(s => String(s)).filter(ts => {
            const dayKey = new Date(Number(ts)).toISOString().slice(0,10);
            if (seen.has(dayKey)) return false; seen.add(dayKey); return true;
        }).map(s => Number(s));
    };

    habits = names.map((n, i) => ({
        name: n,
        // vary frequency so graphs look different
        sessions: makeSessions(0.35 + (i % 4) * 0.15)
    }));

    // make sure at least one habit has today's session to show active state
    const todayTs = getTodayNormalizedTs();
    if (!habits[0].sessions.includes(todayTs)) habits[0].sessions.push(todayTs);

    saveHabits();
}

seedDummyHabits();

// ---------------- SIMULATED BACKEND / SYNC ----------------
function serverKey() { return 'server_habits_' + encodeURIComponent(user.email); }

function simulateServerFetch() {
    // returns a Promise resolving to { habits: [...], lastUpdated }
    return new Promise((resolve) => {
        const delay = 300 + Math.floor(Math.random() * 700);
        setTimeout(() => {
            const raw = localStorage.getItem(serverKey());
            if (!raw) return resolve({ habits: [], lastUpdated: 0 });
            try { const parsed = JSON.parse(raw); return resolve(parsed); } catch (e) { return resolve({ habits: [], lastUpdated: 0 }); }
        }, delay);
    });
}

// ---------------- GOAL RING + CONTROLS ----------------
function getRecentCount(habit, days = 7) {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels.push(d.toISOString().slice(0,10)); }
    return labels.reduce((acc, l) => acc + ((habit.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10)).filter(x => x === l).length > 0 ? 1 : 0), 0);
}

function drawGoalRing(i) {
    const h = habits[i]; if (!h) return;
    const svg = document.getElementById('goalSvg-' + i);
    if (!svg) return;
    const goal = h.goal || 3;
    const count = getRecentCount(h, 7);
    const pct = Math.min(1, goal === 0 ? 0 : count / goal);

    // create elements if missing
    let bg = svg.querySelector('.goal-ring-bg');
    let fg = svg.querySelector('.goal-ring-fg');
    let txt = svg.querySelector('.goal-ring-text');
    const size = 100;
    const cx = 50, cy = 50, r = 40;
    const c = 2 * Math.PI * r;
    if (!bg) {
        bg = document.createElementNS('http://www.w3.org/2000/svg','circle');
        bg.setAttribute('cx', cx); bg.setAttribute('cy', cy); bg.setAttribute('r', r);
        bg.setAttribute('class','goal-ring-bg'); bg.setAttribute('stroke-width','8'); svg.appendChild(bg);
    }
    if (!fg) {
        fg = document.createElementNS('http://www.w3.org/2000/svg','circle');
        fg.setAttribute('cx', cx); fg.setAttribute('cy', cy); fg.setAttribute('r', r);
        fg.setAttribute('class','goal-ring-fg'); fg.setAttribute('stroke-width','8'); fg.setAttribute('stroke-dasharray', String(c)); fg.setAttribute('transform', 'rotate(-90 50 50)'); svg.appendChild(fg);
    }
    if (!txt) {
        txt = document.createElementNS('http://www.w3.org/2000/svg','text');
        txt.setAttribute('x', cx); txt.setAttribute('y', cy); txt.setAttribute('class','goal-ring-text'); txt.setAttribute('text-anchor','middle'); txt.setAttribute('dominant-baseline','middle'); txt.setAttribute('fill','#fff'); txt.setAttribute('font-size','12'); svg.appendChild(txt);
    }

    // set styles and progress (animate offset via CSS transition)
    const offset = Math.round(c * (1 - pct));
    // remember previous count to animate number
    const prevCount = Number(svg.dataset.prevCount || 0);
    svg.dataset.prevCount = String(count);
    fg.setAttribute('stroke-dashoffset', String(offset));
    fg.setAttribute('stroke', pct >= 1 ? '#10b981' : '#2563eb');

    // animated counter for center text
    (function animateNumberText(el, from, to, duration = 600) {
        const start = performance.now();
        requestAnimationFrame(function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const val = Math.round(from + (to - from) * t);
            el.textContent = val + '/' + goal;
            if (t < 1) requestAnimationFrame(tick);
        });
    })(txt, prevCount, count, 600);

    // update displayed goal value
    const gv = document.getElementById('goalVal-' + i); if (gv) gv.textContent = goal;

    // pulse animation when reaching or exceeding goal (only if newly achieved)
    const prevPct = Number(svg.dataset.prevPct || 0);
    svg.dataset.prevPct = String(pct);
    if (pct >= 1 && prevPct < 1) {
        svg.classList.add('goal-ring-pulse');
        setTimeout(() => svg.classList.remove('goal-ring-pulse'), 1200);
        // launch confetti near the svg
        const rect = svg.getBoundingClientRect();
        launchConfetti(rect.left + rect.width/2, rect.top + rect.height/2);
    }

    // tooltip: show recent counted dates on hover
    let tooltip = document.getElementById('goalTooltip-' + i);
    if (!tooltip) {
        tooltip = document.createElement('div'); tooltip.id = 'goalTooltip-' + i; tooltip.className = 'goal-tooltip'; tooltip.style.display = 'none'; document.body.appendChild(tooltip);
    }
    const recentDates = [];
    for (let d = 6; d >= 0; d--) {
        const day = new Date(); day.setDate(day.getDate() - d); const key = day.toISOString().slice(0,10);
        if ((h.sessions||[]).map(ts => new Date(Number(ts)).toISOString().slice(0,10)).includes(key)) recentDates.push(key);
    }
    tooltip.innerHTML = `<strong>${h.name}</strong><br/>Recent days: ${recentDates.length ? recentDates.join(', ') : 'None'}`;
    svg.onmouseenter = (e) => {
        tooltip.style.display = 'block';
        const r = svg.getBoundingClientRect();
        tooltip.style.left = (r.right + 8) + 'px'; tooltip.style.top = (r.top) + 'px';
    };
    svg.onmousemove = (e) => {
        const r = svg.getBoundingClientRect(); tooltip.style.left = (r.right + 8) + 'px'; tooltip.style.top = (r.top) + 'px';
    };
    svg.onmouseleave = () => { tooltip.style.display = 'none'; };
}

// ---------------- SMART GOAL SUGGESTIONS ----------------
function computeGoalSuggestion(habit, windowDays = 21) {
    // suggest goal = round( recent average presence over window )
    const presence = getHabitDailyPresence(habit, windowDays);
    const avg = mean(presence) * 7; // convert to days/week
    // trend: compare last half vs first half of window
    const half = Math.floor(windowDays/2);
    const first = presence.slice(0, half); const last = presence.slice(half);
    const firstAvg = mean(first) * 7; const lastAvg = mean(last) * 7;
    let suggested = Math.max(0, Math.round(avg));
    // if improving, nudge up by 1, if falling, nudge down
    if (lastAvg - firstAvg >= 0.6) suggested = Math.max(1, suggested + 1);
    if (firstAvg - lastAvg >= 0.8) suggested = Math.max(0, suggested - 1);
    return { suggested, avg: Math.round(avg*10)/10, trend: Math.round((lastAvg - firstAvg)*10)/10 };
}

function renderGoalSuggestion(i) {
    const h = habits[i]; if (!h) return null;
    const boxId = 'goalSugBox-' + i;
    let box = document.getElementById(boxId);
    if (!box) {
        const parent = document.getElementById('goalVal-' + i)?.parentElement?.parentElement;
        if (!parent) return null;
        box = document.createElement('div'); box.id = boxId; box.style.marginTop = '6px'; parent.appendChild(box);
    }
    const info = computeGoalSuggestion(h);
    if (!info) { box.innerHTML = ''; return; }
    box.innerHTML = `<div style="font-size:13px; color:#cfe;">Suggest <strong>${info.suggested}</strong>/wk · avg ${info.avg}/wk <button class='small-btn' id='applySug-${i}'>Apply</button></div>`;
    document.getElementById('applySug-' + i).onclick = () => {
        pushHistorySnapshot('Apply goal suggestion: ' + h.name);
        h.goal = info.suggested; saveHabits(); renderHabits(); analyseHabits();
    };
    return box;
}

function setGoal(i) {
    const h = habits[i]; if (!h) return;
    const v = prompt('Set weekly goal (days per week):', h.goal || 3);
    if (v === null) return; const n = parseInt(v); if (Number.isNaN(n) || n < 0) { alert('Invalid number'); return; }
    h.goal = n; saveHabits(); renderHabits(); analyseHabits();
}

function undoToday(i) {
    const h = habits[i]; if (!h) return;
    const todayKey = new Date(getTodayNormalizedTs()).toISOString().slice(0,10);
    const before = h.sessions.length;
    pushHistorySnapshot('Undo today: ' + (h.name || ''));
    h.sessions = (h.sessions || []).filter(ts => new Date(Number(ts)).toISOString().slice(0,10) !== todayKey);
    if (h.sessions.length !== before) { saveHabits(); renderHabits(); analyseHabits(); }
}

// redraw goal rings after render
function refreshGoalRings() {
    habits.forEach((h, i) => { try { drawGoalRing(i); } catch (e) {} });
}

// confetti launcher (simple DOM-based)
function launchConfetti(x, y) {
    const colors = ['#f97316','#10b981','#60a5fa','#f472b6','#facc15'];
    const count = 18;
    for (let i=0;i<count;i++) {
        const el = document.createElement('div'); el.className = 'confetti-piece';
        el.style.background = colors[Math.floor(Math.random()*colors.length)];
        const offsetX = (Math.random()*80) - 40;
        el.style.left = (x + offsetX) + 'px'; el.style.top = y + 'px';
        el.style.transform = `translateY(0) rotate(${Math.random()*360}deg)`;
        document.body.appendChild(el);
        // random horizontal shift using CSS left change over time
        const dx = (Math.random()*120) - 60;
        // animate using requestAnimationFrame simple lerp
        const dur = 1100 + Math.random()*400;
        const start = performance.now();
        const startTop = y;
        (function anim(now){
            const t = (now - start) / dur;
            if (t >= 1) { el.remove(); return; }
            const ny = startTop + t * 420;
            const nx = x + offsetX + dx * t;
            el.style.left = nx + 'px'; el.style.top = ny + 'px';
            el.style.transform = `rotate(${360 * t}deg)`;
            requestAnimationFrame(anim);
        })(start + 16);
    }
}

// ensure rings refresh after rendering charts
const _origRenderHabits = renderHabits;
renderHabits = function() { _origRenderHabits(); setTimeout(refreshGoalRings, 50); };

function simulateServerSave(payload) {
    return new Promise((resolve, reject) => {
        const delay = 300 + Math.floor(Math.random() * 700);
        setTimeout(() => {
            try {
                const toStore = { habits: payload.habits || [], lastUpdated: payload.lastUpdated || Date.now() };
                localStorage.setItem(serverKey(), JSON.stringify(toStore));
                resolve(toStore);
            } catch (err) { reject(err); }
        }, delay);
    });
}

// wire undo/redo buttons
document.getElementById('undoBtn')?.addEventListener('click', () => undoAction());
document.getElementById('redoBtn')?.addEventListener('click', () => redoAction());
updateUndoRedoButtons();


function updateSyncStatus(txt) {
    const el = document.getElementById('syncStatus');
    if (el) el.textContent = txt;
}

function updateLastSync(ts) {
    const el = document.getElementById('lastSync');
    if (!el) return;
    if (!ts) { el.textContent = ''; return; }
    const d = new Date(Number(ts));
    el.textContent = 'Last sync: ' + d.toLocaleString();
}

function mergeHabits(local, server) {
    // merge by habit name, union sessions (dedupe by date string)
    const map = new Map();
    const pushHabit = (h) => {
        const name = (h.name || 'Unnamed').trim();
        if (!map.has(name)) map.set(name, new Set());
        const s = map.get(name);
        (h.sessions || []).forEach(ts => {
            const day = new Date(Number(ts)); day.setHours(12,0,0,0);
            s.add(day.toISOString().slice(0,10));
        });
    };
    (local || []).forEach(pushHabit);
    (server || []).forEach(pushHabit);

    const out = [];
    for (const [name, set] of map.entries()) {
        const sessions = Array.from(set).map(d => {
            const x = new Date(d + 'T12:00:00'); return x.getTime();
        }).sort((a,b) => a - b);
        out.push({ name, sessions });
    }
    return out;
}

async function syncWithServer() {
    try {
        updateSyncStatus('Syncing...');
        const server = await simulateServerFetch();
        const localLast = Number(localStorage.getItem('local_last_update_' + user.email) || '0');
        const serverLast = Number(server.lastUpdated || 0);

        if (serverLast === 0 && localLast === 0) {
            // nothing anywhere — save local empty to server
            await simulateServerSave({ habits, lastUpdated: Date.now() });
            localStorage.setItem('pending_sync_' + user.email, '0');
            updateSyncStatus('Synced'); updateLastSync(Date.now());
            return true;
        }

        // if server is newer and local unchanged, pull
        if (serverLast > localLast) {
            // adopt server copy
            habits = (server.habits || []).map(h => ({ name: h.name || 'Unnamed', sessions: h.sessions || [] }));
            saveHabits();
            localStorage.setItem('pending_sync_' + user.email, '0');
            updateSyncStatus('Pulled from server'); updateLastSync(serverLast);
            renderHabits(); analyseHabits();
            return true;
        }

        // if local is newer, push merged state
        if (localLast >= serverLast) {
            const merged = mergeHabits(habits, server.habits || []);
            const payload = { habits: merged, lastUpdated: Date.now() };
            await simulateServerSave(payload);
            // adopt merged locally
            habits = merged;
            saveHabits();
            localStorage.setItem('pending_sync_' + user.email, '0');
            updateSyncStatus('Pushed to server'); updateLastSync(payload.lastUpdated);
            renderHabits(); analyseHabits();
            return true;
        }

        updateSyncStatus('Up to date');
        updateLastSync(Math.max(localLast, serverLast));
        localStorage.setItem('pending_sync_' + user.email, '0');
        return true;
    } catch (err) {
        updateSyncStatus('Sync failed');
        return false;
    }
}

// Auto-sync support
let autoSyncIntervalId = null;
function setAutoSync(enabled) {
    if (autoSyncIntervalId) { clearInterval(autoSyncIntervalId); autoSyncIntervalId = null; }
    if (enabled) {
        autoSyncIntervalId = setInterval(() => { syncWithServer(); }, 30 * 1000);
        updateSyncStatus('Auto-sync on');
    } else {
        updateSyncStatus('Auto-sync off');
    }
}



// ---------------- RENDER HABITS ----------------
let container = document.getElementById("habitContainer");

// ---------------- DRAG & DROP REORDER ----------------
let dragSrcIndex = null;
function handleDragStart(e) {
    const el = e.currentTarget;
    el.classList.add('dragging');
    dragSrcIndex = Number(el.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
}
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget;
    target.classList.add('drag-over');
}
function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}
function handleDrop(e) {
    e.stopPropagation();
    const target = e.currentTarget;
    target.classList.remove('drag-over');
    const destIndex = Number(target.dataset.index);
    if (dragSrcIndex === null || isNaN(destIndex) || dragSrcIndex === destIndex) return;
    // perform reorder
    pushHistorySnapshot('Reorder');
    const item = habits.splice(dragSrcIndex, 1)[0];
    habits.splice(destIndex, 0, item);
    saveHabits(); renderHabits(); analyseHabits();
}
function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    dragSrcIndex = null;
}

let miniCharts = [];

// timeline chart state
let timelineChart = null;
let timelineSelectedRange = null; // { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
let timelineSelecting = false;
let timelineStartX = 0;


function renderHabits() {
    // refresh today's normalized session in case the day changed while page open
    currentSession = getTodayNormalizedTs();
    container.innerHTML = "";

    // destroy previous mini charts
    miniCharts.forEach(c => c && c.destroy());
    miniCharts = [];

    habits.forEach((h, i) => {

        let alreadyDoneThisSession = h.sessions.includes(currentSession);

        let card = document.createElement("div");
        card.className = "habit-card";

        const currentStreak = computeCurrentStreak(h);
        const longest = getLongestStreak(h);
        const weeklyPercent = getWeeklyCompletionPercent(h, 7);
        const lastActivity = h.sessions.length ? new Date(Number(h.sessions[h.sessions.length-1])).toLocaleDateString() : 'Never';

        card.innerHTML = `
            <div class="habit-title" onclick="showHabitDetails(${i})">${h.name}</div>

            <div class="track-row">
                <span>Today's Login:</span>
                <input type="checkbox"
                    ${alreadyDoneThisSession ? "checked disabled" : ""}
                    onclick="markThisLogin(${i})">
            </div>

            <div class="track-row">
                <span>Streak:</span>
                <span>${currentStreak} 🔥</span>
            </div>

            <div class="track-row">
                <span>Longest:</span>
                <span>${longest} days</span>
            </div>

            <div class="track-row">
                <span>Weekly:</span>
                <span>${weeklyPercent}%</span>
            </div>

            <div class="track-row">
                <span>Last Activity:</span>
                <span>${lastActivity}</span>
            </div>
                        <div style="margin-top:10px">
                                        <canvas id="miniChart-${i}" class="miniChart" width="260" height="60"></canvas>
                        </div>

                                    <div class="goal-area">
                                        <svg id="goalSvg-${i}" viewBox="0 0 100 100" width="110" height="110" aria-hidden="true"></svg>
                                        <div class="goal-controls">
                                            <div>Weekly goal: <strong id="goalVal-${i}">${h.goal || 3}</strong></div>
                                            <div style="display:flex; gap:6px;">
                                                <button class="small-btn" onclick="markThisLogin(${i})">Mark Today</button>
                                                <button class="small-btn" onclick="undoToday(${i})">Undo Today</button>
                                                <button class="small-btn" onclick="setGoal(${i})">Set Goal</button>
                                            </div>
                                        </div>
                                    </div>

                        <button class="delete-btn" onclick="deleteHabit(${i})">Delete</button>
        `;

        // attach index for drag handlers
        card.dataset.index = i;
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);
        container.appendChild(card);
        // after adding card to DOM, create its mini chart
        setTimeout(() => {
            const mini = createMiniChartForHabit(h, i, 14);
            if (mini) miniCharts.push(mini);
        }, 0);

        // render smart suggestion under goal area
        setTimeout(() => { try { renderGoalSuggestion(i); } catch (e) {} }, 40);

            // make title clickable to open details
            // (we add after append so element exists)
            setTimeout(() => {
                const titleEl = container.querySelectorAll('.habit-card')[i].querySelector('.habit-title');
                if (titleEl) titleEl.style.cursor = 'pointer';
            }, 0);
    });
}

// ---------------- TIMELINE CHART + BRUSH ----------------
function buildTimelineData(daysBack = 180) {
    const labels = [];
    const counts = [];
    for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0,10);
        labels.push(key);
        const count = habits.reduce((s,h)=> s + ((h.sessions||[]).map(ts=>new Date(Number(ts)).toISOString().slice(0,10)).filter(x=>x===key).length), 0);
        counts.push(count);
    }
    return { labels, counts };
}

function initOrUpdateTimeline() {
    const canvas = document.getElementById('timelineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = buildTimelineData(180);
    if (timelineChart) {
        timelineChart.data.labels = data.labels;
        timelineChart.data.datasets[0].data = data.counts;
        timelineChart.update();
        return;
    }
    timelineChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: data.labels, datasets: [{ label: 'Sessions', data: data.counts, backgroundColor: 'rgba(99,102,241,0.6)' }] },
        options: {
            plugins: { legend: { display: false }, zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
            maintainAspectRatio: false,
        }
    });

    // selection overlay element
    const overlay = document.getElementById('timelineSelection');
    const rect = canvas.getBoundingClientRect(); overlay.style.display = 'none'; overlay.style.height = rect.height + 'px'; overlay.style.top = '0px'; overlay.style.pointerEvents = 'none';

    // helper to convert pageX to label index
    function pageXToIndex(px) {
        const r = canvas.getBoundingClientRect();
        const left = r.left; const right = r.right; const w = right - left;
        const clamped = Math.max(left, Math.min(right, px));
        const ratio = (clamped - left) / w;
        const idx = Math.floor(ratio * timelineChart.data.labels.length);
        return Math.max(0, Math.min(timelineChart.data.labels.length - 1, idx));
    }

    function updateOverlayFromPixels(x1, x2) {
        const r = canvas.getBoundingClientRect();
        const left = Math.min(x1, x2) - r.left; const width = Math.abs(x2 - x1);
        overlay.style.display = 'block'; overlay.style.left = (left) + 'px'; overlay.style.width = width + 'px'; overlay.style.height = r.height + 'px';
    }

    // mouse handlers
    canvas.addEventListener('mousedown', (e) => {
        if (!document.getElementById('selectRangeBtn')?.classList.contains('active')) return;
        timelineSelecting = true; timelineStartX = e.pageX; updateOverlayFromPixels(e.pageX, e.pageX);
    });
    window.addEventListener('mousemove', (e) => {
        if (!timelineSelecting) return; updateOverlayFromPixels(timelineStartX, e.pageX);
    });
    window.addEventListener('mouseup', (e) => {
        if (!timelineSelecting) return; timelineSelecting = false; const i1 = pageXToIndex(timelineStartX); const i2 = pageXToIndex(e.pageX);
        const labels = timelineChart.data.labels; const from = labels[Math.min(i1,i2)]; const to = labels[Math.max(i1,i2)]; timelineSelectedRange = { from, to };
        document.getElementById('selectedRangeLabel').textContent = `Selected: ${from} → ${to}`;
    });

    // update overlay size on resize
    window.addEventListener('resize', () => { const r = canvas.getBoundingClientRect(); overlay.style.height = r.height + 'px'; });
}

function clearTimelineSelection() {
    timelineSelectedRange = null; const overlay = document.getElementById('timelineSelection'); if (overlay) overlay.style.display = 'none'; document.getElementById('selectedRangeLabel').textContent = '';
}

function exportSelectedRangeCSV() {
    if (!timelineSelectedRange) return alert('No range selected');
    const from = timelineSelectedRange.from; const to = timelineSelectedRange.to;
    const rows = [['habit','date']];
    habits.forEach(h => {
        (h.sessions||[]).forEach(ts => {
            const d = new Date(Number(ts)); const key = d.toISOString().slice(0,10);
            if (key >= from && key <= to) rows.push([h.name, key]);
        });
    });
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `habits-range-${from}_${to}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// wire timeline buttons
document.getElementById('selectRangeBtn')?.addEventListener('click', (e) => { const b = e.currentTarget; b.classList.toggle('active'); if (b.classList.contains('active')) { b.textContent = 'Selecting... (drag)'; } else { b.textContent = 'Select Range'; clearTimelineSelection(); } });
document.getElementById('clearRangeBtn')?.addEventListener('click', () => { clearTimelineSelection(); document.getElementById('selectRangeBtn')?.classList.remove('active'); document.getElementById('selectRangeBtn').textContent = 'Select Range'; });
document.getElementById('exportRangeBtn')?.addEventListener('click', () => exportSelectedRangeCSV());



// ---------------- ADD HABIT ----------------
document.getElementById("addHabitBtn").onclick = () => {
    let name = prompt("Enter New Habit:");

    if (name) {
        pushHistorySnapshot('Add habit');
        habits.push({ name, sessions: [] });
        saveHabits();
        renderHabits();
        analyseHabits();
    }
};


// ---------------- MARK FOR THIS LOGIN ----------------
function markThisLogin(i) {
    const todayTs = getTodayNormalizedTs();
    const dateStr = new Date(todayTs).toISOString().slice(0,10);

    // ensure we don't duplicate dates (compare by date string)
    const existingDates = (habits[i].sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10));
    if (!existingDates.includes(dateStr)) {
        pushHistorySnapshot('Mark today: ' + (habits[i].name || '')); 
        habits[i].sessions.push(todayTs);
        // keep sessions sorted
        habits[i].sessions.sort((a,b) => Number(a) - Number(b));
        saveHabits();
        renderHabits();
        analyseHabits();
    }
}


// ---------------- DELETE HABIT ----------------
function deleteHabit(i) {
    pushHistorySnapshot('Delete habit: ' + (habits[i]?.name || '')); 
    habits.splice(i, 1);
    saveHabits();
    renderHabits();
    analyseHabits();
}


// ---------------- ANALYSIS + GRAPH ----------------
let chart;
let dailyChart;

function analyseHabits() {
    let best = document.getElementById("bestHabit");
    let worst = document.getElementById("worstHabit");
    let consistency = document.getElementById("consistencyPercent");

    if (habits.length === 0) {
        best.textContent = "No habits added.";
        worst.textContent = "";
        consistency.textContent = "";
        if (chart) chart.destroy();
        return;
    }

    let sorted = [...habits].sort((a, b) => b.sessions.length - a.sessions.length);

    best.textContent = "🔥 Best Habit: " + sorted[0].name;
    worst.textContent = "⚠️ Weak Habit: " + sorted[sorted.length - 1].name;

    // Additional KPIs
    const totalSessions = habits.reduce((s, h) => s + (h.sessions || []).length, 0);
    const daysWindow = chartRangeDays || 14;
    // compute counts per day across window
    const labels = [];
    for (let i = daysWindow - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels.push(d.toISOString().slice(0,10)); }
    const totalPerDay = labels.map(l => habits.reduce((acc, h) => acc + ((h.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10)).filter(x => x === l).length), 0));
    const avgPerDay = Math.round((totalPerDay.reduce((a,b)=>a+b,0) / labels.length) * 10) / 10;
    const longestOverall = Math.max(...habits.map(h => getLongestStreak(h)), 0);
    const leader = habits.map(h => ({name: h.name, streak: computeCurrentStreak(h)})).sort((a,b)=>b.streak-a.streak)[0];

    // update KPI DOM
    document.getElementById('kpiTotal') && (document.getElementById('kpiTotal').textContent = totalSessions);
    document.getElementById('kpiAvgDay') && (document.getElementById('kpiAvgDay').textContent = avgPerDay);
    document.getElementById('kpiLongest') && (document.getElementById('kpiLongest').textContent = longestOverall);
    document.getElementById('kpiLeader') && (document.getElementById('kpiLeader').textContent = leader ? (leader.name + ' (' + leader.streak + ')') : '-');

    // update advanced analytics
    updateAdvancedAnalytics();


// ---------------- ADVANCED ANALYTICS ----------------
function getHabitDailyPresence(habit, days) {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels.push(d.toISOString().slice(0,10)); }
    return labels.map(l => (habit.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10)).filter(x => x === l).length > 0 ? 1 : 0);
}

function mean(arr) { if (!arr.length) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }
function variance(arr) { if (!arr.length) return 0; const m = mean(arr); return mean(arr.map(x => (x-m)*(x-m))); }

function getPercentChange(a, b) {
    if (b === 0) return a === 0 ? 0 : 100; // from 0 to something => 100%
    return Math.round(((a - b) / b) * 100);
}

function updateAdvancedAnalytics() {
    const windowDays = chartRangeDays || 14;
    const prevWindow = windowDays; // compare previous window of same length

    // Avg Completion: average of per-habit completion percent over windowDays
    const perHabit = habits.map(h => {
        const presence = getHabitDailyPresence(h, windowDays);
        const freq = presence.reduce((a,b)=>a+b,0);
        const percent = Math.round((freq / windowDays) * 100);
        // previous window (days windowDays..2*windowDays-1)
        // build previous presence by shifting dates backwards
        const prevPresence = [];
        for (let i = windowDays - 1 + windowDays; i >= windowDays; i--) {
            const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0,10);
            prevPresence.push((h.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10)).filter(x => x === key).length > 0 ? 1 : 0);
        }
        const prevFreq = prevPresence.reduce((a,b)=>a+b,0);
        const prevPercent = Math.round((prevFreq / windowDays) * 100);
        return { name: h.name, freq, percent, prevPercent, presence };
    });

    const avgCompletion = Math.round(perHabit.reduce((s,h)=>s+h.percent,0) / (perHabit.length || 1));
    document.getElementById('advAvgCompletion') && (document.getElementById('advAvgCompletion').textContent = avgCompletion + '% (avg over ' + windowDays + 'd)');

    // Variance: compute habit with highest variance (in presence)
    const variances = perHabit.map(h => ({ name: h.name, var: Math.round(variance(h.presence) * 1000) / 1000 }));
    const mostVar = variances.slice().sort((a,b)=>b.var-a.var)[0];
    const mostConsistent = variances.slice().sort((a,b)=>a.var-b.var)[0];
    document.getElementById('advVariance') && (document.getElementById('advVariance').textContent = mostVar ? (mostVar.name + ' (var ' + mostVar.var + ')') : '-');

    // Improvement: percent change between recent window and previous window (per habit)
    const improvements = perHabit.map(h => ({ name: h.name, change: getPercentChange(h.percent, h.prevPercent) }));
    const bestImprove = improvements.slice().sort((a,b)=>b.change-a.change)[0];
    document.getElementById('advImprovement') && (document.getElementById('advImprovement').textContent = bestImprove ? (bestImprove.name + ' (' + bestImprove.change + '%)') : '-');

    // Top active day (day of week) across all sessions
    const dow = [0,0,0,0,0,0,0];
    habits.forEach(h => (h.sessions||[]).forEach(ts => { const d = new Date(Number(ts)); dow[d.getDay()]++; }));
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const top = dow.map((c,i)=>({day:names[i],count:c})).sort((a,b)=>b.count-a.count)[0];
    document.getElementById('advTopDay') && (document.getElementById('advTopDay').textContent = top ? (top.day + ' (' + top.count + ')') : '-');

    // Per-habit summary table
    const tableEl = document.getElementById('advTable');
    if (tableEl) {
        tableEl.innerHTML = '';
        const header = document.createElement('div'); header.style.display='flex'; header.style.gap='12px'; header.style.fontWeight='700';
        header.innerHTML = '<div style="width:40%">Habit</div><div style="width:20%">% ('+windowDays+'d)</div><div style="width:20%">Prev %</div><div style="width:20%">Change</div>';
        tableEl.appendChild(header);
        perHabit.forEach(h => {
            const p = improvements.find(x=>x.name===h.name)?.change || 0;
            const row = document.createElement('div'); row.style.display='flex'; row.style.gap='12px'; row.style.padding='6px 0'; row.style.borderTop='1px solid rgba(255,255,255,0.03)';
            row.innerHTML = `<div style="width:40%">${h.name}</div><div style="width:20%">${h.percent}%</div><div style="width:20%">${h.prevPercent}%</div><div style="width:20%">${p}%</div>`;
            tableEl.appendChild(row);
        });
    }
}
    // Consistency: compute average weekly completion percent across habits
    const avgPercent = Math.round(habits.reduce((s, h) => s + getWeeklyCompletionPercent(h, 7), 0) / habits.length);
    consistency.textContent = "📈 Consistency (7d avg): " + avgPercent + "%";

    let ctx = document.getElementById("habitChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: habits.map(h => h.name),
            datasets: [{
                label: "Habit Streak (Login Based)",
                data: habits.map(h => h.sessions.length),
                borderWidth: 2
            }]
        },
        options: {
            scales: { y: { beginAtZero: true } }
        }
    });
    // update daily logins chart
    updateDailyChart();
}


// ---------------- DAILY LOGINS CHART ----------------
function getDailyCounts(days = 14) {
    const allSessions = habits.flatMap(h => h.sessions || []);
    const dates = allSessions.map(ts => new Date(Number(ts)).toISOString().slice(0,10));

    const result = [];
    for (let i = days-1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0,10);
        const count = dates.filter(x => x === key).length;
        result.push({ date: key, count });
    }
    return result;
}

function updateDailyChart() {
    if (!document.getElementById('dailyChart')) return;
    const days = chartRangeDays || 14;
    // create common labels
    const labels = [];
    for (let i = days-1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        labels.push(d.toISOString().slice(0,10));
    }

    const datasets = habits.map((h, idx) => {
        const counts = labels.map(l => (h.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10)).filter(x => x === l).length);
        const palette = ["#2563eb", "#10b981", "#f97316", "#ef4444", "#8b5cf6", "#06b6d4"];
        return {
            label: h.name,
            data: counts,
            fill: false,
            borderColor: palette[idx % palette.length],
            backgroundColor: palette[idx % palette.length],
            tension: 0.3
        };
    });

    // (removed moving-average trend line per user request)

    const ctx = document.getElementById("dailyChart").getContext("2d");
    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            interaction: { mode: 'index', intersect: false },
            stacked: false,
            scales: { y: { beginAtZero: true, precision: 0 } },
            plugins: {
                zoom: {
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
                    pan: { enabled: true, mode: 'x' }
                }
            }
        }
    });
}

function createMiniChartForHabit(habit, index, days = 14) {
    const id = `miniChart-${index}`;
    const el = document.getElementById(id);
    if (!el) return null;
    // create a 7-day mini bar chart by default (compact weekly view)
    const windowDays = Math.min(7, days);
    const labels = [];
    for (let i = windowDays-1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels.push(d.toISOString().slice(0,10)); }
    const counts = labels.map(l => (habit.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10)).filter(x => x === l).length);
    const ctx = el.getContext('2d');
    return new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ data: counts, backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', borderWidth:1 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } }, elements: { point: { radius: 0 } }, maintainAspectRatio: false } });
}


// ---------------- STREAKS CALCULATION ----------------
function computeCurrentStreak(habit) {
    const days = (habit.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10));
    const set = new Set(days);

    let streak = 0;
    // start from today's normalized midday so comparisons match stored session dates
    let d = new Date(getTodayNormalizedTs());
    while (true) {
        const key = d.toISOString().slice(0,10);
        if (set.has(key)) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else break;
    }
    return streak;
}

// chart range (days) control
let chartRangeDays = 14;
function setChartRange(days) {
    chartRangeDays = days;
    analyseHabits();
    renderHabits();
}

// wire up range buttons if present
document.getElementById('range7')?.addEventListener('click', () => setChartRange(7));
document.getElementById('range14')?.addEventListener('click', () => setChartRange(14));
document.getElementById('range30')?.addEventListener('click', () => setChartRange(30));

// attempt to register chartjs-plugin-zoom if present (safe, wrapped)
function tryRegisterZoomPlugin() {
    if (!window.Chart || !Chart.register) return;
    const candidates = ['chartjs_plugin_zoom', 'ChartZoom', 'chartjsPluginZoom', 'zoomPlugin', 'ChartZoomPlugin', 'ChartjsPluginZoom'];
    for (const name of candidates) {
        try {
            const plug = window[name];
            if (plug) {
                try { Chart.register(plug); return; } catch (e) { /* continue */ }
            }
        } catch (e) { /* ignore */ }
    }
    // as last resort, try to find an object with 'zoom' in key and register (very defensive)
    try {
        for (const k in window) {
            if (k.toLowerCase().includes('zoom')) {
                const p = window[k];
                try { Chart.register(p); return; } catch (e) { /* ignore */ }
            }
        }
    } catch (e) { /* ignore */ }
}

// ---------------- EXPORT SHAREABLE REPORT ----------------
function exportInteractiveReport() {
    const data = { user: { name: user.name, email: user.email }, habits, exportedAt: Date.now() };
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Habito Report</title><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><style>body{background:#071029;color:#fff;font-family:Arial,Helvetica,sans-serif;padding:18px}h1{color:#7ee7c6} .card{background:#071833;padding:12px;border-radius:8px;margin:10px 0}</style></head><body><h1>Habito Report — ${user.name}</h1><div id="summary" class="card"></div><div id="charts"></div><script>const REPORT_DATA = ${JSON.stringify(data)}; document.getElementById('summary').innerHTML = '<strong>Exported:</strong> '+ new Date(REPORT_DATA.exportedAt).toLocaleString(); const chartsDiv = document.getElementById('charts'); REPORT_DATA.habits.forEach((h,idx)=>{ const cwrap = document.createElement('div'); cwrap.className='card'; cwrap.innerHTML = '<h3>'+h.name+'</h3><canvas id="rchart'+idx+'" width="600" height="160"></canvas>'; chartsDiv.appendChild(cwrap); const labels=[]; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); labels.push(d.toISOString().slice(0,10)); } const counts = labels.map(l=> (h.sessions||[]).map(ts=>new Date(Number(ts)).toISOString().slice(0,10)).filter(x=>x===l).length); const ctx = document.getElementById('rchart'+idx).getContext('2d'); new Chart(ctx,{type:'bar',data:{labels,datasets:[{data:counts,backgroundColor:'rgba(125,211,252,0.6)'}]},options:{scales:{y:{beginAtZero:true}}}}); });</script></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `habito-report-${user.email.replace(/[^a-z0-9]/gi,'_')}-${Date.now()}.html`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

document.getElementById('exportReportBtn')?.addEventListener('click', () => exportInteractiveReport());


tryRegisterZoomPlugin();

function getLongestStreak(habit) {
    const days = (habit.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10));
    const set = new Set(days);
    if (set.size === 0) return 0;

    // iterate through sorted dates and compute longest consecutive run
    const sorted = Array.from(set).sort();
    let longest = 0;
    let current = 0;
    let prev = null;
    for (const d of sorted) {
        if (!prev) { current = 1; }
        else {
            const pd = new Date(prev); const cd = new Date(d);
            const diff = (cd - pd) / (1000*60*60*24);
            if (diff === 1) current++; else current = 1;
        }
        if (current > longest) longest = current;
        prev = d;
    }
    return longest;
}

function getWeeklyCompletionPercent(habit, windowDays = 7) {
    const today = new Date();
    const start = new Date(); start.setDate(today.getDate() - (windowDays-1)); start.setHours(0,0,0,0);
    const counts = (habit.sessions || []).map(ts => new Date(Number(ts)).toISOString().slice(0,10));
    let doneDays = 0;
    for (let i=0;i<windowDays;i++){
        const d = new Date(start); d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0,10);
        if (counts.includes(key)) doneDays++;
    }
    return Math.round((doneDays / windowDays) * 100);
}


// ---------------- INITIAL LOAD ----------------
renderHabits();
analyseHabits();

// initialize sync UI from stored state
const pending = localStorage.getItem('pending_sync_' + user.email) === '1';
if (pending) updateSyncStatus('Local changes (unsynced)'); else updateSyncStatus('Idle');
const last = localStorage.getItem('last_sync_time_' + user.email) || localStorage.getItem('local_last_update_' + user.email);
if (last) updateLastSync(last);

// wire up sync button and auto-sync toggle
document.getElementById('syncBtn')?.addEventListener('click', () => { syncWithServer(); });
document.getElementById('autoSyncToggle')?.addEventListener('change', (e) => { setAutoSync(e.target.checked); });


// ---------------- EXPORT / IMPORT / RESET ----------------
document.getElementById('exportBtn')?.addEventListener('click', () => {
    const data = JSON.stringify(habits, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'habits-export.json'; a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('importBtn')?.addEventListener('click', () => {
    const file = document.getElementById('importFile');
    if (file) file.click();
});

document.getElementById('importFile')?.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const imported = JSON.parse(reader.result);
            if (Array.isArray(imported)) {
                habits = imported.map(h => ({ name: h.name || 'Unnamed', sessions: h.sessions || [] }));
                saveHabits(); renderHabits(); analyseHabits();
                alert('Import successful');
            } else alert('Invalid file format');
        } catch (err) { alert('Failed to parse file'); }
    };
    reader.readAsText(f);
});

document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (!confirm('Reset all habits? This cannot be undone.')) return;
    habits = [];
    saveHabits(); renderHabits(); analyseHabits();
});

// reset zoom handler (works if zoom plugin loaded)
document.getElementById('resetZoomBtn')?.addEventListener('click', () => {
    if (dailyChart && typeof dailyChart.resetZoom === 'function') {
        try { dailyChart.resetZoom(); }
        catch (e) { /* ignore */ }
    } else if (dailyChart) {
        // fallback: re-render daily chart to restore full range
        updateDailyChart();
    }
});

// seed demo data button
document.getElementById('seedDemoBtn')?.addEventListener('click', () => {
    if (!confirm('Replace habits with demo demo data? This will overwrite current habits.')) return;
    seedDummyHabits(true);
    renderHabits(); analyseHabits();
});

// Export CSV of all habits (habit,date)
function exportCsvAll() {
    const rows = [['habit','date']];
    habits.forEach(h => {
        (h.sessions||[]).forEach(ts => {
            rows.push([h.name, new Date(Number(ts)).toISOString().slice(0,10)]);
        });
    });
    const csv = rows.map(r => r.map(c=> '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'habits.csv'; a.click(); URL.revokeObjectURL(url);
}

document.getElementById('exportCsvBtn')?.addEventListener('click', exportCsvAll);

// export analytics CSV (per-habit metrics)
function exportAnalyticsCsv() {
    const windowDays = chartRangeDays || 14;
    const rows = [['habit','totalSessions','windowPercent','prevWindowPercent','percentChange','longestStreak','currentStreak','variancePresence']];
    habits.forEach(h => {
        const presence = getHabitDailyPresence(h, windowDays);
        const freq = presence.reduce((a,b)=>a+b,0);
        const percent = Math.round((freq/windowDays)*100);
        // prev
        const prevPresence = [];
        for (let i = windowDays - 1 + windowDays; i >= windowDays; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0,10); prevPresence.push((h.sessions||[]).map(ts => new Date(Number(ts)).toISOString().slice(0,10)).filter(x=>x===key).length>0?1:0); }
        const prevFreq = prevPresence.reduce((a,b)=>a+b,0); const prevPercent = Math.round((prevFreq/windowDays)*100);
        const change = getPercentChange(percent, prevPercent);
        const longest = getLongestStreak(h);
        const current = computeCurrentStreak(h);
        const varp = Math.round(variance(presence)*1000)/1000;
        rows.push([h.name, (h.sessions||[]).length, percent, prevPercent, change, longest, current, varp]);
    });
    const csv = rows.map(r => r.map(c=> '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='analytics.csv'; a.click(); URL.revokeObjectURL(url);
}
document.getElementById('exportAnalyticsCsvBtn')?.addEventListener('click', exportAnalyticsCsv);

// show habit details modal
function showHabitDetails(i) {
    const h = habits[i];
    if (!h) return;
    document.getElementById('modalTitle').textContent = 'Details — ' + h.name;
    const body = document.getElementById('modalBody');
    body.innerHTML = '';
    // build editor: add date input + add button
    const editor = document.createElement('div'); editor.style.display='flex'; editor.style.gap='8px'; editor.style.marginBottom='8px';
    const dateIn = document.createElement('input'); dateIn.type='date'; dateIn.style.padding='6px';
    const addBtn = document.createElement('button'); addBtn.textContent='Add Date'; addBtn.className='small-btn';
    editor.appendChild(dateIn); editor.appendChild(addBtn);
    body.appendChild(editor);

    const list = document.createElement('ol');
    const refreshList = () => {
        list.innerHTML = '';
        (h.sessions || []).slice().reverse().forEach(ts => {
            const li = document.createElement('li');
            const d = new Date(Number(ts));
            li.textContent = d.toLocaleString();
            const rem = document.createElement('button'); rem.textContent='Remove'; rem.className='small-btn'; rem.style.marginLeft='8px';
            rem.onclick = () => {
                // remove this session (match by date string)
                const key = new Date(Number(ts)).toISOString().slice(0,10);
                h.sessions = (h.sessions || []).filter(x => new Date(Number(x)).toISOString().slice(0,10) !== key);
                saveHabits(); renderHabits(); analyseHabits(); refreshList();
            };
            li.appendChild(rem); list.appendChild(li);
        });
    };
    if ((h.sessions||[]).length === 0) body.appendChild(document.createTextNode('No sessions yet. Use the date picker to add.'));
    body.appendChild(list); refreshList();

    addBtn.onclick = () => {
        const v = dateIn.value; if (!v) { alert('Pick a date first'); return; }
        // normalize to midday
        const d = new Date(v + 'T12:00:00'); const ts = d.getTime();
        const existing = (h.sessions || []).map(x => new Date(Number(x)).toISOString().slice(0,10));
        const dayKey = d.toISOString().slice(0,10);
        if (existing.includes(dayKey)) { alert('Date already exists'); return; }
        h.sessions.push(ts); h.sessions.sort((a,b)=>Number(a)-Number(b)); saveHabits(); renderHabits(); analyseHabits(); refreshList();
    };

    // set export handler
    const modalExport = document.getElementById('modalExport');
    modalExport.onclick = () => {
        const rows = [['habit','date']];
        (h.sessions||[]).forEach(ts => rows.push([h.name, new Date(Number(ts)).toISOString().slice(0,10)]));
        const csv = rows.map(r => r.map(c=> '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = h.name.replace(/[^a-z0-9]/gi,'_') + '.csv'; a.click(); URL.revokeObjectURL(url);
    };
    document.getElementById('modalClose').onclick = () => { document.getElementById('habitModal').style.display = 'none'; };
    document.getElementById('habitModal').style.display = 'block';

    // render heatmap area below list
    setTimeout(() => {
        renderHabitHeatmap(i);
    }, 50);
}

// ---------------- HEATMAP (calendar) ----------------
function getMonthMatrix(year, month) {
    // returns array of date strings for calendar view (weeks starting Sun)
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // go back to Sunday
    const dates = [];
    for (let i = 0; i < 42; i++) { // 6 weeks
        const d = new Date(start); d.setDate(start.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function renderHabitHeatmap(i, year, month) {
    const h = habits[i];
    if (!h) return;
    const modalBody = document.getElementById('modalBody');
    // remove existing heatmap area if present
    const existing = document.getElementById('habitHeatmap'); if (existing) existing.remove();

    const container = document.createElement('div'); container.id = 'habitHeatmap';
    container.style.marginTop = '12px';

    // header with navigation
    const hdr = document.createElement('div'); hdr.className = 'heatmap-header';
    const nav = document.createElement('div'); nav.className = 'heatmap-nav';
    const prev = document.createElement('button'); prev.textContent = '<';
    const next = document.createElement('button'); next.textContent = '>';
    const label = document.createElement('div'); label.className = 'heatmap-month-label';
    nav.appendChild(prev); nav.appendChild(next);
    hdr.appendChild(label); hdr.appendChild(nav);
    container.appendChild(hdr);

    // determine month/year default to current if not provided
    const now = new Date();
    let yy = (typeof year === 'number') ? year : now.getFullYear();
    let mm = (typeof month === 'number') ? month : now.getMonth();

    const draw = (y, m) => {
        label.textContent = new Date(y, m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
        // clear previous grid
        const prevGrid = container.querySelector('.heatmap-grid'); if (prevGrid) prevGrid.remove();
        const grid = document.createElement('div'); grid.className = 'heatmap-grid';
        const dates = getMonthMatrix(y, m);
        // prepare set of present day keys
        const present = new Set((h.sessions||[]).map(ts => new Date(Number(ts)).toISOString().slice(0,10)));
        dates.forEach(d => {
            const key = d.toISOString().slice(0,10);
            const sq = document.createElement('div'); sq.className = 'heatmap-square';
            const inner = document.createElement('div'); inner.className = 'inner'; inner.textContent = d.getDate();
            // color by month membership
            if (d.getMonth() !== m) { sq.style.opacity = '0.35'; }
            if (present.has(key)) { sq.style.background = '#10b981'; inner.style.color = '#012'; }
            sq.title = key + (present.has(key) ? ' — Completed' : ' — Not completed');
            sq.onclick = () => {
                // toggle session for this date
                if (present.has(key)) {
                    h.sessions = (h.sessions||[]).filter(ts => new Date(Number(ts)).toISOString().slice(0,10) !== key);
                } else {
                    const t = new Date(key + 'T12:00:00').getTime();
                    h.sessions = h.sessions || []; h.sessions.push(t);
                }
                // dedupe and sort
                const seen = new Set();
                h.sessions = (h.sessions||[]).map(x=>String(x)).filter(s=>{ const k=new Date(Number(s)).toISOString().slice(0,10); if(seen.has(k)) return false; seen.add(k); return true; }).map(s=>Number(s)).sort((a,b)=>a-b);
                saveHabits(); renderHabits(); analyseHabits();
                // re-render heatmap to reflect change
                renderHabitHeatmap(i, y, m);
            };
            sq.appendChild(inner); grid.appendChild(sq);
        });
        container.appendChild(grid);
        // legend
        const legend = document.createElement('div'); legend.className = 'heatmap-legend';
        legend.innerHTML = '<div>Less</div><div class="box" style="background:#071029"></div><div class="box" style="background:#8b5cf6"></div><div class="box" style="background:#10b981"></div><div>More</div>';
        container.appendChild(legend);
    };

    prev.onclick = () => { mm--; if (mm < 0) { mm = 11; yy--; } draw(yy, mm); };
    next.onclick = () => { mm++; if (mm > 11) { mm = 0; yy++; } draw(yy, mm); };

    // initial draw
    draw(yy, mm);

    modalBody.appendChild(container);
};

// ensure charts reflect initial state
updateDailyChart();
