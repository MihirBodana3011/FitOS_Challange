/* ═══════════════════════════════════════════════════════════════════
   FITOS SERVICE WORKER — Ultra-Robust 24/7 Background Notification Engine
   v5.0 — Works even when PWA is completely closed.

   STRATEGY (Multi-Layer Redundancy):
   1. setTimeout chain — keeps SW alive while page is open
   2. Periodic Background Sync — wakes SW every 15-60min when closed (Android)
   3. Push messages — future server-side push support
   4. SW self-ping via fetch — keeps SW from dying in background
   5. Notification timestamps prevent duplicate firing
═══════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'fitos-v5';
const ASSETS = [
  './index.html',
  './app.css',
  './desktop.css',
  './app.js',
  './data.json',
  './manifest.json',
  './icons/fitos_icon.png',
  './icons/fitos_icon_512.png'
];

/* ── FULL DAILY SCHEDULE ──────────────────────────────────────────
   challenge: false = always fire (even without challenge)
   challenge: true  = only fire when 90-day challenge is ACTIVE
   urgent: true     = requireInteraction + strong vibration
──────────────────────────────────────────────────────────────────*/
const DAILY_SCHEDULE = [
  // === ALWAYS ON — Morning ===
  { h: 6,  m: 0,  tag: 'wake_up',    challenge: false, urgent: true,
    title: '⏰ WAKE UP — FitOS',
    body:  'Subah ho gayi bhai! Uth ja — day starts NOW. 🔥' },

  { h: 6,  m: 30, tag: 'jeera1',     challenge: false, urgent: false,
    title: '🌿 Jeera Water — Round 1',
    body:  'Empty stomach pe jeera/saunf/ajwain + lemon water pi! Detox shuru.' },

  { h: 7,  m: 0,  tag: 'weight_log', challenge: false, urgent: true,
    title: '⚖️ WEIGHT LOG KARO!',
    body:  'Breakfast se pehle abhi wajan karo. Consistent rahega track.' },

  { h: 7,  m: 30, tag: 'acv1',       challenge: false, urgent: false,
    title: '🍋 ACV + Lemon Shot — R1',
    body:  '1 tbsp Apple Cider Vinegar in warm water. Ab pi!' },

  { h: 8,  m: 0,  tag: 'isab1',      challenge: false, urgent: false,
    title: '🌾 Isabgol — Round 1',
    body:  'Breakfast se thoda pehle 1 tsp isabgol in water.' },

  { h: 10, m: 0,  tag: 'water_10',   challenge: false, urgent: false,
    title: '💧 HYDRATION CHECK — 10 AM',
    body:  'Abhi tak kitna paani piya? Refill karo!' },

  // === ALWAYS ON — Afternoon/Evening ===
  { h: 13, m: 0,  tag: 'lunch',      challenge: false, urgent: true,
    title: '🍱 LUNCH TIME — 1 PM',
    body:  'High protein meal time. Clean khao, sahi khao. Iss meal ko skip mat karna!' },

  { h: 15, m: 30, tag: 'pregym',     challenge: false, urgent: false,
    title: '🍌 PRE-GYM SNACK',
    body:  'Half banana + 1 glass milk. Gym se 30 min pehle energy bharooo.' },

  { h: 16, m: 0,  tag: 'gym',        challenge: false, urgent: true,
    title: '🏋️ GYM TIME — ABHI JAO!',
    body:  'No excuses. Shoes pehno. Gym hit karo. Ye 2 ghante tumhare hain! 💪' },

  { h: 18, m: 0,  tag: 'water_18',   challenge: false, urgent: false,
    title: '💧 EVENING WATER CHECK',
    body:  'Gym ke baad pani pi! 8+ glasses ka goal track karo.' },

  { h: 19, m: 0,  tag: 'jeera2',     challenge: false, urgent: false,
    title: '🌿 Jeera Water — Round 2',
    body:  'Post-gym detox dose. Dinner se pehle lena hai!' },

  { h: 19, m: 30, tag: 'acv2',       challenge: false, urgent: false,
    title: '🍋 ACV Shot — Round 2',
    body:  'Dinner se pehle ACV + lemon water. Metabolism fire karo! 🔥' },

  { h: 20, m: 0,  tag: 'isab2',      challenge: false, urgent: false,
    title: '🌾 Isabgol — Round 2',
    body:  'Evening dose. Dinner se pehle ek tsp isabgol.' },

  { h: 20, m: 30, tag: 'dinner',     challenge: false, urgent: true,
    title: '🍛 DINNER TIME — 8:30 PM',
    body:  'Light aur nutritious dinner. Clean end to a strong day.' },

  { h: 22, m: 0,  tag: 'water_22',   challenge: false, urgent: false,
    title: '💧 FINAL WATER CHECK',
    body:  'Aaj ka paani ka goal achieve hua? Last chance! Check karo.' },

  { h: 23, m: 59, tag: 'gt',         challenge: false, urgent: false,
    title: '🍵 Green Tea Before Bed',
    body:  'Sone se pehle ek cup green tea. Cool-down mode ON.' },

  { h: 23, m: 0,  tag: 'log_check',  challenge: false, urgent: true,
    title: '📋 DAILY LOG — Bharo Abhi!',
    body:  'Aaj sab log kiya? Weight, water, workout, meals — sab check karo.' },

  // === CHALLENGE MODE EXTRAS (only when 90-day challenge is active) ===
  { h: 9,  m: 0,  tag: 'c_morning',  challenge: true, urgent: true,
    title: '🔥 CHALLENGE DAY — JEET KA DIN!',
    body:  'Har rep teri transformation ki taraf ek step hai. Aaj bhi beast raho! 💪' },

  { h: 12, m: 0,  tag: 'c_midday',   challenge: true, urgent: false,
    title: '📊 MIDDAY CHALLENGE CHECK-IN',
    body:  'Aadha din gaya. Focus banaye rakho. Ek bhi slip-up nahi!' },

  { h: 15, m: 0,  tag: 'c_afternoon',challenge: true, urgent: false,
    title: '⚡ CHALLENGE ENERGY BOOST',
    body:  'Afternoon slump mat aane dena. Paani pi, chal, focused raho!' },

  { h: 21, m: 0,  tag: 'c_night',    challenge: true, urgent: true,
    title: '🌙 END OF DAY — CHALLENGE LOG',
    body:  'Aaj ka progress log karo. Har logged day = ek guaranteed win! 🏆' },

  { h: 23, m: 30, tag: 'c_midnight', challenge: true, urgent: false,
    title: '💪 MIDNIGHT MOTIVATION',
    body:  'Kal phir se uthna hai. Neend puri karo. Recovery = growth!' },
];

/* ── IndexedDB helpers ──────────────────────────────────────────── */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fitos_sw_db', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(new Error('IndexedDB open failed'));
  });
}

function dbGet(key) {
  return openDB().then(db => new Promise(resolve => {
    const req = db.transaction('config', 'readonly').objectStore('config').get(key);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror = () => resolve(null);
  }));
}

function dbSet(key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction('config', 'readwrite').objectStore('config').put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('dbSet failed'));
  }));
}

/* ── Fire a notification ─────────────────────────────────────────── */
function fireNotification(slot) {
  const isUrgent = slot.urgent === true;
  const options = {
    body: slot.body,
    icon: './icons/fitos_icon_512.png',
    badge: './icons/fitos_icon.png',
    tag: slot.tag,
    renotify: true,
    requireInteraction: isUrgent,
    vibrate: isUrgent
      ? [300, 100, 300, 100, 600, 100, 300]   // strong triple buzz
      : [200, 100, 200],                        // soft double buzz
    silent: false,
    timestamp: Date.now(),
    data: { url: './index.html', tag: slot.tag, urgent: isUrgent },
    actions: [
      { action: 'open', title: '📱 Open FitOS' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ]
  };

  // Add challenge-style accent for challenge notifications
  if (slot.challenge) {
    options.body = '🏆 ' + slot.body;
  }

  return self.registration.showNotification(slot.title, options);
}

/* ── Master check: Should we fire anything right now? ────────────── */
async function checkAndFire() {
  try {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // Load challenge status from IndexedDB
    const profile = await dbGet('profile') || {};
    const isChallengeActive = !!(profile.startDate);

    // Load today's fired log (tracks which notifications already sent today)
    const firedLog = await dbGet('firedLog_' + todayKey) || {};

    let fired = false;

    for (const slot of DAILY_SCHEDULE) {
      // Skip challenge-only slots if challenge is not running
      if (slot.challenge && !isChallengeActive) continue;

      // Match this slot's scheduled time (within current minute)
      if (slot.h === h && slot.m === m) {
        if (!firedLog[slot.tag]) {
          await fireNotification(slot);
          firedLog[slot.tag] = Date.now();
          fired = true;
          // Small delay between multiple same-minute notifications
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // Save updated log
    if (fired) {
      await dbSet('firedLog_' + todayKey, firedLog);
    }

    // Clean up old logs (keep only last 3 days)
    await cleanOldLogs(todayKey);

  } catch (err) {
    console.error('[FitOS SW] checkAndFire error:', err);
  }
}

/* ── Clean old fired logs from IndexedDB ────────────────────────── */
async function cleanOldLogs(todayKey) {
  try {
    const db = await openDB();
    const store = db.transaction('config', 'readonly').objectStore('config');
    const keys = await new Promise(resolve => {
      const req = store.getAllKeys();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => resolve([]);
    });

    const tda = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = tda.getFullYear() + '-' + String(tda.getMonth() + 1).padStart(2, '0') + '-' + String(tda.getDate()).padStart(2, '0');

    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith('firedLog_')) {
        const dateStr = key.replace('firedLog_', '');
        if (dateStr < threeDaysAgo) {
          const delTx = db.transaction('config', 'readwrite');
          delTx.objectStore('config').delete(key);
        }
      }
    }
  } catch (e) {
    // Non-critical, ignore
  }
}

/* ── SW Keep-Alive: Schedule next minute precisely ──────────────────
   Browsers kill idle SWs. We schedule the next check at the exact
   start of next minute so SW stays alive for scheduled times.
   Additionally — every check also does a self-fetch to extend life.
──────────────────────────────────────────────────────────────────── */
let _clockRunning = false;

function scheduleNextMinute() {
  if (_clockRunning) return; // prevent duplicate timers
  _clockRunning = true;

  const now = new Date();
  // Calculate ms until the start of next minute + 100ms buffer
  const msUntilNext = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 100;

  setTimeout(async () => {
    _clockRunning = false;
    await checkAndFire();
    // Self-extend: do a dummy fetch to keep SW alive
    try {
      await fetch('./manifest.json?_sw_ping=' + Date.now(), { cache: 'no-store' });
    } catch (e) { /* offline is fine */ }
    scheduleNextMinute(); // reschedule for the minute after
  }, msUntilNext);
}

/* ── Missed notification catch-up ───────────────────────────────────
   When SW wakes up (from sleep/kill), scan last 15 minutes for
   any missed notifications and fire them immediately.
──────────────────────────────────────────────────────────────────── */
async function catchUpMissedNotifs() {
  try {
    const now = new Date();
    const todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const profile = await dbGet('profile') || {};
    const isChallengeActive = !!(profile.startDate);
    const firedLog = await dbGet('firedLog_' + todayKey) || {};

    const nowMins = now.getHours() * 60 + now.getMinutes();
    let updated = false;

    for (const slot of DAILY_SCHEDULE) {
      if (slot.challenge && !isChallengeActive) continue;

      const slotMins = slot.h * 60 + slot.m;
      const missedWindow = 15; // catch up to 15 minutes late

      // Check if this slot was in the last 15 minutes and not yet fired
      if (slotMins <= nowMins && slotMins > nowMins - missedWindow) {
        if (!firedLog[slot.tag]) {
          // Fire with "missed" indicator
          const missedSlot = {
            ...slot,
            title: '⚠️ ' + slot.title,
            body: '[Missed ' + (nowMins - slotMins) + 'min ago] ' + slot.body,
            urgent: false // don't make missed notifs require interaction
          };
          await fireNotification(missedSlot);
          firedLog[slot.tag] = Date.now();
          updated = true;
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    if (updated) {
      await dbSet('firedLog_' + todayKey, firedLog);
    }
  } catch (e) {
    console.error('[FitOS SW] catchUp error:', e);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SERVICE WORKER LIFECYCLE EVENTS
═══════════════════════════════════════════════════════════════════ */

/* ── INSTALL ──────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log('[FitOS SW] Installing v5...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

/* ── ACTIVATE ─────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  console.log('[FitOS SW] Activating v5...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take control of all pages
      .then(() => {
        scheduleNextMinute(); // start the clock
        return catchUpMissedNotifs(); // check for missed notifications
      })
  );
});

/* ── FETCH (Cache-First with Network Fallback) ────────────────── */
self.addEventListener('fetch', event => {
  // Don't intercept SW ping requests
  if (event.request.url.includes('_sw_ping')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.url.includes('data.json')) {
          return new Response(JSON.stringify({}), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      });
    })
  );
});

/* ── PERIODIC BACKGROUND SYNC ─────────────────────────────────── */
// Fires automatically by Android Chrome even when app is closed.
// Registered from app.js with minInterval: 15 minutes.
self.addEventListener('periodicsync', event => {
  console.log('[FitOS SW] Periodic sync:', event.tag);
  if (event.tag === 'fitos-reminder-check') {
    event.waitUntil(
      checkAndFire()
        .then(() => catchUpMissedNotifs())
        .then(() => scheduleNextMinute())
    );
  }
});

/* ── PUSH (Server-side push for future use) ─────────────────────── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  console.log('[FitOS SW] Push received:', data);
  event.waitUntil(
    self.registration.showNotification(data.title || '🔥 FitOS Alert!', {
      body: data.body || 'Stay on track with your goals!',
      icon: './icons/fitos_icon_512.png',
      badge: './icons/fitos_icon.png',
      vibrate: [300, 100, 300, 100, 600],
      requireInteraction: true,
      tag: data.tag || 'push-notif',
      data: { url: data.url || './index.html' }
    })
  );
});

/* ── MESSAGE from app.js ─────────────────────────────────────── */
self.addEventListener('message', async event => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {

    // App requests immediate custom alert notification
    case 'SHOW_STRICTION': {
      const d = msg.payload;
      await self.registration.showNotification(d.title || '⚖️ FitOS Alert!', {
        body: d.body || 'Check your goals now!',
        icon: './icons/fitos_icon_512.png',
        badge: './icons/fitos_icon.png',
        vibrate: [300, 100, 300, 100, 500, 100, 300],
        tag: d.tag || 'strict-alert',
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: { url: './index.html' }
      });
      break;
    }

    // App syncs user profile so SW knows if challenge is active
    case 'SYNC_PROFILE': {
      await dbSet('profile', msg.payload);
      console.log('[FitOS SW] Profile synced, challenge:', !!(msg.payload && msg.payload.startDate));
      break;
    }

    // App asks the SW to fire any pending notifications right now
    case 'CHECK_NOW': {
      await checkAndFire();
      break;
    }

    // App asks SW to do catch-up on missed ones
    case 'CATCH_UP': {
      await catchUpMissedNotifs();
      break;
    }

    // Start or restart the minute clock
    case 'START_CLOCK': {
      _clockRunning = false; // reset flag so it can restart
      scheduleNextMinute();
      console.log('[FitOS SW] Clock restarted.');
      break;
    }

    // App requests test notification
    case 'TEST_NOTIF': {
      await self.registration.showNotification('🔥 FitOS — Test Notification', {
        body: 'Bhai, notifications sahi se kaam kar rahi hain! Background mein bhi aayengi. 💪',
        icon: './icons/fitos_icon_512.png',
        badge: './icons/fitos_icon.png',
        vibrate: [200, 100, 200, 100, 400, 100, 200],
        requireInteraction: true,
        tag: 'test-notif',
        renotify: true
      });
      break;
    }

    default:
      console.log('[FitOS SW] Unknown message type:', msg.type);
  }
});

/* ── NOTIFICATION CLICK ─────────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html';
  const action = event.action;

  if (action === 'dismiss') return; // just close it

  // 'open' action or tap anywhere — open/focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ((client.url.includes('index.html') || client.url.endsWith('/')) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

/* ── NOTIFICATION CLOSE (dismissed by user) ─────────────────── */
self.addEventListener('notificationclose', event => {
  // Could log analytics here in the future
  console.log('[FitOS SW] Notification dismissed:', event.notification.tag);
});
