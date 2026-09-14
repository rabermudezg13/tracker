(() => {
  'use strict';

  const STORAGE_KEY = 'dailyTalentTracker.v1';
  const BUILTIN_TASKS = [
    { id: 'badges', name: 'Badges', goal: 1, kind: 'count' },
    { id: 'upload-drug-test', name: 'Upload Drug Test', goal: 1, kind: 'count' },
    { id: 'activate-talents', name: 'Activate Talents', goal: 1, kind: 'count' },
    { id: 'call-talents', name: 'Call Talents', goal: 15, kind: 'count' },
    { id: 'text-talents', name: 'Text Talents', goal: 15, kind: 'count' },
    { id: 'check-email', name: 'Check Email', goal: 1, kind: 'check' },
    { id: 'send-welcome-email', name: 'Send Welcome Email', goal: 1, kind: 'count' }
  ];

  const state = loadState();
  let selectedDate = startOfDay(new Date());
  let viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  let toastTimer;

  const els = {
    taskList: document.querySelector('#taskList'),
    selectedDateLong: document.querySelector('#selectedDateLong'),
    selectedDateHeading: document.querySelector('#selectedDateHeading'),
    dailyProgressPct: document.querySelector('#dailyProgressPct'),
    dailyProgressText: document.querySelector('#dailyProgressText'),
    progressRing: document.querySelector('#progressRing'),
    saveStatus: document.querySelector('#saveStatus'),
    calendarHeading: document.querySelector('#calendarHeading'),
    calendarGrid: document.querySelector('#calendarGrid'),
    monthCompletion: document.querySelector('#monthCompletion'),
    currentStreak: document.querySelector('#currentStreak'),
    perfectDays: document.querySelector('#perfectDays'),
    actionsDone: document.querySelector('#actionsDone'),
    miniTotals: document.querySelector('#miniTotals'),
    badgesGrid: document.querySelector('#badgesGrid'),
    taskDialog: document.querySelector('#taskDialog'),
    taskForm: document.querySelector('#taskForm'),
    taskName: document.querySelector('#taskName'),
    taskGoal: document.querySelector('#taskGoal'),
    toast: document.querySelector('#toast')
  };

  init();

  function init() {
    bindEvents();
    renderAll();
    registerServiceWorker();
  }

  function defaultState() {
    return { version: 1, recurringTasks: [], days: {} };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultState();
      return { ...defaultState(), ...parsed };
    } catch { return defaultState(); }
  }

  function persist(message = 'Saved ✓') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    els.saveStatus.textContent = message;
    els.saveStatus.style.opacity = '1';
    window.clearTimeout(persist._t);
    persist._t = window.setTimeout(() => { els.saveStatus.style.opacity = '.7'; }, 900);
  }

  function bindEvents() {
    document.querySelector('#todayBtn').addEventListener('click', () => selectDate(new Date()));
    document.querySelector('#prevDayBtn').addEventListener('click', () => shiftSelectedDay(-1));
    document.querySelector('#nextDayBtn').addEventListener('click', () => shiftSelectedDay(1));
    document.querySelector('#prevMonthBtn').addEventListener('click', () => changeViewMonth(-1));
    document.querySelector('#nextMonthBtn').addEventListener('click', () => changeViewMonth(1));
    document.querySelector('#addTaskBtn').addEventListener('click', openTaskDialog);
    document.querySelector('#addTaskInlineBtn').addEventListener('click', openTaskDialog);
    document.querySelector('#cancelDialogBtn').addEventListener('click', closeTaskDialog);
    document.querySelector('#clearTaskName').addEventListener('click', () => { els.taskName.value = ''; els.taskName.focus(); });
    document.querySelector('#exportBtn').addEventListener('click', exportData);
    document.querySelector('#importInput').addEventListener('change', importData);

    els.taskForm.addEventListener('submit', (event) => { event.preventDefault(); addCustomTask(); });
    els.taskDialog.addEventListener('click', (event) => {
      const rect = els.taskDialog.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) closeTaskDialog();
    });
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const next = JSON.parse(event.newValue);
          Object.keys(state).forEach(k => delete state[k]);
          Object.assign(state, defaultState(), next);
          renderAll();
          showToast('Updated from another tab');
        } catch {}
      }
    });
  }

  function getDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function isSameDay(a, b) { return getDateKey(a) === getDateKey(b); }
  function isWorkday(date) { const day = date.getDay(); return day !== 0 && day !== 6; }

  function dayRecord(date) {
    const key = getDateKey(date);
    if (!state.days[key]) state.days[key] = { tasks: {}, customTasks: [] };
    if (!state.days[key].tasks) state.days[key].tasks = {};
    if (!state.days[key].customTasks) state.days[key].customTasks = [];
    return state.days[key];
  }

  function tasksForDate(date) {
    const day = dayRecord(date);
    const recurring = state.recurringTasks.filter(task => task.repeat !== 'workdays' || isWorkday(date));
    const merged = [...BUILTIN_TASKS, ...recurring, ...day.customTasks];
    const seen = new Set();
    return merged.filter(task => { if (seen.has(task.id)) return false; seen.add(task.id); return true; });
  }

  function taskProgress(date, task) {
    const day = dayRecord(date);
    const saved = day.tasks[task.id] || {};
    const count = Number(saved.count || 0);
    const goal = Math.max(1, Number(task.goal || 1));
    const completed = task.kind === 'check' ? Boolean(saved.completed) : Boolean(saved.completed) || count >= goal;
    return { count, goal, completed };
  }

  function renderAll() { renderDateHeader(); renderTasks(); renderCalendar(); renderStats(); renderBadges(); }

  function renderDateHeader() {
    const today = startOfDay(new Date());
    els.selectedDateLong.textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(selectedDate);
    els.selectedDateHeading.textContent = isSameDay(selectedDate, today) ? 'Today' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: selectedDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined }).format(selectedDate);
    const tasks = tasksForDate(selectedDate);
    const completed = tasks.filter(t => taskProgress(selectedDate, t).completed).length;
    const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    els.dailyProgressPct.textContent = `${pct}%`;
    els.dailyProgressText.textContent = `${completed} of ${tasks.length} actions`;
    els.progressRing.style.setProperty('--progress', `${pct * 3.6}deg`);
  }

  function renderTasks() {
    const tasks = tasksForDate(selectedDate);
    els.taskList.innerHTML = '';
    tasks.forEach(task => {
      const progress = taskProgress(selectedDate, task);
      const row = document.createElement('article');
      row.className = `task-row${progress.completed ? ' completed' : ''}`;
      row.dataset.taskId = task.id;
      const check = document.createElement('button');
      check.type = 'button'; check.className = 'task-check';
      check.setAttribute('aria-label', `${progress.completed ? 'Mark incomplete' : 'Mark complete'}: ${task.name}`);
      check.setAttribute('aria-pressed', String(progress.completed)); check.textContent = progress.completed ? '✓' : '';
      check.addEventListener('click', () => toggleTask(task));
      const info = document.createElement('div');
      const title = document.createElement('div'); title.className = 'task-title'; title.textContent = task.name;
      const meta = document.createElement('div'); meta.className = 'task-meta';
      meta.textContent = task.kind === 'check' ? (progress.completed ? 'Completed' : 'Checklist item') : `${progress.count} / ${progress.goal}${progress.completed ? ' · Goal reached' : ' · Daily goal'}`;
      info.append(title, meta);
      const controls = document.createElement('div'); controls.className = 'task-controls';
      if (task.kind !== 'check') {
        const countControl = document.createElement('div'); countControl.className = 'count-control';
        const minus = document.createElement('button'); minus.type = 'button'; minus.className = 'count-button'; minus.setAttribute('aria-label', `Decrease ${task.name}`); minus.textContent = '−'; minus.addEventListener('click', () => adjustCount(task, -1));
        const value = document.createElement('span'); value.className = 'count-value'; value.textContent = String(progress.count);
        const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'count-button'; plus.setAttribute('aria-label', `Increase ${task.name}`); plus.textContent = '+'; plus.addEventListener('click', () => adjustCount(task, 1));
        countControl.append(minus, value, plus); controls.append(countControl);
      }
      if (!BUILTIN_TASKS.some(t => t.id === task.id)) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button subtle more-button'; remove.setAttribute('aria-label', `Remove ${task.name}`); remove.title = 'Remove action'; remove.textContent = '⋯'; remove.addEventListener('click', () => removeCustomTask(task)); controls.append(remove);
      }
      row.append(check, info, controls); els.taskList.append(row);
    });
    renderDateHeader();
  }

  function ensureTaskState(task) {
    const day = dayRecord(selectedDate);
    if (!day.tasks[task.id]) day.tasks[task.id] = { count: 0, completed: false };
    return day.tasks[task.id];
  }

  function toggleTask(task) {
    const saved = ensureTaskState(task);
    const goal = Math.max(1, Number(task.goal || 1));
    const currentlyComplete = taskProgress(selectedDate, task).completed;
    if (task.kind === 'check') saved.completed = !currentlyComplete;
    else if (currentlyComplete) { saved.completed = false; saved.count = 0; }
    else { saved.completed = true; saved.count = Math.max(Number(saved.count || 0), goal); }
    persist(); renderAll();
  }

  function adjustCount(task, delta) {
    const saved = ensureTaskState(task);
    const next = Math.max(0, Number(saved.count || 0) + delta);
    saved.count = next;
    saved.completed = next >= Math.max(1, Number(task.goal || 1));
    persist(); renderAll();
  }

  function removeCustomTask(task) {
    const recurringIndex = state.recurringTasks.findIndex(t => t.id === task.id);
    if (recurringIndex >= 0) {
      if (!window.confirm(`Remove “${task.name}” from future workdays? Past progress will stay saved.`)) return;
      state.recurringTasks.splice(recurringIndex, 1);
    } else {
      const day = dayRecord(selectedDate); day.customTasks = day.customTasks.filter(t => t.id !== task.id); delete day.tasks[task.id];
    }
    persist(); renderAll(); showToast('Action removed');
  }

  function openTaskDialog() { els.taskForm.reset(); els.taskGoal.value = '1'; els.taskDialog.showModal(); requestAnimationFrame(() => els.taskName.focus()); }
  function closeTaskDialog() { if (els.taskDialog.open) els.taskDialog.close(); }
  function slugId(name) { return `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'task'}-${Date.now().toString(36)}`; }

  function addCustomTask() {
    const name = els.taskName.value.trim(); if (!name) return;
    const goal = Math.max(1, Math.min(999, Number(els.taskGoal.value || 1)));
    const repeat = new FormData(els.taskForm).get('repeat') || 'today';
    const task = { id: slugId(name), name, goal, kind: goal === 1 ? 'check' : 'count', repeat };
    if (repeat === 'workdays') state.recurringTasks.push(task); else dayRecord(selectedDate).customTasks.push(task);
    persist(); closeTaskDialog(); renderAll(); showToast(repeat === 'workdays' ? 'Added to every workday' : 'Added for this day');
  }

  function shiftSelectedDay(amount) { const next = new Date(selectedDate); next.setDate(next.getDate() + amount); selectDate(next); }
  function selectDate(date) { selectedDate = startOfDay(date); viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1); renderAll(); }
  function changeViewMonth(amount) { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + amount, 1); renderCalendar(); renderStats(); renderBadges(); }

  function completionForDate(date, create = false) {
    const key = getDateKey(date);
    const hasStored = Boolean(state.days[key]);
    if (!hasStored && !create) return { pct: 0, completed: 0, total: tasksPreviewForDate(date).length, hasActivity: false };
    const tasks = create ? tasksForDate(date) : tasksPreviewForDate(date);
    const day = state.days[key];
    const completed = tasks.filter(task => {
      const saved = day?.tasks?.[task.id] || {};
      const count = Number(saved.count || 0);
      const goal = Math.max(1, Number(task.goal || 1));
      return task.kind === 'check' ? Boolean(saved.completed) : Boolean(saved.completed) || count >= goal;
    }).length;
    const activityCount = day ? Object.values(day.tasks || {}).some(v => Boolean(v.completed) || Number(v.count || 0) > 0) : false;
    return { pct: tasks.length ? Math.round((completed / tasks.length) * 100) : 0, completed, total: tasks.length, hasActivity: activityCount };
  }

  function tasksPreviewForDate(date) {
    const key = getDateKey(date);
    const day = state.days[key] || { customTasks: [] };
    const recurring = state.recurringTasks.filter(task => task.repeat !== 'workdays' || isWorkday(date));
    return [...BUILTIN_TASKS, ...recurring, ...(day.customTasks || [])];
  }

  function renderCalendar() {
    els.calendarHeading.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewMonth);
    els.calendarGrid.innerHTML = '';
    const year = viewMonth.getFullYear(); const month = viewMonth.getMonth(); const first = new Date(year, month, 1); const mondayIndex = (first.getDay() + 6) % 7; const gridStart = new Date(year, month, 1 - mondayIndex);
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart); date.setDate(gridStart.getDate() + i);
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'calendar-day';
      if (date.getMonth() !== month) cell.classList.add('outside');
      if (isSameDay(date, new Date())) cell.classList.add('today');
      if (isSameDay(date, selectedDate)) cell.classList.add('selected');
      const progress = completionForDate(date);
      if (progress.hasActivity) cell.dataset.status = progress.pct === 100 ? 'complete' : 'partial';
      cell.textContent = String(date.getDate());
      cell.setAttribute('aria-label', `${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)}${progress.hasActivity ? `, ${progress.pct}% complete` : ''}`);
      cell.addEventListener('click', () => selectDate(date)); els.calendarGrid.append(cell);
    }
  }

  function monthDates(monthDate) {
    const dates = []; const y = monthDate.getFullYear(); const m = monthDate.getMonth(); const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) dates.push(new Date(y, m, d));
    return dates;
  }

  function renderStats() {
    const dates = monthDates(viewMonth);
    const tracked = dates.filter(d => state.days[getDateKey(d)]);
    const progresses = tracked.map(d => completionForDate(d));
    const totalSlots = progresses.reduce((sum, p) => sum + p.total, 0);
    const completedSlots = progresses.reduce((sum, p) => sum + p.completed, 0);
    const monthPct = totalSlots ? Math.round((completedSlots / totalSlots) * 100) : 0;
    const perfect = progresses.filter(p => p.hasActivity && p.pct === 100).length;
    els.monthCompletion.textContent = `${monthPct}%`;
    els.currentStreak.textContent = `${calculateCurrentStreak()} day${calculateCurrentStreak() === 1 ? '' : 's'}`;
    els.perfectDays.textContent = String(perfect); els.actionsDone.textContent = String(completedSlots);
    const totals = aggregateCountsForMonth(viewMonth);
    const preferred = ['call-talents', 'text-talents', 'activate-talents', 'upload-drug-test', 'send-welcome-email', 'badges'];
    els.miniTotals.innerHTML = '';
    preferred.forEach(id => {
      const task = BUILTIN_TASKS.find(t => t.id === id); if (!task) return;
      const row = document.createElement('div'); row.className = 'mini-total-row';
      const label = document.createElement('span'); label.textContent = task.name;
      const value = document.createElement('strong'); value.textContent = String(totals[id] || 0);
      row.append(label, value); els.miniTotals.append(row);
    });
  }

  function aggregateCountsForMonth(monthDate) {
    const totals = {};
    monthDates(monthDate).forEach(date => {
      const day = state.days[getDateKey(date)]; if (!day) return;
      tasksPreviewForDate(date).forEach(task => {
        const saved = day.tasks?.[task.id]; if (!saved) return;
        if (task.kind === 'check') totals[task.id] = (totals[task.id] || 0) + (saved.completed ? 1 : 0);
        else totals[task.id] = (totals[task.id] || 0) + Number(saved.count || 0);
      });
    });
    return totals;
  }

  function calculateCurrentStreak() {
    let cursor = startOfDay(new Date()); let streak = 0;
    for (let guard = 0; guard < 3660; guard++) {
      if (!isWorkday(cursor)) { cursor.setDate(cursor.getDate() - 1); continue; }
      const progress = completionForDate(cursor);
      if (progress.hasActivity && progress.pct === 100) { streak++; cursor.setDate(cursor.getDate() - 1); continue; }
      break;
    }
    return streak;
  }

  function renderBadges() {
    const totals = aggregateCountsForMonth(viewMonth);
    const dates = monthDates(viewMonth);
    const perfectDays = dates.filter(d => { const p = completionForDate(d); return p.hasActivity && p.pct === 100; }).length;
    const tracked = dates.filter(d => state.days[getDateKey(d)]).map(d => completionForDate(d));
    const total = tracked.reduce((s,p) => s + p.total, 0); const done = tracked.reduce((s,p) => s + p.completed, 0); const pct = total ? Math.round(done / total * 100) : 0;
    const badges = [
      { icon: '📞', title: 'Call Machine', desc: '100 calls this month', unlocked: (totals['call-talents'] || 0) >= 100 },
      { icon: '⚡', title: 'Activation Pro', desc: '100 talents activated', unlocked: (totals['activate-talents'] || 0) >= 100 },
      { icon: '🧪', title: 'Drug Test Hero', desc: '50 uploads this month', unlocked: (totals['upload-drug-test'] || 0) >= 50 },
      { icon: '🔥', title: 'Perfect Week', desc: '5 perfect days this month', unlocked: perfectDays >= 5 },
      { icon: '🏆', title: 'Strong Month', desc: '90% monthly completion', unlocked: pct >= 90 },
      { icon: '💬', title: 'Follow-up Pro', desc: '100 texts this month', unlocked: (totals['text-talents'] || 0) >= 100 }
    ];
    els.badgesGrid.innerHTML = '';
    badges.forEach(badge => {
      const tile = document.createElement('article'); tile.className = `badge-tile${badge.unlocked ? ' unlocked' : ''}`;
      tile.innerHTML = `<div class="badge-icon" aria-hidden="true">${badge.icon}</div><div><div class="badge-title">${escapeHtml(badge.title)}</div><div class="badge-desc">${escapeHtml(badge.desc)}</div></div>`;
      els.badgesGrid.append(tile);
    });
  }

  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }

  function exportData() {
    const payload = { app: 'Daily Talent Tracker', exportedAt: new Date().toISOString(), data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `daily-talent-tracker-${getDateKey(new Date())}.json`; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url); showToast('Backup exported');
  }

  async function importData(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text(); const parsed = JSON.parse(text); const imported = parsed.data || parsed;
      if (!imported || typeof imported !== 'object' || !imported.days) throw new Error('Invalid backup');
      if (!window.confirm('Import this backup? It will replace the tracker data currently stored on this device.')) return;
      Object.keys(state).forEach(k => delete state[k]); Object.assign(state, defaultState(), imported); persist('Imported ✓'); renderAll(); showToast('Backup imported');
    } catch { showToast('Could not import that file'); }
    finally { event.target.value = ''; }
  }

  function showToast(message) { els.toast.textContent = message; els.toast.classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 1800); }
  function registerServiceWorker() { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {}); }
})();
