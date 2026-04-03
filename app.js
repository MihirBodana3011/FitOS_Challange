// ═══════════════════════════════════════════════
// CONSTANTS & GLOBALS
// ═══════════════════════════════════════════════
var DAY_NAMES, DAY_SHORT, DAY_WORKOUT_TYPE, WORKOUTS, WEEKLY_MEALS, MEAL_CONFIG, DAILY_TIMELINE;
var DATA_LOADED = false;
var EXPANDED_MEAL_ID = null; // Track currently expanded meal detail

// ═══════════════════════════════════════════════
// DATABASE (UNIFIED USER-WISE DATE-WISE)
// ═══════════════════════════════════════════════
var DB = {
  _g: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  _s: function (k, v) { localStorage.setItem(k, JSON.stringify(v)); },

  profile: function () {
    var p = this._g('fp_profile') || {};
    if (!p.userId) { p.userId = 'user_' + Math.random().toString(36).substr(2, 9); this._s('fp_profile', p); }
    return p;
  },
  setProfile: function (v) {
    var existing = this.profile();
    var merged = {};
    for (var k in existing) merged[k] = existing[k];
    for (var k in v) merged[k] = v[k];
    this._s('fp_profile', merged);
  },

  _getData: function () { return this._g('fp_userData') || []; },
  _saveData: function (data) { this._s('fp_userData', data); },

  _getDayEntry: function (date) {
    var uid = this.profile().userId;
    var data = this._getData();
    var entry = null;
    for (var i = 0; i < data.length; i++) { if (data[i].date === date && data[i].userId === uid) { entry = data[i]; break; } }
    if (!entry) {
      entry = { userId: uid, date: date, weight: 0, water: 0, steps: 0, workout: false, diet: false, _rawWorkout: {}, _rawDiet: {} };
      data.push(entry);
      this._saveData(data);
    }
    return entry;
  },

  _updateDay: function (date, partial) {
    var uid = this.profile().userId;
    var data = this._getData();
    var idx = -1;
    for (var j = 0; j < data.length; j++) { if (data[j].date === date && data[j].userId === uid) { idx = j; break; } }
    if (idx === -1) {
      this._getDayEntry(date);
      data = this._getData();
      for (var j = 0; j < data.length; j++) { if (data[j].date === date && data[j].userId === uid) { idx = j; break; } }
    }
    var updated = {};
    for (var k in data[idx]) updated[k] = data[idx][k];
    for (var k in partial) updated[k] = partial[k];
    updated.userId = uid;
    data[idx] = updated;
    this._saveData(data);
  },

  weights: function () {
    var uid = this.profile().userId;
    var logs = this._g('fp_weightLogs') || [];
    // Filter by user and sort by timestamp
    return logs.filter(function (l) { return l.userId === uid; }).sort(function (a, b) { return a.t - b.t; });
  },
  addWeight: function (date, kg) {
    var uid = this.profile().userId;
    var logs = this._g('fp_weightLogs') || [];
    // Add new log with timestamp for granular tracking
    logs.push({ userId: uid, date: date, kg: parseFloat(kg), t: Date.now() });
    this._s('fp_weightLogs', logs);
    // Also update the latest weight in daily data for summary cards
    this._updateDay(date, { weight: parseFloat(kg) });
  },
  exportData: function () {
    var uid = this.profile().userId;
    var data = { profile: this.profile(), daily: this._getData().filter(function (d) { return d.userId === uid; }), weights: this.weights() };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'FitOS_Data_' + uid + '_' + today() + '.json';
    a.click();
  },

  getWater: function (date) { return this._getDayEntry(date).water || 0; },
  setWater: function (date, n) { this._updateDay(date, { water: Math.max(0, n) }); },

  getNotifHistory: function () { return this._g('fp_notifHistory') || {}; },
  setNotifId: function (id) {
    var h = this.getNotifHistory();
    h[id] = Date.now();
    this._s('fp_notifHistory', h);
  },

  getNotifHistory: function () { return this._g('fp_notifHistory') || {}; },
  setNotifId: function (id) {
    var h = this.getNotifHistory();
    h[id] = Date.now();
    this._s('fp_notifHistory', h);
  },

  getSteps: function (date) { return this._getDayEntry(date).steps || 0; },
  setSteps: function (date, n) { this._updateDay(date, { steps: Math.max(0, n) }); },

  getMeal: function (date) { return this._getDayEntry(date)._rawDiet || {}; },
  setMealItem: function (date, key, val) {
    var d = this._getDayEntry(date);
    var rd = d._rawDiet || {};
    rd[key] = val;
    var d_status = (rd['lunch'] === true || rd['dinner'] === true);
    this._updateDay(date, { _rawDiet: rd, diet: d_status });
  },

  getWorkout: function (date) { return this._getDayEntry(date)._rawWorkout || {}; },
  setWorkout: function (date, data) {
    var d = this._getDayEntry(date);
    var rw = {};
    for (var k in d._rawWorkout) rw[k] = d._rawWorkout[k];
    for (var k in data) rw[k] = data[k];
    this._updateDay(date, { _rawWorkout: rw, workout: rw.completed || false });
  },
  setExercise: function (date, exId, data) {
    var d = this._getDayEntry(date);
    var w = d._rawWorkout || {};
    if (!w.exercises) w.exercises = {};
    var ex = {};
    for (var k in w.exercises[exId]) ex[k] = w.exercises[exId][k];
    for (var k in data) ex[k] = data[k];
    w.exercises[exId] = ex;
    this._updateDay(date, { _rawWorkout: w });
  }
};

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
function today() { return new Date().toISOString().split('T')[0]; }
function todayDay() { return DAY_NAMES[new Date().getDay()]; }
function formatDate(d) {
  if (!d) return '---';
  var dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function getDayNum() {
  var p = DB.profile();
  if (!p.startDate) return 1;
  var start = new Date(p.startDate + 'T00:00:00');
  var now = new Date();
  if (isNaN(start.getTime())) return 1;
  var diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(diff, 1), 90);
}
function getWorkoutType(dayName) { return DAY_WORKOUT_TYPE[dayName] || 'rest'; }
function todayWorkoutType() { return getWorkoutType(todayDay()); }

function showToast(msg, dur) {
  if (!dur) dur = 2000;
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, dur);
}

function openModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// ═══════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════
var currentPage = 'home';
function goPage(page) {
  var old = document.querySelector('.page.active');
  if (old) {
    old.classList.add('animating');
    setTimeout(function () {
      old.classList.remove('active', 'animating');
      _showPage(page);
    }, 200);
  } else {
    _showPage(page);
  }
}
function _showPage(page) {
  var target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    // Force reflow
    target.offsetHeight;
  }
  document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
  var btn = document.querySelector('.nav-btn[data-page="' + page + '"]');
  if (btn) btn.classList.add('active');
  document.getElementById('main-scroll').scrollTop = 0;
  currentPage = page;
  if (page === 'home') renderHome();
  else if (page === 'workout') renderWorkout(selectedWorkoutDay || todayDay());
  else if (page === 'diet') renderDiet();
  else if (page === 'water') renderWater();
  else if (page === 'progress') renderProgress();
}
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.onclick = function () { goPage(btn.dataset.page); };
  });
}

// ═══════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════
// ── helpers for home cards ──────────────────────
function getTodayWorkoutProgress() {
  var wType = todayWorkoutType();
  var wo = WORKOUTS[wType];
  if (!wo || !wo.groups) return { done: 0, total: 0, isRest: wType === 'rest' };
  var total = 0;
  wo.groups.forEach(function (g) { total += g.exercises.length; });
  var wkData = DB.getWorkout(today());
  var exData = wkData.exercises || {};
  var done = 0;
  wo.groups.forEach(function (g) {
    g.exercises.forEach(function (ex) {
      if (exData[ex.id] && exData[ex.id].done) done++;
    });
  });
  return { done: done, total: total, isRest: wType === 'rest' };
}

function getTodayMealSupplementProgress() {
  var MEAL_IDS = ['lunch', 'pregym', 'dinner'];
  var SUPP_IDS = ['supp_jeera1', 'supp_acv1', 'supp_isab1', 'supp_jeera2', 'supp_acv2', 'supp_isab2', 'supp_gt'];
  var mealData = DB.getMeal(today());
  var mealDone = 0;
  MEAL_IDS.forEach(function (id) { if (mealData[id] === true) mealDone++; });
  var suppDone = 0;
  SUPP_IDS.forEach(function (id) { if (mealData[id] === true) suppDone++; });
  return { meals: mealDone, totalMeals: MEAL_IDS.length, supp: suppDone, totalSupp: SUPP_IDS.length };
}

function weekStripHTML() {
  var todayDate = today();
  var todayDow = new Date().getDay(); // 0=sun
  var SHORT_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var TYPE_COLORS = { pull: '#ff6b1a', push: '#38bdf8', power: '#a78bfa', rest: '#22c55e' };
  var TYPE_SHORT = { pull: 'PULL', push: 'PUSH', power: 'PWR', rest: 'REST' };

  // Build week: current week Sun→Sat
  var startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - todayDow);

  var html = '<div class="week-strip">';
  for (var i = 0; i < 7; i++) {
    var dt = new Date(startOfWeek.getTime() + i * 86400000);
    var dStr = dt.toISOString().split('T')[0];
    var dayName = DAY_NAMES[i]; // DAY_NAMES array: [sun,mon,...]
    var wType = getWorkoutType(dayName);
    var color = TYPE_COLORS[wType] || '#555';
    var isToday = (i === todayDow);
    var wkData = DB.getWorkout(dStr);
    var isDone = wkData.completed || false;

    html += '<div class="ws-day' + (isToday ? ' ws-today' : '') + (isDone ? ' ws-done' : '') + '">' +
      '<div class="ws-label">' + SHORT_LABELS[i] + '</div>' +
      '<div class="ws-dot" style="background:' + (isDone ? 'var(--green)' : isToday ? color : '#333') + ';border:2px solid ' + color + ';"></div>' +
      '<div class="ws-type" style="color:' + color + ';">' + TYPE_SHORT[wType] + '</div>' +
      '</div>';
  }
  html += '</div>';
  return html;
}

function renderHome() {
  var p = DB.profile();
  var d = today();
  var dayNum = getDayNum();
  var w = DB.getWater(d);
  var weights = DB.weights();
  var lastWt = weights.length ? weights[weights.length - 1].kg : null;

  var pct = Math.round((dayNum / 90) * 100);
  var wo = getTodayWorkoutProgress();
  var ms = getTodayMealSupplementProgress();

  var wType = todayWorkoutType();
  var TYPE_COLORS = { pull: '#ff6b1a', push: '#38bdf8', power: '#a78bfa', rest: '#22c55e' };
  var woColor = wo.isRest ? 'var(--green)' : (TYPE_COLORS[wType] || 'var(--fire)');
  var woVal = wo.isRest ? '🌿' : (wo.done + '<span style="font-size:.65rem;color:var(--sub)">/' + wo.total + '</span>');
  var woLabel = wo.isRest ? 'REST DAY' : '🏋️ WORKOUT';

  var mealPct = ms.totalMeals > 0 ? Math.round((ms.meals / ms.totalMeals) * 100) : 0;
  var mealColor = mealPct >= 100 ? 'var(--green)' : mealPct > 0 ? 'var(--gold)' : 'var(--sub)';
  var suppPct = ms.totalSupp > 0 ? Math.round((ms.supp / ms.totalSupp) * 100) : 0;
  var suppColor = suppPct >= 100 ? 'var(--green)' : suppPct > 0 ? '#a78bfa' : 'var(--sub)';

  var notifAlert = "";
  if (window.Notification && Notification.permission !== 'granted') {
    notifAlert = '<div onclick="requestNotifPermission()" class="haptic-press" style="margin:8px 16px;background:rgba(255,107,26,0.15);border:1px dashed var(--fire);border-radius:12px;padding:12px;text-align:center;cursor:pointer;">' +
      '<div style="font-size:.7rem;font-weight:700;color:var(--fire);letter-spacing:1px;text-transform:uppercase;">🔔 ENABLE STRICT REMINDERS</div>' +
      '<div style="font-size:.6rem;color:var(--sub);margin-top:2px;">Get alerts for meals, water & weight logs</div>' +
      '</div>';
  }

  document.getElementById('page-home').innerHTML =
    notifAlert +
    '<div class="challenge-ring-card">' +
    '<svg class="ring-svg" width="70" height="70" viewBox="0 0 72 72">' +
    '<circle cx="36" cy="36" r="30" fill="none" stroke="#222" stroke-width="5"/>' +
    '<circle cx="36" cy="36" r="30" fill="none" stroke="#ff6b1a" stroke-width="5"' +
    ' stroke-dasharray="' + (2 * Math.PI * 30) + '" stroke-dashoffset="' + (2 * Math.PI * 30 * (1 - pct / 100)) + '"' +
    ' transform="rotate(-90 36 36)"/>' +
    '<text x="36" y="42" text-anchor="middle" fill="#fff" font-family="Bebas Neue" font-size="16">' + pct + '%</text>' +
    '</svg>' +
    '<div class="ring-info">' +
    '<div class="ring-day-num">DAY ' + dayNum + '</div>' +
    '<div class="ring-day-of">STILL GOING STRONG</div>' +
    '<div class="ring-progress-bar"><div class="ring-progress-fill" style="width:' + pct + '%"></div></div>' +
    '</div>' +
    '</div>' +

    '<div class="quick-stats">' +
    '<div class="stat-chip" onclick="quickWaterAdd()">' +
    '<div class="stat-val" style="color:var(--blue)">' + w + '<span style="font-size:.65rem">/' + (p.waterGoal || 10) + '</span></div>' +
    '<div class="stat-label">💧 WATER</div>' +
    '</div>' +
    '<div class="stat-chip" onclick="quickWeightLog()">' +
    '<div class="stat-val" style="color:var(--gold)">' + (lastWt || '---') + '</div>' +
    '<div class="stat-label">⚖️ KG</div>' +
    '</div>' +
    '<div class="stat-chip" onclick="goPage(\'workout\')">' +
    '<div class="stat-val" style="color:' + woColor + '">' + woVal + '</div>' +
    '<div class="stat-label">' + woLabel + '</div>' +
    '</div>' +
    '<div class="stat-chip" onclick="goPage(\'diet\')">' +
    '<div class="stat-val" style="color:' + mealColor + '">' + ms.meals + '<span style="font-size:.65rem;color:var(--sub)">/' + ms.totalMeals + '</span></div>' +
    '<div class="stat-label">🍱 MEALS</div>' +
    '</div>' +
    '<div class="stat-chip" onclick="goPage(\'diet\')">' +
    '<div class="stat-val" style="color:' + suppColor + '">' + ms.supp + '<span style="font-size:.65rem;color:var(--sub)">/' + ms.totalSupp + '</span></div>' +
    '<div class="stat-label">🌿 SUPPS</div>' +
    '</div>' +
    '</div>' +

    weekStripHTML() +

    '<div class="section">' +
    '<div class="sec-h"><div class="sec-h-title">⏰ TODAY\'S TIMELINE</div></div>' +
    scheduleHTML() +
    '</div>';
}

function scheduleHTML() {
  var mealData = DB.getMeal(today());
  var rows = DAILY_TIMELINE;

  return rows.map(function (r, idx) {
    var status = mealData[r.id];
    var isDone = status === true;
    var isSkipped = status === 'skipped';

    var bgColor = isDone ? 'rgba(34,197,94,0.08)' : (isSkipped ? 'rgba(239,68,68,0.08)' : 'var(--card)');
    var borderColor = isDone ? 'var(--green)' : (isSkipped ? 'var(--red)' : 'var(--border)');
    var textColor = isDone ? 'var(--green)' : (isSkipped ? 'var(--red)' : 'var(--text)');

    var doneBtn = r.id ? '<button onclick="event.stopPropagation();toggleItemStatus(\'' + r.id + '\')" style="flex-shrink:0;background:' + (isDone ? 'var(--green)' : 'transparent') + ';border:1px solid ' + (isDone ? 'var(--green)' : '#333') + ';color:' + (isDone ? '#000' : '#555') + ';border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:.8rem;">✓</button>' : '';
    var skipBtn = r.id ? '<button onclick="event.stopPropagation();toggleSkipStatus(\'' + r.id + '\')" style="flex-shrink:0;background:' + (isSkipped ? 'var(--red)' : 'transparent') + ';border:1px solid ' + (isSkipped ? 'var(--red)' : '#333') + ';color:' + (isSkipped ? '#fff' : '#555') + ';border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:.7rem;">✕</button>' : '';
    var btns = r.id ? '<div style="display:flex;gap:4px;">' + doneBtn + skipBtn + '</div>' : '';

    var isExpanded = r.id && (EXPANDED_MEAL_ID === r.id);
    var dayName = todayDay();
    var detailText = (r.id && WEEKLY_MEALS[dayName]) ? WEEKLY_MEALS[dayName][r.id] : '';
    var expandHtml = (isExpanded && detailText) ? '<div class="meal-expanded-content">' + detailText + '</div>' : '';

    var clickAction = r.id ? 'toggleMealDetail(\'' + r.id + '\')' : (r.name && r.name.indexOf('GYM') !== -1 ? 'goPage(\'workout\')' : '');
    // Using a more robust check for GYM workout
    if (!r.id && r.a && r.a.indexOf('GYM') !== -1) clickAction = "goPage('workout')";

    var rowId = 'row-home-' + (r.id || idx);
    return '<div id="' + rowId + '" onclick="' + clickAction + '" class="stagger-item haptic-press" style="animation-delay:' + (idx * 0.05) + 's;cursor:pointer;background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:10px;margin-bottom:6px;padding:12px;display:flex;flex-direction:column;gap:4px;transition:all .3s ease;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
      '<div style="min-width:68px;font-size:.6rem;font-family:JetBrains Mono,monospace;color:var(--sub);line-height:1.3;">' + r.t + '</div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div id="title-home-' + r.id + '" style="font-size:.78rem;font-weight:600;color:' + textColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + r.a + '</div>' +
      '<div style="font-size:.62rem;color:var(--sub);margin-top:1px;">' + r.d + '</div>' +
      '</div>' +
      btns +
      '</div>' +
      expandHtml +
      '</div>';
  }).join('');
}

function toggleMealDetail(id) {
  if (!id) return;
  var oldId = EXPANDED_MEAL_ID;
  EXPANDED_MEAL_ID = (EXPANDED_MEAL_ID === id) ? null : id;

  // Surgical Update: Collapse old, Expand new
  if (oldId) {
    var oldContentHome = document.querySelector('#row-home-' + oldId + ' .meal-expanded-content');
    if (oldContentHome) oldContentHome.remove();
    var oldContentDiet = document.querySelector('#row-diet-' + oldId + ' .meal-expanded-content');
    if (oldContentDiet) oldContentDiet.remove();
  }

  if (EXPANDED_MEAL_ID) {
    var dayName = todayDay();
    var detailText = WEEKLY_MEALS[dayName] ? WEEKLY_MEALS[dayName][id] : '';
    if (detailText) {
      var html = '<div class="meal-expanded-content">' + detailText + '</div>';
      var rowHome = document.getElementById('row-home-' + id);
      if (rowHome) rowHome.insertAdjacentHTML('beforeend', html);
      var rowDiet = document.getElementById('row-diet-' + id);
      if (rowDiet) rowDiet.insertAdjacentHTML('beforeend', html);
    }
  }
}

function toggleItemStatus(id) {
  var d = today();
  var mealData = DB.getMeal(d);
  var cur = mealData[id];
  var newVal = cur === true ? false : true;
  DB.setMealItem(d, id, newVal);

  // Surgical Update: Home
  var rowHome = document.getElementById('row-home-' + id);
  if (rowHome) {
    var isDone = newVal === true;
    rowHome.style.background = isDone ? 'rgba(34,197,94,0.08)' : 'var(--card)';
    rowHome.style.borderColor = isDone ? 'var(--green)' : 'var(--border)';
    var title = document.getElementById('title-home-' + id);
    if (title) title.style.color = isDone ? 'var(--green)' : 'var(--text)';
    var btn = rowHome.querySelector('button[onclick*="toggleItemStatus"]');
    if (btn) {
      btn.style.background = isDone ? 'var(--green)' : 'transparent';
      btn.style.borderColor = isDone ? 'var(--green)' : '#333';
      btn.style.color = isDone ? '#000' : '#555';
    }
  }

  // Surgical Update: Diet
  var rowDiet = document.getElementById('row-diet-' + id);
  if (rowDiet) {
    var isDone = newVal === true;
    rowDiet.style.background = isDone ? 'rgba(34,197,94,0.07)' : 'var(--card)';
    rowDiet.style.borderColor = isDone ? 'rgba(34,197,94,0.35)' : 'var(--border)';
    var titleD = document.getElementById('title-diet-' + id);
    if (titleD) {
      titleD.style.color = isDone ? 'var(--sub)' : 'var(--text)';
      titleD.style.textDecoration = isDone ? 'line-through' : 'none';
    }
    var btnD = rowDiet.querySelector('div[onclick*="toggleItemStatus"]');
    if (btnD) {
      btnD.style.background = isDone ? 'var(--green)' : 'transparent';
      btnD.style.borderColor = isDone ? 'var(--green)' : '#333';
      btnD.style.color = isDone ? '#000' : 'transparent';
    }
  }

  updateHomeStats();
}

function toggleSkipStatus(id) {
  var d = today();
  var mealData = DB.getMeal(d);
  var cur = mealData[id];
  var newVal = cur === 'skipped' ? false : 'skipped';
  DB.setMealItem(d, id, newVal);

  // Surgical Update: Home
  var rowHome = document.getElementById('row-home-' + id);
  if (rowHome) {
    var isSkipped = newVal === 'skipped';
    rowHome.style.background = isSkipped ? 'rgba(239,68,68,0.08)' : 'var(--card)';
    rowHome.style.borderColor = isSkipped ? 'var(--red)' : 'var(--border)';
    var title = document.getElementById('title-home-' + id);
    if (title) title.style.color = isSkipped ? 'var(--red)' : 'var(--text)';
    var btnS = rowHome.querySelector('button[onclick*="toggleSkipStatus"]');
    if (btnS) {
      btnS.style.background = isSkipped ? 'var(--red)' : 'transparent';
      btnS.style.borderColor = isSkipped ? 'var(--red)' : '#333';
      btnS.style.color = isSkipped ? '#fff' : '#555';
    }
  }

  // Surgical Update: Diet
  var rowDiet = document.getElementById('row-diet-' + id);
  if (rowDiet) {
    var isSkipped = newVal === 'skipped';
    rowDiet.style.background = isSkipped ? 'rgba(239,68,68,0.07)' : 'var(--card)';
    rowDiet.style.borderColor = isSkipped ? 'rgba(239,68,68,0.35)' : 'var(--border)';
    var titleD = document.getElementById('title-diet-' + id);
    if (titleD) {
      titleD.style.color = isSkipped ? 'var(--sub)' : 'var(--text)';
      titleD.style.textDecoration = isSkipped ? 'line-through' : 'none';
    }
    var btnD = rowDiet.querySelector('div[onclick*="toggleSkipStatus"]');
    if (btnD) {
      btnD.style.borderColor = isSkipped ? 'var(--red)' : '#333';
      btnD.style.background = isSkipped ? 'var(--red)' : 'transparent';
      btnD.style.color = isSkipped ? '#fff' : 'transparent';
    }
  }

  updateHomeStats();
}

function updateHomeStats() {
  if (currentPage !== 'home') return;
  var d = today();
  var dayNum = getDayNum();
  var pct = Math.round((dayNum / 90) * 100);
  var ms = getTodayMealSupplementProgress();

  // Update Ring
  var ringFill = document.querySelector('.ring-progress-fill');
  if (ringFill) ringFill.style.width = pct + '%';

  // Update Stats Chips
  var chips = document.querySelectorAll('.stat-chip');
  if (chips.length >= 5) {
    // Meal Chip
    var mPct = ms.totalMeals > 0 ? Math.round((ms.meals / ms.totalMeals) * 100) : 0;
    var mColor = mPct >= 100 ? 'var(--green)' : mPct > 0 ? 'var(--gold)' : 'var(--sub)';
    chips[3].querySelector('.stat-val').style.color = mColor;
    chips[3].querySelector('.stat-val').innerHTML = ms.meals + '<span style="font-size:.65rem;color:var(--sub)">/' + ms.totalMeals + '</span>';

    // Supp Chip
    var sPct = ms.totalSupp > 0 ? Math.round((ms.supp / ms.totalSupp) * 100) : 0;
    var sColor = sPct >= 100 ? 'var(--green)' : sPct > 0 ? '#a78bfa' : 'var(--sub)';
    chips[4].querySelector('.stat-val').style.color = sColor;
    chips[4].querySelector('.stat-val').innerHTML = ms.supp + '<span style="font-size:.65rem;color:var(--sub)">/' + ms.totalSupp + '</span>';
  }
}

function quickWaterAdd() {
  var t = today();
  var cur = DB.getWater(t);
  var newVal = cur + 1;
  DB.setWater(t, newVal);
  showToast('💧 Glass ' + newVal + ' logged!');

  // Surgical Update
  if (currentPage === 'home') {
    var chips = document.querySelectorAll('.stat-chip');
    if (chips[0]) {
      var p = DB.profile();
      chips[0].querySelector('.stat-val').innerHTML = newVal + '<span style="font-size:.65rem">/' + (p.waterGoal || 10) + '</span>';
    }
  }
}

function quickWeightLog() {
  openModal(
    '<div class="modal-title">⚖️ LOG WEIGHT</div>' +
    '<input class="modal-input" id="modal-wt" type="number" step="0.1" placeholder="Current weight in kg..."/>' +
    '<button class="modal-btn primary" onclick="saveWt()">SAVE</button>'
  );
}
function saveWt() {
  var v = parseFloat(document.getElementById('modal-wt').value);
  if (v > 30) {
    DB.addWeight(today(), v);
    closeModal();
    showToast('⚖️ Weight logged!');
    // Surgical Update
    if (currentPage === 'home') {
      var chips = document.querySelectorAll('.stat-chip');
      if (chips[1]) {
        chips[1].querySelector('.stat-val').textContent = v;
      }
    }
  }
}

function quickStepsLog() {
  openModal(
    '<div class="modal-title">👣 LOG STEPS</div>' +
    '<input class="modal-input" id="modal-steps" type="number" placeholder="Today\'s steps..."/>' +
    '<button class="modal-btn primary" onclick="saveSteps()">SAVE</button>'
  );
}
function saveSteps() {
  var v = parseInt(document.getElementById('modal-steps').value);
  if (v >= 0) { DB.setSteps(today(), v); closeModal(); renderHome(); showToast('👣 Steps logged!'); }
}

// ═══════════════════════════════════════════════
// WORKOUT PAGE
// ═══════════════════════════════════════════════
var selectedWorkoutDay = '';

function renderWorkout(day) {
  if (!selectedWorkoutDay) selectedWorkoutDay = todayDay();
  selectedWorkoutDay = day;
  var wType = getWorkoutType(day);
  var wo = WORKOUTS[wType];

  var dDt = new Date();
  dDt.setDate(dDt.getDate() - dDt.getDay() + DAY_NAMES.indexOf(day));
  var dStr = dDt.toISOString().split('T')[0];
  var wkData = DB.getWorkout(dStr);
  var isDone = wkData.completed || false;

  var tabsHtml = DAY_NAMES.map(function (d) {
    var dtT = new Date();
    dtT.setDate(dtT.getDate() - dtT.getDay() + DAY_NAMES.indexOf(d));
    var dsT = dtT.toISOString().split('T')[0];
    var dwT = DB.getWorkout(dsT);
    var cls = 'day-tab';
    if (d === day) cls += ' active';
    else if (dwT.completed) cls += ' done';
    return '<div class="' + cls + '" onclick="renderWorkout(\'' + d + '\')">' + DAY_SHORT[DAY_NAMES.indexOf(d)] + '</div>';
  }).join('');

  document.getElementById('page-workout').innerHTML =
    '<div class="day-tabs">' + tabsHtml + '</div>' +
    (wType === 'rest' ? renderRestDay() : renderWorkoutDay(dStr, wo, wkData, isDone));
}

function renderWorkoutDay(dStr, wo, wkData, isDone) {
  var exData = wkData.exercises || {};
  var groupsHtml = '';

  wo.groups.forEach(function (group) {
    var exHtml = group.exercises.map(function (ex, idx) {
      var ed = exData[ex.id] || {};
      var done = ed.done || false;
      var badge = ex.time ? ex.time : (ex.sets + 'x' + (ex.reps || '?'));
      var setsHtml = '';
      if (ex.logWeight !== false) {
        for (var s = 1; s <= ex.sets; s++) {
          var sw = (ed.setWeights || {})[s] || '';
          setsHtml += '<div class="set-row"><div class="set-num">Set ' + s + '</div><div class="set-reps">' + (ex.reps ? ex.reps + ' reps' : ex.time) + '</div><input class="set-weight-input" type="number" placeholder="kg" value="' + sw + '" onchange="saveSetWeight(\'' + dStr + '\',\'' + ex.id + '\',' + s + ',this.value)" onclick="event.stopPropagation()"/></div>';
        }
      }
      return '<div class="exercise-row stagger-item' + (done ? ' ex-done' : '') + '" id="ex-' + dStr + '-' + ex.id + '" style="animation-delay:' + (idx * 0.05) + 's;">' +
        '<div class="ex-header haptic-press" onclick="toggleExercise(\'' + dStr + '\',\'' + ex.id + '\')">' +
        '<div class="ex-check">' + (done ? '✓' : '') + '</div>' +
        '<div class="ex-name">' + ex.name + '</div>' +
        '<div class="ex-badge">' + badge + '</div>' +
        '<div class="ex-expand" id="exp-' + dStr + '-' + ex.id + '">▼</div>' +
        '</div>' +
        '<div class="ex-body" id="body-' + dStr + '-' + ex.id + '">' + setsHtml + '</div>' +
        '</div>';
    }).join('');
    groupsHtml += '<div class="muscle-group"><div class="muscle-label">' + group.icon + ' ' + group.name + '</div>' + exHtml + '</div>';
  });

  return '<div class="wk-header">' +
    '<div class="wk-header-left"><div class="wk-type" style="color:var(--fire)">' + wo.short + '</div><div class="wk-name">' + wo.label + '</div></div>' +
    '<button class="wk-complete-btn' + (isDone ? ' done-state' : '') + '" onclick="markWorkoutDone(\'' + dStr + '\')" ' + (isDone ? 'disabled' : '') + '>' + (isDone ? '✓ DONE' : 'COMPLETE') + '</button>' +
    '</div>' + groupsHtml;
}

function renderRestDay() {
  return '<div class="rest-day-card"><span class="rest-emoji">🌿</span><div class="rest-day-title">REST & RECOVERY</div><div class="rest-day-desc">Active recovery or home stretching recommended.</div></div>';
}

function toggleExercise(dStr, exId) {
  var exData = DB.getWorkout(dStr).exercises || {};
  var cur = exData[exId] || {};
  var nowDone = !cur.done;
  DB.setExercise(dStr, exId, { done: nowDone });
  var row = document.getElementById('ex-' + dStr + '-' + exId);
  var body = document.getElementById('body-' + dStr + '-' + exId);
  var exp = document.getElementById('exp-' + dStr + '-' + exId);
  if (row) { row.classList.toggle('ex-done', nowDone); var chk = row.querySelector('.ex-check'); if (chk) chk.textContent = nowDone ? '✓' : ''; }
  if (body) { if (nowDone) body.classList.remove('open'); else body.classList.toggle('open'); if (exp) exp.textContent = body.classList.contains('open') ? '▲' : '▼'; }
  if (nowDone) showToast('💪 Exercise done!');
}

function saveSetWeight(dStr, exId, setNum, val) {
  var wkData = DB.getWorkout(dStr);
  var exData = (wkData.exercises || {})[exId] || {};
  var setWeights = exData.setWeights || {};
  setWeights[setNum] = parseFloat(val) || 0;
  DB.setExercise(dStr, exId, { setWeights: setWeights });
}

function markWorkoutDone(dStr) {
  DB.setWorkout(dStr, { completed: true });
  showToast('🔥 Workout recorded! Beast Level!');
  renderWorkout(selectedWorkoutDay);
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// DIET PAGE
// ═══════════════════════════════════════════════
function renderDiet() {
  var t = today();
  var mealData = DB.getMeal(t);
  var totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;

  var mealConfigs = {
    lunch: MEAL_CONFIG['lunch'],
    pregym: MEAL_CONFIG['pregym'],
    dinner: MEAL_CONFIG['dinner']
  };
  ['lunch', 'pregym', 'dinner'].forEach(function (id) {
    var c = mealConfigs[id];
    if (c && mealData[id] === true) {
      totalCal += c.cal || 0; totalPro += c.protein || 0; totalCarb += c.carbs || 0; totalFat += c.fat || 0;
    }
  });

  var TL = [
    { t: '11:00 AM', icon: '\u23f0', label: 'WAKE UP', desc: 'Time to dominate the day' },
    { t: '11:15 AM', icon: '\ud83c\udf3f', label: 'Jeera/Saunf/Ajwain + Lemon', desc: 'Detox drink R1 - sip slowly', id: 'supp_jeera1', type: 'supp' },
    { t: '11:30 AM', icon: '\ud83c\udf4e', label: 'Apple Cider Vinegar R1', desc: '1 tbsp in warm water', id: 'supp_acv1', type: 'supp' },
    { t: '11:45 AM', icon: '\ud83c\udf3e', label: 'Isabgol Round 1', desc: '1 tsp in water - fiber boost', id: 'supp_isab1', type: 'supp' },
    { t: '12:00 PM', icon: '\ud83c\udf71', label: 'MAIN LUNCH', desc: 'High Protein Veg - biggest meal', id: 'lunch', type: 'meal' },
    { t: '01:45 PM', icon: '\ud83c\udf4c', label: 'Pre-Gym Snack', desc: 'Half Banana + 1 Glass Milk', id: 'pregym', type: 'meal' },
    { t: '02:00 PM', icon: '\ud83c\udfcb', label: 'GYM WORKOUT', desc: '02:00 PM to 04:00 PM - BEAST MODE' },
    { t: '05:00 PM', icon: '\ud83c\udf3f', label: 'Jeera/Saunf/Ajwain + Lemon', desc: 'Post-gym detox R2', id: 'supp_jeera2', type: 'supp' },
    { t: '05:15 PM', icon: '\ud83c\udf4e', label: 'Apple Cider Vinegar R2', desc: '1 tbsp in warm water', id: 'supp_acv2', type: 'supp' },
    { t: '05:30 PM', icon: '\ud83c\udf3e', label: 'Isabgol Round 2', desc: '1 tsp in water', id: 'supp_isab2', type: 'supp' },
    { t: '06:30 PM', icon: '\ud83c\udfe2', label: 'JOB STARTS', desc: 'Night shift begins - stay sharp' },
    { t: '09:30 PM', icon: '\ud83c\udf7d', label: 'DINNER', desc: 'Pre-shift fuel - heavy protein', id: 'dinner', type: 'meal' },
    { t: '12:30 AM', icon: '\ud83c\udf75', label: 'Green Tea + Lemon', desc: 'Metabolism boost - last drink', id: 'supp_gt', type: 'supp' }
  ];

  var timelineHtml = '';
  for (var ri = 0; ri < TL.length; ri++) {
    var row = TL[ri];
    var isDone = row.id ? (mealData[row.id] === true) : false;
    var isSkipped = row.id ? (mealData[row.id] === 'skipped') : false;
    var isMeal = row.type === 'meal';
    var isSupp = row.type === 'supp';
    var hasAction = !!row.id;

    // Themed colors
    var accentColor = isDone ? (isMeal ? 'var(--gold)' : 'var(--green)') : (isSkipped ? 'var(--red)' : 'var(--sub)');
    var bgColor = isDone ? (isMeal ? 'rgba(245,197,23,0.07)' : 'rgba(34,197,94,0.07)') : (isSkipped ? 'rgba(239,68,68,0.07)' : 'var(--card)');
    var borderColor = isDone ? (isMeal ? 'rgba(245,197,23,0.4)' : 'rgba(34,197,94,0.35)') : (isSkipped ? 'rgba(239,68,68,0.35)' : 'var(--border)');
    var cursor = hasAction ? 'cursor:pointer;' : '';
    var nameColor = (isDone || isSkipped) ? 'var(--sub)' : 'var(--text)';
    var strikeThru = (isDone || isSkipped) ? 'text-decoration:line-through;' : '';

    var macroPills = '';
    if (isMeal && mealConfigs[row.id]) {
      var mc = mealConfigs[row.id];
      macroPills = '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;">'
        + '<span class="meal-macro-pill">' + mc.cal + ' KCAL</span>'
        + '<span class="meal-macro-pill">' + mc.protein + 'g P</span>'
        + '<span class="meal-macro-pill">' + mc.carbs + 'g C</span>'
        + '<span class="meal-macro-pill">' + mc.fat + 'g F</span>'
        + '</div>';
    }

    // Done button state
    var chkBorder = isDone ? accentColor : '#333';
    var chkBg = isDone ? accentColor : 'transparent';
    var chkColor = isDone ? '#000' : 'transparent';

    // Skip button state
    var skpBorder = isSkipped ? 'var(--red)' : '#333';
    var skpBg = isSkipped ? 'var(--red)' : 'transparent';
    var skpColor = isSkipped ? '#fff' : 'transparent';

    var btns = hasAction
      ? '<div style="display:flex;gap:4px;">'
      + '<div onclick="event.stopPropagation();toggleItemStatus(\'' + row.id + '\');" style="flex-shrink:0;width:26px;height:26px;border-radius:7px;border:2px solid ' + chkBorder + ';background:' + chkBg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.75rem;color:' + chkColor + ';">✓</div>'
      + '<div onclick="event.stopPropagation();toggleSkipStatus(\'' + row.id + '\');" style="flex-shrink:0;width:26px;height:26px;border-radius:7px;border:2px solid ' + skpBorder + ';background:' + skpBg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.65rem;color:' + skpColor + ';">✕</div>'
      + '</div>'
      : '';

    var onclickStr = hasAction ? ' onclick="toggleItemStatus(\'' + row.id + '\');"' : '';

    var isExpanded = row.id && (EXPANDED_MEAL_ID === row.id);
    var dayName = todayDay();
    var detailText = row.id ? (WEEKLY_MEALS[dayName] ? WEEKLY_MEALS[dayName][row.id] : '') : '';
    var expandHtml = (isExpanded && detailText) ? '<div class="meal-expanded-content" style="margin-left:20px;">' + detailText + '</div>' : '';

    var isExpanded = row.id && (EXPANDED_MEAL_ID === row.id);
    var dayName = todayDay();
    var detailText = row.id ? (WEEKLY_MEALS[dayName] ? WEEKLY_MEALS[dayName][row.id] : '') : '';
    var expandHtml = (isExpanded && detailText) ? '<div class="meal-expanded-content" style="margin-left:20px;">' + detailText + '</div>' : '';

    var rowId = 'row-diet-' + (row.id || ri);
    timelineHtml += '<div id="' + rowId + '" onclick="toggleMealDetail(\'' + row.id + '\')" class="stagger-item haptic-press" style="animation-delay:' + (ri * 0.05) + 's;' + cursor + 'background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:11px;margin-bottom:6px;padding:11px 12px;display:flex;flex-direction:column;gap:4px;transition:all .3s ease;">'
      + '<div style="display:flex;align-items:flex-start;gap:10px;">'
      + '<div style="min-width:60px;font-size:.57rem;font-family:JetBrains Mono,monospace;color:var(--sub);line-height:1.4;padding-top:2px;flex-shrink:0;">' + row.t + '</div>'
      + '<div style="font-size:1rem;flex-shrink:0;margin-top:1px;">' + row.icon + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div id="title-diet-' + row.id + '" style="font-size:.8rem;font-weight:600;color:' + nameColor + ';' + strikeThru + '">' + row.label + '</div>'
      + '<div style="font-size:.62rem;color:var(--sub2);margin-top:2px;">' + row.desc + '</div>'
      + macroPills
      + '</div>'
      + btns
      + '</div>'
      + expandHtml
      + '</div>';
  }

  var goals = { cal: 1350, protein: 120, carbs: 110, fat: 35 };
  var pctCal = Math.min((totalCal / goals.cal) * 100, 100) || 0;
  var pctPro = Math.min((totalPro / goals.protein) * 100, 100) || 0;
  var pctCarb = Math.min((totalCarb / goals.carbs) * 100, 100) || 0;
  var pctFat = Math.min((totalFat / goals.fat) * 100, 100) || 0;

  var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var tableRows = '';
  for (var di = 0; di < days.length; di++) {
    var dayK = days[di];
    var dm = WEEKLY_MEALS[dayK] || {};
    var preG = dm.pregym || 'Half Banana + 1 Glass Milk';
    tableRows += '<tr><td>' + dayK.toUpperCase() + '</td><td>' + preG + '</td><td>' + (dm.lunch || '---') + '</td><td>' + (dm.dinner || '---') + '</td></tr>';
  }

  document.getElementById('page-diet').innerHTML =
    '<div class="macro-bar-card">' +
    '<div class="macro-chart-box">' +
    '<div class="macro-donut" style="--p:' + pctCal + '%">' +
    '<div class="macro-donut-content">' +
    '<div class="macro-donut-val">' + Math.round(pctCal) + '%</div>' +
    '<div class="macro-donut-lbl">KCAL</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="macro-stats">' +
    '<div class="macro-item">' +
    '<div class="macro-item-top"><span class="macro-item-lbl">Calories</span><span class="macro-item-val">' + totalCal + '<span> / ' + goals.cal + '</span></span></div>' +
    '<div class="macro-item-bar"><div class="macro-item-fill" style="width:' + pctCal + '%; background:var(--fire);"></div></div>' +
    '</div>' +
    '<div class="macro-item">' +
    '<div class="macro-item-top"><span class="macro-item-lbl">Protein</span><span class="macro-item-val">' + totalPro + '<span> / ' + goals.protein + 'g</span></span></div>' +
    '<div class="macro-item-bar"><div class="macro-item-fill" style="width:' + pctPro + '%; background:var(--gold);"></div></div>' +
    '</div>' +
    '<div class="macro-item">' +
    '<div class="macro-item-top"><span class="macro-item-lbl">Carbs</span><span class="macro-item-val">' + totalCarb + '<span> / ' + goals.carbs + 'g</span></span></div>' +
    '<div class="macro-item-bar"><div class="macro-item-fill" style="width:' + pctCarb + '%; background:var(--green);"></div></div>' +
    '</div>' +
    '<div class="macro-item">' +
    '<div class="macro-item-top"><span class="macro-item-lbl">Fat</span><span class="macro-item-val">' + totalFat + '<span> / ' + goals.fat + 'g</span></span></div>' +
    '<div class="macro-item-bar"><div class="macro-item-fill" style="width:' + pctFat + '%; background:var(--blue);"></div></div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="section"><div class="sec-h"><div class="sec-h-title">TODAY\'S DIET &amp; SUPPLEMENTS</div></div>' + timelineHtml + '</div>' +
    '<div class="section" style="margin-top:12px;"><div class="sec-h"><div class="sec-h-title">WEEKLY MENU REF</div></div><div class="menu-ref-wrap"><table class="menu-table"><thead><tr><th>DAY</th><th>PRE-GYM</th><th>LUNCH + CURD</th><th>DINNER</th></tr></thead><tbody>' + tableRows + '</tbody></table></div></div>' +
    '<div style="padding:10px 0;font-size:.65rem;color:var(--sub);text-align:center;">Tap any item to mark complete</div>';
}

// WATER PAGE
// ═══════════════════════════════════════════════

function renderWater() {
  var t = today();
  var cur = DB.getWater(t);
  var goal = DB.profile().waterGoal || 10;
  var pct = Math.min((cur / goal) * 100, 100) || 0;

  var glassesHtml = '';
  for (var i = 1; i <= goal; i++) {
    var filled = i <= cur ? ' filled' : '';
    var icon = i <= cur ? '💧' : '🚰';
    glassesHtml += '<div class="glass-item' + filled + '" onclick="DB.setWater(\'' + t + '\',' + i + '); renderWater();"><div style="font-size:1.4rem;">' + icon + '</div><div class="glass-lbl">' + i + '</div></div>';
  }

  var dataList = DB._getData().slice(-7);
  var chartHtml = dataList.map(function (d) {
    var c = d.water || 0;
    var p = Math.min((c / goal) * 100, 100) || 0;
    var dt = new Date(d.date + 'T00:00:00');
    var lbl = isNaN(dt.getTime()) ? '' : DAY_SHORT[dt.getDay()];
    var filled = c >= goal ? ' filled' : '';
    return '<div class="chart-bar-wrap"><div class="chart-bar-val">' + c + '</div><div class="chart-bar' + filled + '" style="height:' + Math.max(p, 5) + '%;"></div><div class="chart-bar-lbl">' + lbl + '</div></div>';
  }).join('');

  document.getElementById('page-water').innerHTML =
    '<div class="water-display">' +
    '<div class="water-big-num">' + cur + '</div>' +
    '<div class="water-goal-label">GLASSES TODAY (GOAL: ' + goal + ')</div>' +
    '<div class="water-bar"><div class="water-bar-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="water-controls">' +
    '<button class="water-btn" onclick="DB.setWater(\'' + t + '\',' + (cur - 1) + '); renderWater();">-</button>' +
    '<div class="water-val-display">' + Math.round(cur) + '</div>' +
    '<button class="water-btn" onclick="DB.setWater(\'' + t + '\',' + (cur + 1) + '); renderWater();">+</button>' +
    '</div>' +
    '</div>' +
    '<div class="section" style="margin-top:12px;">' +
    '<div class="sec-h"><div class="sec-h-title">🚰 HYDRATION TRACKER</div></div>' +
    '<div class="glasses-grid">' + glassesHtml + '</div>' +
    '</div>' +
    '<div class="section" style="margin-top:12px;">' +
    '<div class="sec-h"><div class="sec-h-title">📊 PAST 7 DAYS</div></div>' +
    '<div class="water-week-chart"><div class="chart-bars">' + chartHtml + '</div></div>' +
    '</div>';
}

// ═══════════════════════════════════════════════
// PROGRESS PAGE
// ═══════════════════════════════════════════════

function generateWeightChartSVG(pts) {
  if (!pts || !pts.length) return '<div class="empty-chart">Log weights to see trend...</div>';

  var w = 320, h = 180, pad = 24;
  var wts = pts.map(function (p) { return p.kg; });
  var minW = Math.min.apply(null, wts) - 2;
  var maxW = Math.max.apply(null, wts) + 2;
  if (maxW === minW) { minW -= 5; maxW += 5; }

  var getX = function (i) { return pad + (i * (w - 2 * pad) / (pts.length > 1 ? pts.length - 1 : 1)); };
  var getY = function (v) { return h - pad - ((v - minW) * (h - 2 * pad) / (maxW - minW)); };

  var gridHtml = '';
  var step = (maxW - minW) > 10 ? 5 : 2;
  for (var v = Math.ceil(minW / step) * step; v <= maxW; v += step) {
    var gy = getY(v);
    gridHtml += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (w - pad) + '" y2="' + gy + '" stroke="var(--border2)" stroke-width="0.5" stroke-dasharray="3,3" />';
    gridHtml += '<text x="4" y="' + (gy + 3) + '" fill="var(--sub2)" style="font-size:7px;">' + v + '</text>';
  }

  var pathD = 'M ' + getX(0) + ' ' + getY(pts[0].kg);
  var pointsHtml = '';

  for (var i = 0; i < pts.length; i++) {
    var x = getX(i), y = getY(pts[i].kg);
    if (i > 0) {
      var prevX = getX(i - 1), prevY = getY(pts[i - 1].kg);
      var cp1x = prevX + (x - prevX) / 2;
      pathD += ' C ' + cp1x + ' ' + prevY + ' ' + cp1x + ' ' + y + ' ' + x + ' ' + y;
    }
    pointsHtml += '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="var(--fire)" stroke="#fff" stroke-width="1.5" />';
    if (i === pts.length - 1 || i === 0 || pts.length < 7) {
      pointsHtml += '<text x="' + x + '" y="' + (y - 10) + '" fill="#fff" text-anchor="middle" style="font-size:9px;font-weight:bold;filter:drop-shadow(0 1px 2px #000);">' + pts[i].kg + '</text>';
    }
  }

  var fillD = pathD + ' L ' + getX(pts.length - 1) + ' ' + (h - pad) + ' L ' + getX(0) + ' ' + (h - pad) + ' Z';

  return '<svg id="weight-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="overflow:visible;">' +
    '<defs><linearGradient id="gradW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--fire)" stop-opacity="0.4"/><stop offset="100%" stop-color="var(--fire)" stop-opacity="0"/></linearGradient></defs>' +
    gridHtml +
    '<path d="' + fillD + '" fill="url(#gradW)" />' +
    '<path class="weight-svg-path" d="' + pathD + '" fill="none" stroke="var(--fire)" stroke-width="3" stroke-linecap="round" />' +
    pointsHtml +
    '</svg>';
}

function renderProgress() {
  var prof = DB.profile();
  var weights = DB.weights();

  // Create a display-ready array of weights for the chart (including start weight)
  var chartWeights = [];
  // 1. Add start weight if available
  if (prof.startWeight && prof.startDate) {
    chartWeights.push({ date: prof.startDate, kg: parseFloat(prof.startWeight) });
  }
  // 2. Add all logged weights (avoiding duplicates with start date)
  for (var i = 0; i < weights.length; i++) {
    var exists = false;
    for (var j = 0; j < chartWeights.length; j++) { if (chartWeights[j].date === weights[i].date) exists = true; }
    if (!exists) chartWeights.push(weights[i]);
  }
  chartWeights.sort(function (a, b) { return a.date.localeCompare(b.date); });

  var lastWtObj = weights.length ? weights[weights.length - 1] : (prof.startWeight ? { kg: prof.startWeight } : null);
  var firstWtObj = prof.startWeight ? { kg: prof.startWeight } : (weights.length ? weights[0] : null);

  var wRows = weights.slice(-15).reverse().map(function (w, i, arr) {
    var prev = arr[i + 1];
    var diffHtml = '';
    if (prev) {
      var d = w.kg - prev.kg;
      if (d > 0) diffHtml = '<span class="wh-diff pos">▲ ' + d.toFixed(1) + '</span>';
      else if (d < 0) diffHtml = '<span class="wh-diff neg">▼ ' + Math.abs(d).toFixed(1) + '</span>';
      else diffHtml = '<span class="wh-diff" style="color:var(--sub)">—</span>';
    }
    var logTime = w.t ? (new Date(w.t).getHours() + ':' + String(new Date(w.t).getMinutes()).padStart(2, '0')) : '--:--';
    return '<div class="wh-row"><div class="wh-date">' + formatDate(w.date) + ' <span style="font-size:.5rem;color:var(--sub2)">' + logTime + '</span></div><div style="flex:1;text-align:right;padding-right:16px;">' + diffHtml + '</div><div class="wh-kg">' + w.kg + ' KG</div></div>';
  }).join('');

  var totalLost = (firstWtObj && lastWtObj) ? (firstWtObj.kg - lastWtObj.kg).toFixed(1) : 0;

  var cal90Html = '';
  var startD = DB.profile().startDate ? new Date(DB.profile().startDate + 'T00:00:00') : new Date();
  var todayIdx = getDayNum() - 1;
  for (var i = 0; i < 90; i++) {
    var dt = new Date(startD.getTime() + i * 24 * 60 * 60 * 1000);
    var dStr = dt.toISOString().split('T')[0];
    var wEntry = DB.getWorkout(dStr);
    var cls = 'cal-day';
    if (i > todayIdx) cls += ' future';
    else if (i === todayIdx) cls += ' today';
    if (wEntry.completed) cls += ' workout-done';
    cal90Html += '<div class="' + cls + '"></div>';
  }

  var targetWt = parseFloat(prof.targetWeight || 0);
  var needsToLose = targetWt > 0 ? (lastWtObj ? (lastWtObj.kg - targetWt) : 0).toFixed(1) : '--';
  if (parseFloat(needsToLose) < 0) needsToLose = 'GOAL MET! ✨';

  document.getElementById('page-progress').innerHTML =
    '<div class="progress-stats" style="margin-top:12px;">' +
    '<div class="prog-stat"><div class="prog-stat-val" style="color:var(--gold);">' + (lastWtObj ? lastWtObj.kg : '--') + '</div><div class="prog-stat-lbl">CURRENT (KG)</div></div>' +
    '<div class="prog-stat"><div class="prog-stat-val" style="color:var(--blue);">' + (targetWt || '--') + '</div><div class="prog-stat-lbl">TARGET (KG)</div></div>' +
    '<div class="prog-stat"><div class="prog-stat-val" style="color:var(--red);">' + needsToLose + '</div><div class="prog-stat-lbl">NEEDS TO LOSE</div></div>' +
    '</div>' +

    '<div class="weight-chart">' +
    '<div class="weight-chart-title">📊 WEIGHT TREND</div>' +
    generateWeightChartSVG(chartWeights) +
    '</div>' +

    '<div class="weight-log-card">' +
    '<div class="sec-h"><div class="sec-h-title">⚖️ LOG TODAY\'S WEIGHT</div></div>' +
    '<div class="wl-input-row">' +
    '<input class="wl-input" id="prog-wt" type="number" step="0.1" placeholder="Latest weight in kg...">' +
    '<button class="wl-log-btn" onclick="saveProgWt()">SAVE WEIGHT</button>' +
    '</div>' +
    '</div>' +
    '<div class="bmi-card">' +
    '<div class="sec-h"><div class="sec-h-title">📊 BMI CALCULATOR</div></div>' +
    '<div class="bmi-inputs">' +
    '<div class="bmi-input-group"><div class="bmi-label">HEIGHT (CM)</div><input class="bmi-input" id="bmi-h" type="number" placeholder="170"></div>' +
    '<div class="bmi-input-group"><div class="bmi-label">WEIGHT (KG)</div><input class="bmi-input" id="bmi-w" type="number" value="' + (lastWtObj ? lastWtObj.kg : '') + '" placeholder="85"></div>' +
    '</div>' +
    '<button class="bmi-calc-btn" onclick="calcBmi()">CALCULATE BMI</button>' +
    '<div class="bmi-result" id="bmi-res">' +
    '<div class="bmi-result-num" id="bmi-val">--</div>' +
    '<div class="bmi-result-cat" id="bmi-cat">--</div>' +
    '<div class="bmi-scale">' +
    '<div class="bmi-scale-seg" style="background:#38bdf8;"></div>' +
    '<div class="bmi-scale-seg" style="background:#22c55e;"></div>' +
    '<div class="bmi-scale-seg" style="background:#f5c517;"></div>' +
    '<div class="bmi-scale-seg" style="background:#ef4444;"></div>' +
    '</div>' +
    '<div class="bmi-marker-row"><div class="bmi-marker">18.5</div><div class="bmi-marker" style="margin-left:-5%;">25</div><div class="bmi-marker" style="margin-left:-18%;">30</div><div class="bmi-marker"></div></div>' +
    '</div>' +
    '</div>' +
    '<div class="cal90">' +
    '<div class="cal90-title">🔥 90-DAY CONSISTENCY</div>' +
    '<div class="cal90-grid">' + cal90Html + '</div>' +
    '<div class="cal90-legend"><div class="cal-leg"><div class="cal-dot" style="background:var(--fire);"></div>WORKOUT DONE</div></div>' +
    '</div>' +
    '<div class="weight-history">' +
    '<div class="wh-title">📉 WEIGHT HISTORY <button onclick="DB.exportData()" style="float:right;background:var(--bg3);border:1px solid var(--border2);color:var(--sub);font-size:.55rem;padding:3px 8px;border-radius:6px;cursor:pointer;">EXPORT JSON</button></div>' +
    (wRows ? '<div class="wh-list">' + wRows + '</div>' : '<div class="empty-state">No weight logs yet.</div>') +
    '</div>';
}

function saveProgWt() {
  var el = document.getElementById('prog-wt');
  if (!el) return;
  var v = parseFloat(el.value);
  if (v > 30) {
    DB.addWeight(today(), v);
    el.value = '';
    renderProgress();
    showToast('⚖️ Weight saved!');
  } else {
    showToast('⚠️ Please enter a valid weight.');
  }
}

function calcBmi() {
  var h = parseFloat(document.getElementById('bmi-h').value) / 100;
  var w = parseFloat(document.getElementById('bmi-w').value);
  if (!h || !w) { showToast('Enter valid Height & Weight!'); return; }
  var bmi = w / (h * h);
  var cat = '', color = '';
  if (bmi < 18.5) { cat = 'UNDERWEIGHT'; color = 'var(--blue)'; }
  else if (bmi < 25) { cat = 'NORMAL'; color = 'var(--green)'; }
  else if (bmi < 30) { cat = 'OVERWEIGHT'; color = 'var(--gold)'; }
  else { cat = 'OBESE'; color = 'var(--red)'; }

  document.getElementById('bmi-res').classList.add('show');
  var bval = document.getElementById('bmi-val');
  bval.textContent = bmi.toFixed(1);
  bval.style.color = color;
  var bcat = document.getElementById('bmi-cat');
  bcat.textContent = cat;
  bcat.style.color = color;
}

// ═══════════════════════════════════════════════
// SETUP & BOOT
// ═══════════════════════════════════════════════
function setupSave() {
  if (!DATA_LOADED) { showToast('Loading... please wait'); return; }
  var name = document.getElementById('s-name').value || 'Athlete';
  var weight = parseFloat(document.getElementById('s-weight').value);
  var targetWeight = parseFloat(document.getElementById('s-target-weight').value);
  var startDate = document.getElementById('s-date').value || today();
  var waterGoal = parseInt(document.getElementById('s-water-goal').value) || 10;
  if (!weight) { showToast('Enter your current weight!'); return; }
  if (!targetWeight) { showToast('Enter your target weight!'); return; }
  DB.setProfile({ name: name, startDate: startDate, waterGoal: waterGoal, targetWeight: targetWeight, startWeight: weight });
  DB.addWeight(startDate, weight);
  initApp();
}

function initApp() {
  document.getElementById('setup').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  var td = document.getElementById('topbar-date');
  if (td) td.textContent = formatDate(today());
  var db = document.getElementById('day-badge');
  if (db) db.textContent = 'DAY ' + getDayNum();
  initNav();
  goPage('home');
}

// ═══════════════════════════════════════════════
// BOOTSTRAP - Load data.json then start
// ═══════════════════════════════════════════════
(function bootstrap() {
  fetch('data.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DAY_NAMES = d.DAY_NAMES;
      DAY_SHORT = d.DAY_SHORT;
      DAY_WORKOUT_TYPE = d.DAY_WORKOUT_TYPE;
      WORKOUTS = d.WORKOUTS;
      WEEKLY_MEALS = d.WEEKLY_MEALS;
      MEAL_CONFIG = d.MEAL_CONFIG;
      DAILY_TIMELINE = d.DAILY_TIMELINE;
      DATA_LOADED = true;
      if (DB.profile().startDate) initApp();
    })
    .catch(function (e) {
      console.error('data.json load failed:', e);
      document.body.innerHTML = "<div style='padding:40px;color:white;text-align:center;'><h2>CORS Error</h2><p>Please open using a Local Server (Live Server in VS Code)</p></div>";
    });
})();

// ═══════════════════════════════════════════════
// PWA & NOTIFICATIONS
// ═══════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js');
  });
}


// ═══════════════════════════════════════════════
// STRICT MODE NOTIFICATIONS
// ═══════════════════════════════════════════════

function requestNotifPermission() {
  if (!window.Notification) return alert('Your browser doesn\'t support notifications.');
  Notification.requestPermission().then(function (p) {
    if (p === 'granted') {
      alert('STRICT MODE ACTIVATED! Reminders are on. 🔥');
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_STRICTION',
          payload: { title: 'FitOS Strict Mode ON', body: 'Discipline is the bridge between goals and accomplishment.', tag: 'welcome' }
        });
      }
      renderHome();
    }
  });
}

function checkTimelineReminders() {
  if (!DATA_LOADED || !window.Notification || Notification.permission !== 'granted') return;
  var d = today();
  var now = new Date();
  var nowHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  var dayName = todayDay();
  var mealData = DB.getMeal(d);
  var notifLog = DB.getNotifHistory();
  var todayPrefix = d + '_';

  // 1. Check Weight at 9 AM
  if (now.getHours() === 9 && now.getMinutes() < 15) {
    var weights = DB.weights();
    var wLoggedToday = false;
    for (var i = 0; i < weights.length; i++) { if (weights[i].date === d) wLoggedToday = true; }
    if (!wLoggedToday && !notifLog[todayPrefix + 'weight_rem']) {
      sendStrictNotif('⚖️ LOG WEIGHT!', 'Your 9:00 AM check-in is pending. Weigh yourself now!', 'weight_rem');
    }
  }

  // 2. Check Water every 2 hours if goal < 16
  if (now.getMinutes() === 0 && now.getHours() % 2 === 0 && now.getHours() >= 10 && now.getHours() <= 22) {
    var glasses = DB.getWater(d);
    var goal = DB.profile().waterGoal || 16;
    if (glasses < goal && !notifLog[todayPrefix + 'water_' + now.getHours()]) {
      sendStrictNotif('💧 HYDRATION ALERT!', 'You\'ve only had ' + glasses + '/' + goal + ' glasses. Drink more water!', 'water_' + now.getHours());
    }
  }

  // 3. Check Timeline (Meals/Supps/Workout/Weight)
  DAILY_TIMELINE.forEach(function (slot) {
    if (isTimeMatch(slot.t) || isComingUp(slot.t, 1)) {
      var isDone = false;
      if (slot.id === 'weight_rem') {
        var weights = DB.weights();
        for (var i = 0; i < weights.length; i++) { if (weights[i].date === d) isDone = true; }
      } else if (slot.id) {
        isDone = mealData[slot.id] === true || mealData[slot.id] === 'skipped';
      } else if (slot.a && slot.a.indexOf('GYM') !== -1) {
        var wkData = DB.getWorkout(d);
        isDone = wkData.completed === true;
      }

      var logId = todayPrefix + (slot.id || 'gym');
      if (!isDone && !notifLog[logId]) {
        sendStrictNotif('🍲 REMINDER: ' + slot.a, slot.d || 'Scheduled time: ' + slot.t, slot.id || 'gym');
      }
    }
  });
}

function isTimeMatch(timeStr) {
  var now = new Date();
  var hh = now.getHours();
  var mm = now.getMinutes();
  var nowStr = (hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh)) + ':' + String(mm).padStart(2, '0') + ' ' + (hh >= 12 ? 'PM' : 'AM');
  return nowStr === timeStr;
}

function isComingUp(timeStr, mins) {
  var now = new Date();
  var parts = timeStr.split(':');
  var target = new Date();
  var hh = parseInt(parts[0]);
  if (timeStr.indexOf('PM') !== -1 && hh < 12) hh += 12;
  if (timeStr.indexOf('AM') !== -1 && hh === 12) hh = 0;
  target.setHours(hh, parseInt(parts[1]), 0);
  var diff = (target.getTime() - now.getTime()) / 60000;
  return diff > 0 && diff <= mins;
}

function sendStrictNotif(title, body, id) {
  var d = today();
  DB.setNotifId(d + '_' + id);
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_STRICTION',
      payload: { title: title, body: body, tag: id }
    });
  } else {
    try { new Notification(title, { body: body }); } catch (e) { }
  }
}

setInterval(checkTimelineReminders, 60000);
setTimeout(checkTimelineReminders, 3000);
