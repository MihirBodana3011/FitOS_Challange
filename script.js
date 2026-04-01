"use strict";
// ============================================================
// SERVICE WORKER & NOTIFICATIONS
// ============================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (window.location.protocol === 'file:') {
      console.warn("Service Worker registration skipped: PWAs require a local server (http://localhost) and cannot run via file:// protocol.");
      return;
    }
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("SW Registered Successfully"))
      .catch((err) => console.error("SW Registration Failed", err));
  });
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("❌ Your browser doesn't support notifications");
    return;
  }
  
  if (Notification.permission === "granted") {
    alert("✅ Reminders already enabled! You will receive diet and water notifications.");
    startAutomaticReminders();
    return;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      alert("✅ Reminders Enabled! You will now receive diet and water notifications at scheduled times.");
      localStorage.setItem("notificationsEnabled", "true");
      startAutomaticReminders();
      haptic([200, 100, 200]);
    } else {
      alert("❌ Notifications blocked. Please enable in browser settings (Settings → Notifications)");
    }
  }
}

function sendLocalNotification(title, body, icon = "🔔", delay = 100) {
  if (Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SCHEDULE_NOTIFICATION",
          title: `${icon} ${title}`,
          body: body,
          delay: delay,
        });
      } else {
        setTimeout(() => {
          new Notification(`${icon} ${title}`, { 
            body: body,
            tag: "fitos-reminder",
            requireInteraction: true,
            vibrate: [200, 100, 200]
          });
        }, Math.max(0, delay));
      }
      console.log(`✅ Notification scheduled: ${title} in ${Math.round(delay/1000)}s`);
    } catch (err) {
      console.error("Notification failed:", err);
    }
  }
}

window.testNotification = function() {
  if (Notification.permission !== "granted") {
    requestNotificationPermission();
  } else {
    showToast("Test Notification in 5s! Lock your phone.", "🧪");
    sendLocalNotification("Test Reminder", "PWA Notifications are working! 🚀", "🧪", 5000);
  }
};

// Auto-schedule reminders for diet items
function startAutomaticReminders() {
  if (Notification.permission !== "granted") return;
  
  const scheduleReminder = (time, title, body, icon) => {
    const [hours, mins] = time.split(":").map(Number);
    const now = new Date();
    let reminderTime = new Date();
    reminderTime.setHours(hours, mins, 0, 0);
    
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    const delay = reminderTime - now;
    console.log(`⏰ Reminder scheduled for ${time}: "${title}" in ${Math.round(delay/60000)} min`);
    
    // Offload scheduling to SW for reliability when app is backgrounded
    sendLocalNotification(title, body, icon, delay);
  };
  
  // Schedule all diet reminders
  DIET.forEach(item => {
    if (item.type === "meal" || item.type === "supp") {
      const emoji = {
        meal: "🍱",
        supp: "💊"
      }[item.type] || item.icon || "🔔";
      
      scheduleReminder(
        item.time,
        item.name || item.tag,
        (item.sub || item.desc || "It's time!"),
        emoji
      );
    }
  });
  
  // Water reminder every 2 hours
  const waterTimes = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00"];
  waterTimes.forEach(time => {
    scheduleReminder(time, "Drink Water", "💧 Time to drink 250ml water (1 glass)", "💧");
  });
}

// Check and restore notification state on page load
function initializeNotifications() {
  if (Notification.permission === "granted" && localStorage.getItem("notificationsEnabled")) {
    console.log("✅ Notifications auto-enabled from storage");
    startAutomaticReminders();
  }
}

// AI VOICE & HAPTIC HELPERS
window.speakEx = function (text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.pitch = 1.1;
  u.volume = 0.9;
  window.speechSynthesis.speak(u);
};

window.haptic = function (pattern = [60, 40, 60]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
};

// MOBILE NATIVE APP IMPROVEMENTS
function initializeMobileFeatures() {
  // Prevent zoom on input focus (iOS Safari)
  const viewport = document.querySelector('meta[name=viewport]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }

  // Add touch feedback to interactive elements
  const interactiveElements = document.querySelectorAll('.p-card, .mc, .sq, .ib, .bntab, .wt-glass, .wd, .m-chip, button');

  interactiveElements.forEach(element => {
    element.addEventListener('touchstart', function(e) {
      this.style.transform = 'scale(0.98)';
      this.style.transition = 'transform 0.1s ease';
      haptic([30]); // Light haptic feedback
    }, { passive: true });

    element.addEventListener('touchend', function(e) {
      this.style.transform = '';
      this.style.transition = 'transform 0.2s ease';
    }, { passive: true });

    element.addEventListener('touchcancel', function(e) {
      this.style.transform = '';
      this.style.transition = 'transform 0.2s ease';
    }, { passive: true });
  });

  // Improve scrolling performance
  const scrollableElements = document.querySelectorAll('.wk, .sql, .irow, #allworkoutscontent .mcb');
  scrollableElements.forEach(element => {
    element.style.webkitOverflowScrolling = 'touch';
    element.style.overflowScrolling = 'touch';
  });

  // Add pull-to-refresh simulation (visual feedback)
  let startY = 0;
  let isPulling = false;

  document.addEventListener('touchstart', function(e) {
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (window.scrollY === 0 && e.touches[0].clientY > startY + 50) {
      isPulling = true;
      // Add visual feedback for pull-to-refresh
      document.body.style.transform = `translateY(${Math.min(e.touches[0].clientY - startY - 50, 60)}px)`;
      document.body.style.transition = 'none';
    }
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (isPulling) {
      document.body.style.transform = '';
      document.body.style.transition = 'transform 0.3s ease';
      isPulling = false;
      haptic([50, 30, 50]); // Pull-to-refresh haptic
    }
  }, { passive: true });

  // Add native-like loading states
  window.showLoading = function(element, show = true) {
    if (show) {
      element.style.opacity = '0.6';
      element.style.pointerEvents = 'none';
      element.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><div class="loading-spinner"></div>Loading...</div>';
    } else {
      element.style.opacity = '';
      element.style.pointerEvents = '';
    }
  };

  // Add loading spinner styles dynamically
  const style = document.createElement('style');
  style.textContent = `
    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(198, 146, 10, 0.3);
      border-top: 2px solid var(--gold);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Improve form inputs for mobile
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.addEventListener('focus', function() {
      // Prevent zoom on iOS by ensuring font-size is 16px+
      if (window.innerWidth <= 768) {
        this.style.fontSize = '16px';
      }
    });

    input.addEventListener('blur', function() {
      if (window.innerWidth <= 768) {
        this.style.fontSize = '';
      }
    });
  });

  // Add swipe gestures for bottom navigation
  let startX = 0;
  let currentTab = 0;

  document.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!startX) return;

    const endX = e.changedTouches[0].clientX;
    const diffX = startX - endX;

    // Swipe threshold
    if (Math.abs(diffX) > 50) {
      const tabs = ['diet', 'workout', 'allworkouts', 'progress', 'stats'];
      if (diffX > 0 && currentTab < tabs.length - 1) {
        // Swipe left - next tab
        currentTab++;
        mobTab(tabs[currentTab], document.querySelector(`#bn-${tabs[currentTab]}`));
        haptic([40, 20, 40]);
      } else if (diffX < 0 && currentTab > 0) {
        // Swipe right - previous tab
        currentTab--;
        mobTab(tabs[currentTab], document.querySelector(`#bn-${tabs[currentTab]}`));
        haptic([40, 20, 40]);
      }
    }

    startX = 0;
  }, { passive: true });
}

// Initialize mobile features when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initializeMobileFeatures();
  initializeNotifications();
});

// ============================================================
// DATA
// ============================================================
const DIET = [
  // ── POST-SHIFT: PRE-GYM (after returning home 2:30 AM) ──
  {
    id: "pregym",
    time: "03:00",
    disp: "3:00 AM",
    type: "meal",
    color: "green",
    icon: "⚡",
    name: "Pre-Gym Meal",
    sub: "🏋️ Gym at 4:00 AM — 1/2 Banana + 1 Glass Milk",
    cal: 130,
    p: 8,
    c: 23,
    f: 0,
    fib: 2,
    items: [
      "1/2 medium banana — fast carbs for energy, natural sugars for workout fuel",
      "200ml toned milk (warm) — protein for muscle, calcium, keeps you full during session",
      "Eat exactly at 3:00 AM — gives 1 hour to digest before gym starts",
    ],
  },

  {
    id: "fatb",
    time: "03:15",
    disp: "3:15 AM",
    type: "supp",
    color: "purple",
    icon: "💊",
    tag: "PRE-WORKOUT",
    name: "Dr. Morepen Fat Burner",
    desc: "1 tablet with 250ml water — 45 min before gym. GYM DAYS ONLY.",
    why: "Thermogenic peak hits during 4 AM morning workout. Boosts fat oxidation and energy during session.",
  },

  // ── GYM BLOCK (4:00 AM – 6:00 AM) ───────────────────────
  { id: "gym", time: "04:00", disp: "4:00 AM", type: "gymblock" },

  // ── SLEEP BLOCK (straight to sleep after gym 😴) ─────────
  { id: "sleep", time: "06:01", disp: "😴 SLEEP", type: "sleep" },

  // ── WAKE UP (sleep 6:00 AM – 12:00 PM) ──────────────────
  {
    id: "wake",
    time: "12:00",
    disp: "12:00 PM",
    type: "meal",
    color: "amber",
    icon: "☀️",
    name: "Wake Up — Fasted Kickstart",
    sub: "After ~6 hrs sleep — activate digestion & protein absorption",
    cal: 95,
    p: 5,
    c: 10,
    f: 6,
    fib: 4,
    items: [
      "Warm water + fresh lemon juice (1 glass) + 1 pinch rock salt",
      "Soaked almonds (5) + walnuts (1) + 1 soaked fig",
      "50g sprouted moong salad with cucumber, tomato, lemon and black pepper",
    ],
  },

  {
    id: "jsa1",
    time: "12:15",
    disp: "12:15 PM",
    type: "supp",
    color: "green",
    icon: "🌿",
    tag: "DIGESTION",
    name: "Jeera · Saunf · Ajwain Drink",
    desc: "½ tsp each powder in 250ml lukewarm water. Sip slowly.",
    why: "Eliminates bloating, activates digestive enzymes, reduces water retention after sleep.",
  },
  {
    id: "acv1",
    time: "12:30",
    disp: "12:30 PM",
    type: "supp",
    color: "amber",
    icon: "🍎",
    tag: "METABOLISM",
    name: "Apple Cider Vinegar",
    desc: "1 tbsp ACV in 250ml warm water — 15 min before dinner. Do NOT take on empty stomach.",
    why: "Controls blood sugar spike from dinner, suppresses appetite, activates fat-burning enzymes before shift.",
  },

  // ── AFTERNOON MEAL — MAIN LUNCH (1:00 PM) ───────────────
  {
    id: "isa1",
    time: "13:00",
    disp: "1:00 PM",
    type: "supp",
    color: "teal",
    icon: "🌾",
    tag: "FIBER",
    name: "Isabgol — First Dose",
    desc: "2 level tsp isabgol in 300ml warm water — stir fast, drink IMMEDIATELY.",
    why: "Natural stomach filler before main meal. Slows digestion, reduces total calories absorbed.",
  },

  {
    id: "lunch",
    time: "13:15",
    disp: "1:15 PM",
    type: "meal",
    color: "green",
    icon: "🍱",
    name: "Main Meal — Lunch",
    sub: "Weight loss focused",
    cal: 400,
    p: 52,
    c: 40,
    f: 3,
    fib: 12,
    opts: [
      {
        id: "A",
        label: "100g Soya + 1 Jowar Roti + Salad",
        desc: "100g soya chunks curry + 1 jowar (jawar) roti + large mixed salad with cucumber, carrot and greens.",
      },
      {
        id: "B",
        label: "Dal + Paneer + Chana Salad",
        desc: "200ml moong dal + 80g paneer + roasted chana salad with sprouts, tomato and mint.",
      },
      {
        id: "C",
        label: "Soya Sprouts Bowl",
        desc: "120g soya chunks + sprouted moong + chopped salad. Light, fibrous and protein-rich.",
      },
    ],
  },

  // ── AFTERNOON SUPPLEMENTS (pre-dinner prep) ──────────────
  {
    id: "jsa2",
    time: "15:30",
    disp: "3:30 PM",
    type: "supp",
    color: "green",
    icon: "🌿",
    tag: "DIGESTION",
    name: "Jeera · Saunf · Ajwain Drink",
    desc: "½ tsp each in 250ml warm water.",
    why: "Keeps digestion active, prevents bloating in the afternoon window before shift prep.",
  },

  {
    id: "isa2",
    time: "16:00",
    disp: "4:00 PM",
    type: "supp",
    color: "teal",
    icon: "🌾",
    tag: "FIBER",
    name: "Isabgol — Second Dose",
    desc: "2 tsp isabgol in 300ml warm water — 15 min before dinner.",
    why: "Reduces appetite for dinner. Prevents overeating before the 6:30 PM night shift.",
  },

  {
    id: "acv2",
    time: "16:15",
    disp: "4:15 PM",
    type: "supp",
    color: "amber",
    icon: "🍎",
    tag: "METABOLISM",
    name: "Apple Cider Vinegar",
    desc: "1 tbsp ACV in 250ml warm water — 15 min before dinner. Do NOT take on empty stomach.",
    why: "Controls blood sugar spike from dinner, suppresses appetite, activates fat-burning enzymes before shift.",
  },

  // ── PRE-SHIFT DINNER (5:00 PM) ───────────────────────────
  {
    id: "dinner",
    time: "17:00",
    disp: "5:00 PM",
    type: "meal",
    color: "orange",
    icon: "🍽️",
    name: "Pre-Shift Dinner",
    sub: "Lean fuel before 6:30 PM job",
    cal: 320,
    p: 24,
    c: 22,
    f: 14,
    fib: 7,
    opts: [
      {
        id: "A",
        label: "Paneer + 1 Jowar Roti + Salad",
        desc: "120g low-fat paneer bhurji + 1 jowar roti + big bowl of salad with sprouts.",
      },
      {
        id: "B",
        label: "Tofu + 1 Jowar Roti + Sprouts Salad",
        desc: "120g tofu + 1 jowar roti + sprouts salad with mint and lemon. Low carb, protein packed.",
      },
      {
        id: "C",
        label: "Paneer Tikka Bowl",
        desc: "150g paneer tikka + mixed salad + steamed greens. High protein, low sugar.",
      },
    ],
  },

  // ── NIGHT SHIFT (6:30 PM – 2:30 AM) ─────────────────────
  {
    id: "brk1",
    time: "21:30",
    disp: "9:30 PM",
    type: "meal",
    color: "amber",
    icon: "☕",
    name: "Office Break — Light Snack",
    sub: "Keep under 80 cal",
    cal: 95,
    p: 6,
    c: 12,
    f: 4,
    fib: 3,
    opts: [
      {
        id: "A",
        label: "Roasted Chana + Green Tea",
        desc: "30g roasted chana + 1 cup green tea. Crunchy protein and low carbs.",
      },
      {
        id: "B",
        label: "Poha Sprouts Bowl",
        desc: "Light protein poha with sprouts, chana and lemon. High fiber, low calorie, office-friendly.",
      },
      {
        id: "C",
        label: "✓ Skip It",
        desc: "Just hot water + green tea. Best option for fat loss if you're already full.",
      },
    ],
  },

  {
    id: "gt",
    time: "00:00",
    disp: "12:00 AM",
    type: "supp",
    color: "teal",
    icon: "🍵",
    tag: "NIGHT-METAB",
    name: "Green Tea + Lemon",
    desc: "1 cup green tea with lemon — no sugar, no milk.",
    why: "Boosts fat oxidation over remaining shift hours. EGCG activates thermogenesis during night.",
  },
];

// ============================================================
// WORKOUTS — Fit Master Gym Plan (101 Silver Harmonium 2, Gota)
// ============================================================
const WORKOUTS = {
  back: {
    name: "Back + Biceps — Pull Day",
    days: "Monday & Thursday",
    color: "blue",
    cal: 750,
    tip: "⚡ PULL DAY — Lead with heavy back compound movements. Use full range of motion on every pull. Biceps come after back — they are pre-fatigued, so moderate weight and strict form wins. No swinging. No ego lifting.",
    sections: [
      {
        name: "🔥 Mandatory Warm-up (Full Body)",
        exercises: [
          {
            n: "Jumping Jacks",
            d: "3 sets × 30 reps · Explosive but controlled · Gap: 15 sec",
            t: "warmup",
            s: 3,
            img: "Image/Jumping Jacks.jfif",
          },
          {
            n: "Arm Circles",
            d: "1 min · Fwd & Back · Shoulder mobility · Gap: 0 sec",
            t: "warmup",
            s: 1,
            img: "Image/Arm Circles.webp",
          },
          {
            n: "Torso Twists",
            d: "1 min · Core mobility focus · Gap: 0 sec",
            t: "warmup",
            s: 1,
            img: "Image/Torso Twists.avif",
          },
        ],
      },
      {
        name: "🏋️ Back (Heavy Pulls First)",
        exercises: [
          {
            n: "Machine Lat Pulldown",
            d: "4 sets × 15-12-12-10 reps · Wide overhand grip · Pull to upper chest · Elbows drive down · 60 sec rest",
            t: "back",
            s: 4,
            img: "Image/Machine Lat Pulldown.png",
          },
          {
            n: "Barbell / Dumbbell Bent-Over Row",
            d: "3 sets × 12-12-10 reps · Hinge at hips 45° · Pull to lower chest · Squeeze shoulder blades · 60 sec rest",
            t: "back",
            s: 3,
            img: "Image/Barbell  Dumbbell Bent-Over Row.webp",
          },
          {
            n: "Machine Seated Row",
            d: "3 sets × 15-12-12 reps · Elbows close to body · Full scapular retraction · 1 sec pause at peak",
            t: "back",
            s: 3,
            img: "Image/Machine Seated Row.webp",
          },
          {
            n: "Single Arm Cable Row",
            d: "3 sets × 12 reps each side · Full stretch forward · Pull to waist · Squeeze back",
            t: "back",
            s: 3,
            img: "Image/Single Arm Cable Row.jpg",
          },
          {
            n: "Straight Arm Pulldown (Cable)",
            d: "3 sets × 15 reps · Arms straight · Pull to thighs · Lats focus · Pause at bottom",
            t: "back",
            s: 3,
            img: "Image/Straight Arm Pulldown (Cable).webp",
          },
          {
            n: "Machine Reverse Fly (Rear Delt)",
            d: "3 sets × 15 reps · Arms wide · Rear delt squeeze · Slow 3-sec negative",
            t: "back",
            s: 3,
            img: "Image/Machine Reverse Fly (Rear Delt).webp",
          },
        ],
      },
      {
        name: "💪 Biceps",
        exercises: [
          {
            n: "Barbell Curl",
            d: "4 sets × 15-12-10-10 reps · No swinging · Full curl from dead hang · Squeeze hard at top",
            t: "biceps",
            s: 4,
            img: "Image/Barbell Curl.webp",
          },
          {
            n: "Dumbbell Hammer Curl",
            d: "3 sets × 12 reps · Neutral grip · Alternating arms · Targets brachialis + forearm",
            t: "biceps",
            s: 3,
            img: "Image/Dumbbell Hammer Curl.jfif",
          },
          {
            n: "Preacher Curl / Machine Curl",
            d: "3 sets × 12-12-10 reps · Upper arm locked on pad · Full stretch at bottom · Slow negative",
            t: "biceps",
            s: 3,
            img: "Image/Preacher Curl  Machine Curl.webp",
          },
          {
            n: "Concentration Curl (Dumbbell)",
            d: "2 sets × 12 reps each arm · Elbow on inner thigh · Peak squeeze · Maximum isolation",
            t: "biceps",
            s: 2,
            img: "Image/Concentration Curl (Dumbbell).webp",
          },
          {
            n: "Rope Hammer Curls (Cable)",
            d: "3 sets × 15 reps · Neutral grip · Squeeze at top · Thicker arms focus",
            t: "biceps",
            s: 3,
            img: "Image/Rope Bicep Curls.webp",
          },
        ],
      },
      {
        name: "💪 Forearms",
        exercises: [
          {
            n: "Barbell Wrist Curl",
            d: "3 sets × 20 reps · Seated, wrists over knees · Full ROM · Slow squeeze at top",
            t: "forearms",
            s: 3,
            img: "Image/Barbell Wrist Curl.webp",
          },
          {
            n: "Reverse Wrist Curl (Barbell)",
            d: "3 sets × 15 reps · Overhand grip · Works extensors · Important for grip balance",
            t: "forearms",
            s: 3,
            img: "Image/Reverse Wrist Curl (Barbell).jfif",
          },
        ],
      },
      {
        name: "🏃 Cardio Finish — Burn Zone",
        exercises: [
          {
            n: "Stair Climber",
            d: "10 min · Moderate pace · Squeeze glutes on every step · Gap: 0 sec",
            t: "cardio",
            s: 1,
            img: "Image/Stair Climber.gif",
          },
          {
            n: "Treadmill",
            d: "15 min · Start 5 km/h → build to 6.5 km/h · Incline 3–5% · Burn final calories",
            t: "cardio",
            s: 1,
            img: "Image/Treadmill.webp",
          },
          {
            n: "Cross Trainer (Elliptical)",
            d: "10 min · High resistance · Arms FULLY active · Push & pull handles · Full body calorie burn",
            t: "cardio",
            s: 1,
            img: "Image/Cross Trainer (Elliptical).webp",
          },
        ],
      },
    ],
  },

  chest: {
    name: "Chest + Triceps + Abs — Push Day",
    days: "Tuesday & Friday",
    color: "red",
    cal: 720,
    tip: "⚡ PUSH DAY — Start heavy on chest compounds. Triceps come after chest — they assist in every press so they are already warm. Finish with a hard abs circuit before cardio. Squeeze every chest rep at the top for maximum activation.",
    sections: [
      {
        name: "🔥 Mandatory Warm-up (Full Body)",
        exercises: [
          {
            n: "Jumping Jacks",
            d: "3 sets × 30 reps · Explosive but controlled · Gap: 15 sec",
            t: "warmup",
            s: 3,
            img: "Image/Jumping Jacks.jfif",
          },
          {
            n: "Arm Circles",
            d: "1 min · Fwd & Back · Shoulder mobility · Gap: 0 sec",
            t: "warmup",
            s: 1,
            img: "Image/Arm Circles.webp",
          },
          {
            n: "Torso Twists",
            d: "1 min · Core mobility focus · Gap: 0 sec",
            t: "warmup",
            s: 1,
            img: "Image/Torso Twists.avif",
          },
        ],
      },
      {
        name: "💪 Chest (Compound First)",
        exercises: [
          {
            n: "Machine Chest Press",
            d: "4 sets × 15-12-10-10 reps · Full ROM · Squeeze chest hard at top · 60 sec rest",
            t: "chest",
            s: 4,
            img: "Image/Machine Chest Press.jpeg",
          },
          {
            n: "Incline Dumbbell Press",
            d: "3 sets × 12-12-10 reps · 30–45° incline · Dumbbells touch at top · Upper chest focus",
            t: "chest",
            s: 3,
            img: "Image/Incline Dumbbell Press.webp",
          },
          {
            n: "Machine Decline Press",
            d: "3 sets × 12 reps · Lower chest focus · Squeeze hard at top · Controlled negative",
            t: "chest",
            s: 3,
            img: "Image/Machine Decline Press.gif",
          },
          {
            n: "Machine Pec Fly",
            d: "3 sets × 15-15-15 reps · Feel full stretch at open position · Slow controlled motion · Exhale on close",
            t: "chest",
            s: 3,
            img: "Image/Machine Pec Fly.webp",
          },
          {
            n: "Dumbbell Flat Fly",
            d: "3 sets × 12 reps · Arms slightly bent · Wide arc · Deep stretch · Great chest activation",
            t: "chest",
            s: 3,
            img: "Image/Dumbbell Flat Fly.jfif",
          },
          {
            n: "Cable Crossover (High-to-Low)",
            d: "3 sets × 15 reps · Lean forward · Squeeze at bottom · Chest focus · Feel the contraction",
            t: "chest",
            s: 3,
            img: "Image/Cable Crossover (High-to-Low).jpg",
          },
        ],
      },
      {
        name: "💪 Triceps",
        exercises: [
          {
            n: "Cable Tricep Pushdown (Straight Bar)",
            d: "4 sets × 15-12-12-10 reps · Elbows pinned at sides · Full extension · Squeeze at bottom",
            t: "triceps",
            s: 4,
            img: "Image/Cable Tricep Pushdown (Straight Bar).webp",
          },
          {
            n: "Overhead Tricep Extension (Dumbbell)",
            d: "3 sets × 12-12-10 reps · Both hands one dumbbell · Full stretch behind head · Slow lower",
            t: "triceps",
            s: 3,
            img: "Image/Overhead Tricep Extension (Dumbbell).jfif",
          },
          {
            n: "Barbell Skull Crusher",
            d: "3 sets × 12 reps · Bar to forehead · Elbows up · Controlled descent · Great long head stretch",
            t: "triceps",
            s: 3,
            img: "Image/Barbell Skull Crusher.webp",
          },
          {
            n: "Tricep Dips (Machine / Bench)",
            d: "3 sets × 12-10-10 reps · Body upright · Go deep · Elbows straight back · Lock at top",
            t: "triceps",
            s: 3,
            img: "Image/Tricep Dips (Machine Bench).jpeg",
          },
          {
            n: "Cable Overhead Tricep Extension (Rope)",
            d: "3 sets × 15 reps · Full stretch at bottom · Long head focus · Controlled motion",
            t: "triceps",
            s: 3,
            img: "Image/Cable Overhead Tricep Extension.png",
          },
        ],
      },
      {
        name: "🏋️ Abs Circuit",
        exercises: [
          {
            n: "Cable Crunch (Machine)",
            d: "3 sets × 15 reps · Squeeze core hard · Gap: 45 sec",
            t: "abs",
            s: 3,
            img: "Image/Cable Crunch (Machine).jfif",
          },
          {
            n: "Hanging Knee Raise / Leg Raise",
            d: "3 sets × 15 reps · No swinging · Lower slowly · Gap: 30 sec",
            t: "abs",
            s: 3,
            img: "Image/Hanging Knee Raise Leg Raise.jfif",
          },
          {
            n: "Plank Hold",
            d: "3 holds × 60–90 sec · Core like steel · Breathe · Gap: 30 sec",
            t: "abs",
            s: 3,
            img: "Image/Plank Hold.webp",
          },
          {
            n: "Russian Twist (Dumbbell)",
            d: "3 sets × 20 reps · Full rotation · Oblique fire · Gap: 30 sec",
            t: "abs",
            s: 3,
            img: "Image/Russian Twist (Dumbbell).webp",
          },
          {
            n: "Bicycle Crunch (Cycling Crunch)",
            d: "3 sets × 20 reps · Elbow to alternate knee · Gap: 30 sec",
            t: "abs",
            s: 3,
            img: "Image/Bicycle Crunch (Cycling Crunch).webp",
          },
          {
            n: "Lying Leg Raise (Flat Bench)",
            d: "3 sets × 15 reps · Lower back pressed down · Gap: 30 sec",
            t: "abs",
            s: 3,
            img: "Image/Lying Leg Raise (Flat Bench).jfif",
          },
        ],
      },
      {
        name: "🏃 Cardio Finish — Burn Zone",
        exercises: [
          {
            n: "Stair Climber",
            d: "10 min · Moderate pace · Squeeze glutes on every step · Gap: 0 sec",
            t: "cardio",
            s: 1,
            img: "Image/Stair Climber.gif",
          },
          {
            n: "Treadmill",
            d: "15 min · 5.5–6.5 km/h · Incline 3–5% · Burn final calories",
            t: "cardio",
            s: 1,
            img: "Image/Treadmill.webp",
          },
          {
            n: "Cross Trainer (Elliptical)",
            d: "10 min · High resistance · Arms FULLY active · Full body calorie burn",
            t: "cardio",
            s: 1,
            img: "Image/Cross Trainer (Elliptical).webp",
          },
        ],
      },
    ],
  },

  legs: {
    name: "Legs + Shoulders — Foundation Power",
    days: "Wednesday & Saturday",
    color: "green",
    cal: 750,
    tip: "⚡ LEG + SHOULDER DAY — Heaviest leg day first. Complete all leg work before moving to shoulders. Shoulders are fresh and strong after leg training. Focus on depth for all squat movements. Push through the burn on shoulder press.",
    sections: [
      {
        name: "🔥 Mandatory Warm-up (Lower Body Focus)",
        exercises: [
          {
            n: "Cycling Warm-up",
            d: "5 min · Focus on leg mobility · Gradually increase resistance · Gap: 0 sec",
            t: "warmup",
            s: 1,
            img: "Image/Cycling Warm-up.jpg",
          },
          {
            n: "Jumping Jacks",
            d: "2 sets × 30 reps · Full leg extension · Gap: 15 sec",
            t: "warmup",
            s: 2,
            img: "Image/Jumping Jacks.jfif",
          },
          {
            n: "Arm Circles",
            d: "1 min · Fwd & Back · Shoulder mobility · Gap: 0 sec",
            t: "warmup",
            s: 1,
            img: "Image/Arm Circles.webp",
          },
          {
            n: "Torso Twists",
            d: "1 min · Core mobility focus · Gap: 0 sec",
            t: "warmup",
            s: 1,
            img: "Image/Torso Twists.avif",
          },
        ],
      },
      {
        name: "🦵 Quads",
        exercises: [
          {
            n: "Barbell Back Squat / Smith Machine Squat",
            d: "4 sets × 15-12-10-10 reps · Depth to parallel or below · Core braced · Drive through heels",
            t: "legs",
            s: 4,
            img: "Image/Barbell Back Squat Smith Machine Squat.webp",
          },
          {
            n: "Sumo Squat (Barbell/Dumbbell)",
            d: "3 sets × 15 reps · Wide stance · Toes 45° out · Targets inner thigh + glutes deeply",
            t: "legs",
            s: 3,
            img: "Image/Sumo Squat Barbell Dumbbell.webp",
          },
          {
            n: "Leg Press Machine",
            d: "4 sets × 15-15-12-12 reps · Feet shoulder-width · Don't lock knees at top · Full deep range",
            t: "legs",
            s: 4,
            img: "Image/Leg Press Machine.jpeg",
          },
          {
            n: "Hack Squat Machine",
            d: "3 sets × 12 reps · Feet low on plate · Maximum quad stretch · Slow 3-sec descent",
            t: "legs",
            s: 3,
            img: "Image/Hack Squat Machine.webp",
          },
          {
            n: "Leg Extension Machine",
            d: "4 sets × 15-15-12-12 reps · Full extension · 2-sec slow lower · Pure quad isolation · Don't slam",
            t: "legs",
            s: 4,
            img: "Image/Leg Extension Machine.jfif",
          },
          {
            n: "Dumbbell Lunges",
            d: "3 sets × 12 reps each leg · Step forward · Knee to 90° · Push back with heel · Glutes + quads",
            t: "legs",
            s: 3,
            img: "Image/Dumbbell Lunges.jfif",
          },
          {
            n: "Step-ups (Bench/Box)",
            d: "3 sets × 12 reps each leg · Drive through heel · Control the descent · Great for glutes",
            t: "legs",
            s: 3,
            img: "Image/Step-ups.png",
          },
        ],
      },
      {
        name: "🦵 Hamstrings + Glutes",
        exercises: [
          {
            n: "Leg Curl Machine (Lying/Seated)",
            d: "4 sets × 15-12-12-10 reps · Full curl · Squeeze at top · 3-sec slow negative · Don't cheat",
            t: "legs",
            s: 4,
            img: "Image/Leg Curl Machine Lying Seated.jfif",
          },
          {
            n: "Seated Leg Curl Machine",
            d: "3 sets × 15 reps · Different angle — focused hamstring squeeze · Slow return",
            t: "legs",
            s: 3,
            img: "Image/Seated Leg Curl Machine.webp",
          },
          {
            n: "Romanian Deadlift (Barbell/Dumbbell)",
            d: "3 sets × 12 reps · Soft knees · Hinge hips back · Feel hamstring stretch · Bar close to shins",
            t: "legs",
            s: 3,
            img: "Image/Romanian Deadlift Barbell Dumbbell.webp",
          },
          {
            n: "Good Mornings (Barbell)",
            d: "3 sets × 12 reps · Light weight · Bar on upper back · Hip hinge · Deep hamstring stretch",
            t: "legs",
            s: 3,
            img: "Image/Good Mornings (Barbell).webp",
          },
        ],
      },
      {
        name: "🦶 Calves",
        exercises: [
          {
            n: "Standing Calf Raise (Machine/Barbell)",
            d: "4 sets × 20-20-20-20 reps · Full ROM · Pause 1 sec at top · Slow 3-sec lower · Burn!",
            t: "legs",
            s: 4,
            img: "Image/Standing Calf Raise (Machine Barbell).jfif",
          },
          {
            n: "Seated Calf Raise Machine",
            d: "3 sets × 20 reps · Different angle — soleus focus · Slow and controlled · Full stretch at bottom",
            t: "legs",
            s: 3,
            img: "Image/Seated Calf Raise Machine.jpg",
          },
          {
            n: "Calf Press (on Leg Press Machine)",
            d: "3 sets × 20 reps · Push with toes only · Full stretch · Burn out the calves",
            t: "legs",
            s: 3,
            img: "Image/Calf Press on Leg Press Machine.jpg",
          },
        ],
      },
      {
        name: "🎯 Shoulders",
        exercises: [
          {
            n: "Machine Shoulder Press",
            d: "4 sets × 15-12-10-10 reps · Don't lock elbows at top · Full ROM · Core braced tight",
            t: "shoulder",
            s: 4,
            img: "Image/Machine Shoulder Press.webp",
          },
          {
            n: "Dumbbell Lateral Raise",
            d: "3 sets × 15-15-12 reps · Slight forward lean · Raise to shoulder height · Slow lower 3 sec",
            t: "shoulder",
            s: 3,
            img: "Image/Dumbbell Lateral Raise.jfif",
          },
          {
            n: "Barbell / Dumbbell Front Raise",
            d: "3 sets × 12 reps · Alternate arms or together · Raise to eye level · Control the descent",
            t: "shoulder",
            s: 3,
            img: "Image/Barbell  Dumbbell Front Raise.jfif",
          },
          {
            n: "Face Pulls (Cable)",
            d: "3 sets × 15 reps · Pull towards face · External rotation · Rear delts + upper back",
            t: "shoulder",
            s: 3,
            img: "Image/Face Pulls.webp",
          },
        ],
      },
      {
        name: "🏃 Cardio Finish — Burn Zone",
        exercises: [
          {
            n: "Stair Climber",
            d: "10 min · Moderate pace · Squeeze glutes on every step · Gap: 0 sec",
            t: "cardio",
            s: 1,
            img: "Image/Stair Climber.gif",
          },
          {
            n: "Treadmill",
            d: "15 min · Incline 4–6% · Speed 5–6 km/h · Legs already tired = max fat burn",
            t: "cardio",
            s: 1,
            img: "Image/Treadmill.webp",
          },
          {
            n: "Cross Trainer (Elliptical)",
            d: "10 min · High resistance · Push through fatigue · Arms active · Full body finish",
            t: "cardio",
            s: 1,
            img: "Image/Cross Trainer (Elliptical).webp",
          },
        ],
      },
    ],
  },
};

const REST_EX = {
  sections: [
    {
      name: "🏃 Morning Fasted Walk (Priority #1)",
      exercises: [
        {
          n: "Brisk Outdoor Walk / Light Jog",
          d: "40–50 min fasted · Empty stomach = fat burning · Park, terrace, anywhere",
          t: "cardio",
          s: 1,
        },
      ],
    },
    {
      name: "🏋️ Chest & Back Home",
      exercises: [
        {
          n: "Wall Push-ups",
          d: "3 sets × 15 reps · Hands on wall, body at angle",
          t: "chest",
          s: 3,
        },
        {
          n: "Chair Dips (Triceps)",
          d: "3 sets × 10 reps · Hands on chair edge · Push up",
          t: "triceps",
          s: 3,
        },
        {
          n: "Standing Shoulder Taps",
          d: "3 sets × 20 taps · Push-up position · Alternating",
          t: "shoulder",
          s: 3,
        },
      ],
    },
    {
      name: "🦵 Legs Home",
      exercises: [
        {
          n: "Chair Squat / Sit-to-Stand",
          d: "3 sets × 15 reps · Sit fully then stand",
          t: "legs",
          s: 3,
        },
        {
          n: "Wall Sit Hold",
          d: "3 holds × 45–60 sec · Thighs parallel to floor",
          t: "legs",
          s: 3,
        },
        {
          n: "Standing Calf Raises",
          d: "3 sets × 25 reps · Full range · Slow lowering",
          t: "legs",
          s: 3,
        },
        {
          n: "Step-ups (Stair / Box)",
          d: "3 sets × 10 each leg · Cardio + glutes",
          t: "legs",
          s: 3,
        },
      ],
    },
    {
      name: "🎯 Abs Home",
      exercises: [
        {
          n: "Plank Hold",
          d: "3 holds × 45–60 sec · Build to 2 min over weeks",
          t: "abs",
          s: 3,
        },
        {
          n: "Crunches",
          d: "3 sets × 20 reps · Don't pull neck · Exhale at top",
          t: "abs",
          s: 3,
        },
        {
          n: "Seated Leg Raises",
          d: "3 sets × 15 reps · Chair edge · Both legs straight",
          t: "abs",
          s: 3,
        },
        {
          n: "Side Plank",
          d: "2 holds × 25–35 sec each · Hips up · Straight line",
          t: "abs",
          s: 2,
        },
      ],
    },
    {
      name: "🧘 Flexibility + Recovery",
      exercises: [
        {
          n: "Full Body Stretch Routine",
          d: "10–15 min · Hips, hamstrings, chest, shoulders, calves",
          t: "stretch",
          s: 1,
        },
        {
          n: "Deep Breathing (Pranayam)",
          d: "5 min · Anulom-vilom + kapalbhati · Reduces cortisol",
          t: "stretch",
          s: 1,
        },
      ],
    },
  ],
};

// CONFIG
const DAYMAP = {
  0: "rest",
  1: "back",
  2: "chest",
  3: "legs",
  4: "back",
  5: "chest",
  6: "legs",
};
const DNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WMETA = {
  back: "Back+Biceps",
  chest: "Chest+Triceps+Abs",
  legs: "Legs+Shoulders",
  rest: "Rest Day 🌙",
};
const WCOL = {
  back: "var(--blue)",
  chest: "var(--red)",
  legs: "var(--green)",
  rest: "var(--t3)",
};
const MAC = { cal: 950, p: 80, c: 100, f: 25, fib: 25 };
const WEEKLY_MENU = {
  0: {
    wake: {
      title: "Sprouts Poha",
      desc: "Light poha cooked with sprouted moong, onions, tomatoes and lemon.",
    },
    lunch: {
      title: "Dal + Chana Salad",
      desc: "Moong dal with a high-protein roasted chana salad and greens.",
    },
    dinner: {
      title: "Grilled Paneer + Jowar Roti",
      desc: "130g paneer grilled with spices, served with jowar roti and cucumber salad.",
    },
    brk1: {
      title: "Roasted Chana Snack",
      desc: "Spiced dry roasted chana with a squeeze of lemon.",
    },
  },
  1: {
    wake: {
      title: "Moong Sprouts Upma",
      desc: "Semolina upma upgraded with sprouted moong, peas and fresh coriander.",
    },
    lunch: {
      title: "Soya Bowl + Salad",
      desc: "Soya chunks cooked in light masala with a crunchy vegetable salad.",
    },
    dinner: {
      title: "Palak Paneer + Jowar Roti",
      desc: "Spinach paneer curry with fiber-rich jowar roti and salad.",
    },
    brk1: {
      title: "Poha Cups with Sprouts",
      desc: "Individual poha servings topped with sprouts and roasted peanuts.",
    },
  },
  2: {
    wake: {
      title: "Oats Chilla with Paneer",
      desc: "Savory oats pancakes stuffed with paneer and herbs.",
    },
    lunch: {
      title: "Dal Tadka + Chana Salad",
      desc: "Dal tadka plus a colourful chana salad with mint and lemon.",
    },
    dinner: {
      title: "Tofu Stir-Fry + Salad",
      desc: "Soya tofu stir-fry with bell peppers and a side greens salad.",
    },
    brk1: {
      title: "Sprouted Chana Chaat",
      desc: "Fresh sprouted chana tossed with onion, tomato and chaat masala.",
    },
  },
  3: {
    wake: {
      title: "Poha + Sprouts",
      desc: "Poha with peas, carrots and sprouted moong for a filling breakfast.",
    },
    lunch: {
      title: "Soya Curry + Jowar Roti",
      desc: "Tomato-based soya curry with a side of jowar roti and cucumber.",
    },
    dinner: {
      title: "Paneer Bhurji + Salad",
      desc: "Spicy paneer bhurji served with mixed salad and lemon wedges.",
    },
    brk1: {
      title: "Makhana + Green Tea",
      desc: "Light roasted makhana snack with a hot cup of green tea.",
    },
  },
  4: {
    wake: {
      title: "Sprouted Moong Salad",
      desc: "Crunchy moong sprout salad with tomato, onion and chaat masala.",
    },
    lunch: {
      title: "Dal + Paneer + Salad",
      desc: "Protein-rich dal with paneer cubes and a big fiber salad.",
    },
    dinner: {
      title: "Soya Kebab + Jowar Roti",
      desc: "Soya kebabs with herbs, served with jowar roti and mint chutney.",
    },
    brk1: {
      title: "Chana Crunch",
      desc: "Roasted chana tossed with spices and a pinch of kala namak.",
    },
  },
  5: {
    wake: {
      title: "Besan Chilla with Sprouts",
      desc: "Low-oil chickpea flour chilla stuffed with sprouts.",
    },
    lunch: {
      title: "Palak Dal + Paneer Salad",
      desc: "Green lentil dal with a paneer salad and fresh greens.",
    },
    dinner: {
      title: "Tofu Veg Bowl",
      desc: "Tofu and mixed vegetable bowl with lemon dressing.",
    },
    brk1: {
      title: "Poha with Peas",
      desc: "Light poha loaded with peas and mild spices.",
    },
  },
  6: {
    wake: {
      title: "Chana Paneer Wrap",
      desc: "Paneer and chana stuffed in a light jowar roti wrap.",
    },
    lunch: {
      title: "Dal + Soya + Salad",
      desc: "Mixed dal with soya pieces and a crisp salad.",
    },
    dinner: {
      title: "Paneer Tikka Bowl",
      desc: "Grilled paneer tikka with lettuce, tomato and onion salad.",
    },
    brk1: {
      title: "Sprouts Bhel",
      desc: "Crunchy sprouts bhel with veggies and tangy chutney.",
    },
  },
};
const COL = {
  amber: "var(--amber)",
  green: "var(--green)",
  blue: "var(--blue)",
  coral: "var(--red)",
  red: "var(--red)",
  purple: "var(--purple)",
  teal: "var(--teal)",
  orange: "var(--orange)",
};
const BGD = {
  amber: "rgba(217,119,6,.1)",
  green: "rgba(5,150,105,.1)",
  blue: "rgba(37,99,235,.1)",
  coral: "rgba(220,38,38,.1)",
  red: "rgba(220,38,38,.1)",
  purple: "rgba(124,58,237,.1)",
  teal: "rgba(13,148,136,.1)",
  orange: "rgba(234,88,12,.1)",
};
const TBADGE = {
  cardio: "color:var(--teal);background:rgba(13,148,136,.12)",
  warmup: "color:var(--t2);background:rgba(0,0,0,.06)",
  stretch: "color:var(--teal);background:rgba(13,148,136,.12)",
  chest: "color:var(--blue);background:rgba(37,99,235,.12)",
  back: "color:var(--blue);background:rgba(37,99,235,.12)",
  shoulder: "color:var(--purple);background:rgba(124,58,237,.12)",
  legs: "color:var(--green);background:rgba(5,150,105,.12)",
  abs: "color:var(--amber);background:rgba(217,119,6,.12)",
  biceps: "color:var(--orange);background:rgba(234,88,12,.12)",
  triceps: "color:var(--red);background:rgba(220,38,38,.12)",
  forearms: "color:var(--amber);background:rgba(217,119,6,.12)",
};

const S = {
  cal: 0,
  p: 0,
  c: 0,
  f: 0,
  fib: 0,
  done: new Set(),
  skipped: new Set(),
  water: 0,
  isab: [false, false],
};
const EX = {};
const CHALLENGE_DAYS = 90;
const CHALLENGE_WEIGHT_START = 120;
const CHALLENGE_WEIGHT_TARGET = 75;

const $ = (id) => document.getElementById(id);
const col = (k) => COL[k] || "var(--t)";
const bg = (k) => BGD[k] || "rgba(0,0,0,.05)";
const todayWT = () => DAYMAP[new Date().getDay()];
const isMobile = () => window.innerWidth <= 768;
const getAllEx = (type) => {
  if (type === "rest") return REST_EX.sections.flatMap((s) => s.exercises);
  return (WORKOUTS[type]?.sections || []).flatMap((s) => s.exercises);
};

// CLOCK + DATE
function tick() {
  const n = new Date(),
    p = (v) => String(v).padStart(2, "0");
  const h = n.getHours(),
    ampm = h >= 12 ? "PM" : "AM",
    h12 = h % 12 || 12;
  $("clk").textContent =
    `${p(h12)}:${p(n.getMinutes())}:${p(n.getSeconds())} ${ampm}`;
  const M = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if ($("dateLbl"))
    $("dateLbl").textContent =
      `${p(n.getDate())}-${M[n.getMonth()]}-${n.getFullYear()}`;

  // AI PERSONALIZED GREETING & GYM MODE
  let greet = "Hello Champ!";
  const isGymTime = h >= 3 && h <= 6;
  if (isGymTime) greet = "Rise & Grind! 🌅 Your 4AM session awaits.";
  else if (h < 12) greet = "Good Morning! Stay strong.";
  else if (h < 17) greet = "Good Afternoon! Hydrate well.";
  else greet = "Good Evening! Recovery mode on.";
  if ($("aiGreeting")) $("aiGreeting").textContent = greet;

  // DYNAMIC THEME SHIFT
  document.body.classList.toggle("gym-mode", isGymTime);

  // NIGHT SHIFT DETECTION (6:30 PM - 2:30 AM)
  const isNightShift = (h >= 18 && h <= 23) || (h >= 0 && h <= 2);
  document.body.classList.toggle("night-shift-active", isNightShift);
}

// DAY CHIP
function updDay() {
  const wt = todayWT();
  const chall = getChallengeInfo();
  const bgs = {
    back: "rgba(37,99,235,.1)",
    chest: "rgba(220,38,38,.1)",
    legs: "rgba(5,150,105,.1)",
    rest: "rgba(0,0,0,.05)",
  };
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dc = $("dayChip");
  dc.className = "day-chip-dynamic";
  dc.style.setProperty('--bg-dynamic', bgs[wt] || bgs.rest);
  dc.style.setProperty('--color-dynamic', WCOL[wt]);
  dc.style.setProperty('--border-dynamic', WCOL[wt] + '55');
  dc.textContent = `Day ${chall.day}/${CHALLENGE_DAYS} · ${days[new Date().getDay()]} · ${WMETA[wt]}`;
  dc.title = `90-Day Weight Loss Challenge — started ${chall.startDate} · ${chall.remaining} days left`;

  // Dynamic AI Greeting
  const hr = new Date().getHours();
  let g = "Hello Champ!";
  if (hr >= 4 && hr < 11) g = "Morning Champ! Hit the Gym? 🔥";
  else if (hr >= 11 && hr < 16) g = "Metabolism Peak! Drink up! 💧";
  else if (hr >= 16 && hr < 21) g = "Good Evening! Stay Focused! 🦾";
  else g = "Recovery Mode! Consistency is Key! 😴";
  const greetingEl = document.getElementById("aiGreeting");
  if (greetingEl) greetingEl.textContent = g;
}

// WEEK GRID
function buildWeek() {
  const today = new Date().getDay();
  const map = {
    1: "back",
    2: "chest",
    3: "legs",
    4: "back",
    5: "chest",
    6: "legs",
    0: "rest",
  };
  const meta = {
    back: "Back+Bi",
    chest: "Chest+Tri",
    legs: "Legs+Sh",
    rest: "Rest",
  };
  $("weekGrid").innerHTML = DNAMES.map((d, i) => {
    const wt = map[i];
    return `<div class="wd${i === today ? " tday" : ""}">
      <div class="wdn">${d}</div>
      <div class="wdt" style="color:${i === today ? "var(--green)" : WCOL[wt] || "var(--t3)"}">${meta[wt]}</div>
    </div>`;
  }).join("");
}

// MACROS
function updMacros() {
  const p = (v, t) => (339.3 * (1 - Math.min(v / t, 1))).toFixed(1);
  const c = (v, t) => (276.5 * (1 - Math.min(v / t, 1))).toFixed(1);
  const f = (v, t) => (213.6 * (1 - Math.min(v / t, 1))).toFixed(1);
  const fib = (v, t) => (150.8 * (1 - Math.min(v / t, 1))).toFixed(1);

  if ($("ringP")) $("ringP").style.strokeDashoffset = p(S.p, MAC.p);
  if ($("ringC")) $("ringC").style.strokeDashoffset = c(S.c, MAC.c);
  if ($("ringF")) $("ringF").style.strokeDashoffset = f(S.f, MAC.f);
  if ($("ringFib")) $("ringFib").style.strokeDashoffset = fib(S.fib, MAC.fib);

  $("calVal").textContent = S.cal;
  $("vP").textContent = `${S.p}/${MAC.p}g`;
  $("vC").textContent = `${S.c}/${MAC.c}g`;
  $("vF").textContent = `${S.f}/${MAC.f}g`;
  $("vFib").textContent = `${S.fib}/${MAC.fib}g`;

  const tp = Math.min((S.cal / MAC.cal) * 100, 100);
  if ($("topBar")) $("topBar").style.width = tp + "%";
  if ($("topVal")) $("topVal").textContent = `${S.cal}/${MAC.cal}`;
}

// DIET INTERACTIONS
function togCard(e, id) {
  if (e) e.stopPropagation();
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card) return;
  const isOpen = card.classList.toggle("open");
  // Toggle the meal body
  const body = card.querySelector(".mcb");
  if (body) {
    if (isOpen) {
      body.style.display = "block";
      body.style.animation = "fadeIn 0.25s ease";
    } else {
      body.style.display = "none";
    }
  }
}
function selOpt(mid, btn) {
  document
    .getElementById("og_" + mid)
    .querySelectorAll(".opp")
    .forEach((b) => b.classList.remove("sel"));
  btn.classList.add("sel");
  const d = $("od_" + mid);
  d.textContent = btn.dataset.desc;
  d.classList.add("on");
}

// RENDER DIET
function renderChallengeCard() {
  const info = getChallengeInfo();
  const progressPct = Math.min(100, Math.round((info.day / CHALLENGE_DAYS) * 100));
  const statusText = info.started
    ? `Today is Day ${info.day} of ${CHALLENGE_DAYS}`
    : "Challenge not started yet. Tap start to begin your 90-day weight loss journey.";
  const countText = info.started ? `${info.day}/${CHALLENGE_DAYS}` : `0/${CHALLENGE_DAYS}`;
  const actionLabel = info.started ? "Restart Challenge" : "Start Challenge";
  const buttonAction = "startChallenge()";
  const html = `
    <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <div style="font-size:13px;font-weight:800;color:var(--t);">${statusText}</div>
      </div>
      <div style="min-width:160px;text-align:right;">
        <div style="font-size:22px;font-weight:900;color:var(--green);">${countText}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:4px;">${info.remaining} days left</div>
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;">
      <div class="g-chip small" style="background:rgba(16,185,129,.12);color:var(--green);min-width:max-content;">🥣 Poha + Sprouts</div>
      <div class="g-chip small" style="background:rgba(37,99,235,.12);color:var(--blue);min-width:max-content;">🥗 Chana Salad</div>
      <div class="g-chip small" style="background:rgba(249,115,22,.12);color:var(--amber);min-width:max-content;">🥘 Dal + Paneer</div>
      <div class="g-chip small" style="background:rgba(5,150,105,.12);color:var(--teal);min-width:max-content;">🌾 Jowar Roti</div>
    </div>
    <div style="margin-top:14px;height:10px;background:var(--bg4);border-radius:999px;overflow:hidden;">
      <div style="height:100%;width:${progressPct}%;background:linear-gradient(90deg,var(--green),var(--blue));border-radius:999px;"></div>
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <button class="wt-save-btn" style="min-width:170px;" onclick="${buttonAction}">${actionLabel}</button>
      ${info.started ? `<button class="wt-save-btn" style="min-width:170px;background:var(--bg3);color:var(--t2);border:1px solid var(--bd);" onclick="resetChallenge()">Reset Challenge</button>` : ""}
    </div>
    <div style="margin-top:12px;font-size:11px;color:var(--t3);">Stay on track: 3 strong meals, 8 glasses water, 2 fiber boosts, and lean vegetarian protein every day.</div>
  `;
  $("challengeSummary").innerHTML = html;
}

function renderSidebarChallenge() {
  const info = getChallengeInfo();
  const progressPct = Math.min(100, Math.round((info.day / CHALLENGE_DAYS) * 100));
  const html = `
    <div style="display:grid;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="font-size:14px;font-weight:900;color:var(--t);">${info.started ? `Day ${info.day}` : "Challenge paused"}</div>
        <div style="font-size:12px;color:var(--t3);">${info.remaining} days left</div>
      </div>
      <div style="height:8px;background:var(--bg4);border-radius:999px;overflow:hidden;">
        <div style="height:100%;width:${progressPct}%;background:linear-gradient(90deg,var(--green),var(--blue));"></div>
      </div>
      <div style="display:grid;gap:8px;font-size:12px;color:var(--t2);line-height:1.5;">
        <div>✅ Lean vegetarian meals with poha, chana, sprouts, dal, paneer and soya.</div>
        <div>✅ Maintain 950 kcal, 80g protein, 25g fiber, and 8+ glasses water daily.</div>
        <div>✅ Rotate salads, jowar roti, and low-oil dal each day.</div>
      </div>
      <button class="wt-save-btn" style="width:100%;min-width:0;" onclick="startChallenge()">${info.started ? "Restart Challenge" : "Start 90-Day Challenge"}</button>
    </div>
  `;
  $("sidebarChallengeContent").innerHTML = html;
}

function renderDiet() {
  renderChallengeCard();
  renderSidebarChallenge();
  const tl = $("dietTL");
  let html = "";
  const todayIndex = new Date().getDay();
  const todayMenu = WEEKLY_MENU[todayIndex] || {};
  DIET.forEach((s) => {
    // Phase dividers
    if (s.id === "pregym")
      html += `<div class="phase-div"><div class="phase-line" style="background:linear-gradient(90deg,transparent,rgba(251,146,60,0.25))"></div><div class="phase-chip" style="color:var(--orange);border-color:rgba(251,146,60,0.3);background:rgba(251,146,60,0.06)">🌙 Post-Shift — Pre-Gym</div><div class="phase-line" style="background:linear-gradient(90deg,rgba(251,146,60,0.25),transparent)"></div></div>`;
    if (s.id === "wake")
      html += `<div class="phase-div"><div class="phase-line" style="background:linear-gradient(90deg,transparent,rgba(16,185,129,0.25))"></div><div class="phase-chip" style="color:var(--green);border-color:rgba(16,185,129,0.3);background:rgba(16,185,129,0.06)">☀️ Awake — Meal Time</div><div class="phase-line" style="background:linear-gradient(90deg,rgba(16,185,129,0.25),transparent)"></div></div>`;
    if (s.id === "brk1")
      html += `<div class="phase-div"><div class="phase-line" style="background:linear-gradient(90deg,transparent,rgba(75,131,232,0.25))"></div><div class="phase-chip" style="color:var(--blue);border-color:rgba(75,131,232,0.3);background:rgba(75,131,232,0.06)">💼 Night Shift — 6:30 PM to 2:30 AM</div><div class="phase-line" style="background:linear-gradient(90deg,rgba(75,131,232,0.25),transparent)"></div></div>`;
    
    const dotC = col(s.color || "green");
    let card = "";
    
    if (s.type === "sleep") {
      card = `<div class="sleep-blk">
        <div class="sleep-blk-ico">🌙</div>
        <div class="sleep-blk-info">
          <div class="sleep-blk-title">Deep Sleep — Fat Burning Mode 🔥</div>
          <div class="sleep-blk-sub">6:15 AM – 12:00 PM · ~5hr 45min · GH hormone peaks at max · Body burns stored fat passively</div>
          <div class="sleep-blk-stats" style="margin-top:12px; display:flex; gap:6px; flex-wrap:wrap;">
            <span class="sleep-stat">💤 ~6 hrs</span>
            <span class="sleep-stat">🔥 Fat burn</span>
            <span class="sleep-stat">💪 Muscle repair</span>
          </div>
        </div>
      </div>`;
      html += `<div class="trow sr">
        <div class="tt" style="color:var(--purple);font-weight:800;padding-top:16px;">😴</div>
        <div class="tdw"><div class="tdot" style="background:var(--purple);border:2.5px solid var(--bg2);width:12px;height:12px;"></div></div>
        <div class="tcrd">${card}</div>
      </div>`;
      return;
    } else if (s.type === "gymblock") {
      const wd = WORKOUTS[todayWT()];
      card = `<div class="gymb morning" onclick="showTab('workout',null);window.scrollTo({top:0,behavior:'smooth'})" style="display:flex;align-items:center;gap:14px; padding:16px;">
        <div class="gymb-ico" style="flex-shrink:0; font-size:32px;">🌅</div>
        <div style="flex:1;min-width:0;text-align:left;">
          <div class="morning-badge" style="margin-bottom:6px;">☀️ Morning Session</div>
          <div class="gymb-title" style="font-weight:900; font-size:16px; color:var(--t);">${wd.name}</div>
          <div class="gymb-sub" style="font-size:12px; color:var(--t3); margin-top:4px;">🕓 04:00 AM – 06:00 AM · ${wd.days} · ~${wd.cal} kcal</div>
        </div>
        <div style="font-size:24px; color:var(--gold); opacity:0.6;">↗</div>
      </div>`;
    } else if (s.type === "supp") {
      const macros = s.cal ? `
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <div class="g-chip"><span style="color:var(--gold)">🔥</span><span>${s.cal}</span></div>
          ${s.p ? `<div class="g-chip"><span style="color:var(--blue)">P</span><span>${s.p}g</span></div>` : ""}
          ${s.fib ? `<div class="g-chip"><span style="color:var(--teal)">F</span><span>${s.fib}g</span></div>` : ""}
        </div>` : "";

      card = `<div class="p-card sc" style="padding:0; border-top:4px solid ${col(s.color)}; box-shadow:var(--shadow-md);">
        <div class="sc-header" style="display:flex; align-items:center; gap:12px; padding:16px;">
          <div style="width:44px; height:44px; border-radius:14px; background:${col(s.color)}15; display:flex; align-items:center; justify-content:center; font-size:24px; border:1px solid ${col(s.color)}20;">${s.icon}</div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:2px;">
              <div class="scn" style="color:var(--t); font-weight:900; font-size:15px;">${s.name}</div>
              <div style="font-size:9px; background:${col(s.color)}12; color:${col(s.color)}; padding:2px 8px; border-radius:20px; font-weight:900; border:1px solid ${col(s.color)}25; text-transform:uppercase; letter-spacing:0.5px;">${s.tag}</div>
            </div>
            <div style="font-size:12px; color:var(--t3); font-weight:600;">Scheduled for ${s.disp}</div>
          </div>
        </div>
        <div style="padding:0 16px 16px; border-top:1px solid var(--bd);">
          <div style="font-size:13px; color:var(--t2); line-height:1.6; margin-top:12px;">${s.desc}</div>
          <div style="font-size:12px; color:var(--t3); font-style:italic; line-height:1.5; margin-top:8px; padding-top:8px; border-top:1px dashed var(--bd);">${s.why}</div>
          ${macros}
        </div>
      </div>`;
    } else {
      const ii = s.items
        ? `<ul class="il" style="margin-top:14px; border-top:1px solid var(--bd); padding-top:14px; display:block;">${s.items.map((it) => `<li class="ili" style="margin-bottom:6px; color:var(--t2); font-size:13px;">${it}</li>`).join("")}</ul>`
        : "";
      const oi = s.opts
        ? `<div class="og" id="og_${s.id}" style="margin-top:14px; display:grid; grid-template-columns:1fr; gap:8px;">${s.opts.map((o) => `<button class="opp" onclick="selOpt('${s.id}',this)" data-desc="${o.desc}" style="text-align:left; justify-content:flex-start; padding:12px 14px; font-weight:700;">${o.id}: ${o.label}</button>`).join("")}</div><div class="odesc" id="od_${s.id}" style="margin-top:10px; padding:10px; background:var(--bg3); border-radius:8px; font-size:12px; color:var(--t2); display:none;"></div>`
        : "";
      
      const macroBadges = `
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <div class="g-chip"><span style="color:var(--gold)">🔥</span><span>${s.cal}</span></div>
          <div class="g-chip"><span style="color:var(--blue)">P</span><span>${s.p}g</span></div>
          ${s.c ? `<div class="g-chip"><span style="color:var(--green)">C</span><span>${s.c}g</span></div>` : ""}
          ${s.fib ? `<div class="g-chip"><span style="color:var(--teal)">F</span><span>${s.fib}g</span></div>` : ""}
        </div>`;

      const dailyMenu = todayMenu[s.id];

      card = `<div class="p-card mc" data-id="${s.id}" style="padding:0; box-shadow:var(--shadow-md);">
        <div class="mch" onclick="togCard(event,'${s.id}')" style="padding:16px; display:flex; align-items:flex-start; gap:12px;">
          <div class="mcico" style="background:${bg(s.color)}; width:46px; height:46px; border-radius:16px; font-size:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${s.icon}</div>
          <div class="mcnfo" style="flex:1; min-width:0; display:flex; flex-direction:column; gap:6px;">
            <div class="mcnm" style="font-weight:900; font-size:16px; color:var(--t); line-height:1.2;">${s.name}</div>
            <div class="mcsb" style="font-size:12px; color:var(--t3); margin-top:0;">${s.sub}</div>
            ${macroBadges}
          </div>
        </div>
        <div class="mcrt" style="padding:0 16px 16px; display:flex; gap:8px; align-items:center;">
          <button class="btn-skip" id="skp_${s.id}" onclick="skipMeal(event,'${s.id}')">✕</button>
          <button class="btn-done" id="chk_${s.id}" onclick="togMeal(event,'${s.id}')">✓</button>
        </div>
        <div class="mcb" style="padding:0 16px 16px; display:none;">${ii}${oi}</div>
      </div>`;
    }

    html += `<div class="trow${s.type === "supp" ? " trow-supp" : ""}">
      <div class="tt" id="tt_${s.id}">${s.disp}</div>
      <div class="tdw">
        <div class="tdot" id="dt_${s.id}" style="background:${dotC}; border:2.5px solid var(--bg2); width:12px; height:12px;"></div>
      </div>
      <div class="tcrd">${card}</div>
    </div>`;
  });
  tl.innerHTML = html;
}

// HIGHLIGHT CURRENT SLOT
function hlSlot() {
  const n = new Date(),
    cur = n.getHours() * 60 + n.getMinutes();
  const toM = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m + (h < 12 ? 1440 : 0);
  };
  const ca = cur < 720 ? cur + 1440 : cur;
  let ai = -1;
  for (let i = 0; i < DIET.length; i++) {
    const t = toM(DIET[i].time),
      nx = i + 1 < DIET.length ? toM(DIET[i + 1].time) : t + 90;
    if (ca >= t && ca < nx) {
      ai = i;
      break;
    }
  }
  DIET.forEach((s, i) => {
    const card = document.querySelector(`[data-id="${s.id}"]`);
    if (card && s.type === "meal")
      card.classList.toggle("anow", i === ai && !S.done.has(s.id));
    const dt = $("dt_" + s.id),
      tt = $("tt_" + s.id);
    if (dt) {
      dt.classList.toggle("now", i === ai);
      dt.classList.toggle("active", i === ai);
    }
    if (tt) tt.classList.toggle("now", i === ai);
  });
}

// WORKOUT BUILDER
function buildWorkoutHTML(type) {
  const isRest = type === "rest";
  const wd = isRest
    ? {
        name: "Active Recovery",
        days: "Sunday",
        color: "rest",
        cal: 200,
        tip: "Active recovery burns calories without straining joints. Morning fasted walk is the #1 priority today.",
        sections: REST_EX.sections,
      }
    : WORKOUTS[type];
  if (!EX[type]) EX[type] = {};
  const allEx = getAllEx(type);
  let exIdx = 0,
    secHTML = "";
  wd.sections.forEach((sec) => {
    secHTML += `<div class="sec-hdr">
          <div class="sec-line"></div>
          <div class="sec-lbl">${sec.name}</div>
          <div class="sec-line"></div>
        </div>
        <div class="exlist" style="display:flex; flex-direction:column; gap:10px;">`;
    sec.exercises.forEach((ex) => {
      const i = exIdx++;
      if (!EX[type][i]) EX[type][i] = { done: 0, completed: false };
      const tb = TBADGE[ex.t] || "color:var(--t2);background:rgba(0,0,0,.06)";
      const setDots =
        ex.s > 1
          ? `<div class="set-row-new" id="sr_${type}_${i}">${Array.from(
              { length: ex.s },
              (_, si) =>
                `<div class="set-dot-new${EX[type][i].done > si ? " dn" : ""}" onclick="togSet('${type}',${i},${si})">${si + 1}</div>`,
            ).join("")}</div>`
          : "";
      const voiceBtn = `<button class="btn-haptic" onclick="speakEx('${ex.n}. ${ex.d.split("·")[0]}')" style="background:var(--bg3); border:1px solid var(--bd); color:var(--gold); width:32px; height:32px; border-radius:10px; font-size:14px; display:flex; align-items:center; justify-content:center;">🔊</button>`;
      const ck =
        ex.s === 1
          ? `<button class="exck${EX[type][i].completed ? " dn" : ""}" id="ek_${type}_${i}" onclick="togSingle('${type}',${i})" style="width:40px; height:40px; border-radius:12px; font-size:18px;">✓</button>`
          : "";
      const imgSrc = ex.img
        ? `<img src="${ex.img}" loading="lazy" style="width:100%;height:100%;border-radius:8px;object-fit:contain;background:var(--bg);border:1px solid var(--bd);padding:2px;">`
        : "";

      secHTML += `<div class="p-card ex-card-new${EX[type][i].completed ? " done-ex" : ""}" id="exc_${type}_${i}">
        <div class="ex-img-wrap">${imgSrc}</div>
        <div class="ex-info-new">
          <div class="ex-title-new" style="display:flex; align-items:flex-start; gap:8px;">
            <div class="ex-num-new">${i + 1}</div>
            <div class="exnm" style="font-size:16px; font-weight:800; color:var(--t); line-height:1.2;">${ex.n}</div>
          </div>
          <div class="exdt" style="font-size:12px; margin-top:4px; opacity:0.8;">${ex.d}</div>
          <div style="display:flex; gap:6px; margin-top:10px;">
            <div class="extbadge" style="font-size:10px; ${tb}">${ex.t}</div>
            ${ex.s > 1 ? `<div style="font-size:10px; font-weight:800; color:var(--t3); background:var(--bg3); padding:3px 8px; border-radius:12px; border:1px solid var(--bd)">${ex.s} Sets</div>` : ""}
          </div>
        </div>
        <div class="ex-actions-new">
          ${voiceBtn}${setDots}${ck}
        </div>
      </div>`;
    });
    secHTML += `</div>`;
  });
  const done = allEx.filter(
    (_, i) => EX[type][i] && EX[type][i].completed,
  ).length;
  const pct = allEx.length > 0 ? (done / allEx.length) * 100 : 0;
  const totalSets = allEx.reduce((a, e) => a + (e.s || 1), 0);
  const wc = WCOL[wd.color || type] || "var(--green)";

  // Build breakdown for gym days
  let breakdownHTML = "";
  if (!isRest) {
    const typeColors = {
      warmup: { c: "var(--orange)", bg: "rgba(234,88,12,.12)", icon: "🔥" },
      cardio: { c: "var(--teal)", bg: "rgba(13,148,136,.12)", icon: "🏃" },
      chest: { c: "var(--blue)", bg: "rgba(37,99,235,.12)", icon: "💪" },
      back: { c: "var(--blue)", bg: "rgba(37,99,235,.12)", icon: "🏋️" },
      shoulder: { c: "var(--purple)", bg: "rgba(124,58,237,.12)", icon: "🎯" },
      biceps: { c: "var(--orange)", bg: "rgba(234,88,12,.12)", icon: "💪" },
      triceps: { c: "var(--red)", bg: "rgba(220,38,38,.12)", icon: "💪" },
      forearms: { c: "var(--amber)", bg: "rgba(217,119,6,.12)", icon: "✊" },
      legs: { c: "var(--green)", bg: "rgba(5,150,105,.12)", icon: "🦵" },
      abs: { c: "var(--amber)", bg: "rgba(217,119,6,.12)", icon: "🎯" },
    };
    const typeLabels = {
      warmup: "Warm-up",
      cardio: "Cardio",
      chest: "Chest",
      back: "Back",
      shoulder: "Shoulders",
      biceps: "Biceps",
      triceps: "Triceps",
      forearms: "Forearms",
      legs: "Legs/Glutes",
      abs: "Abs/Core",
    };
    const counts = {},
      setCounts = {};
    allEx.forEach((ex) => {
      const t = ex.t || "other";
      counts[t] = (counts[t] || 0) + 1;
      setCounts[t] = (setCounts[t] || 0) + (ex.s || 1);
    });
    const machines = allEx.filter(
      (e) =>
        e.n.includes("Machine") ||
        e.n.includes("Cable") ||
        e.n.includes("Treadmill") ||
        e.n.includes("Cross Trainer") ||
        e.n.includes("Cycling") ||
        e.n.includes("Elliptical"),
    ).length;
    const dumbbells = allEx.filter(
      (e) =>
        e.n.toLowerCase().includes("dumbbell") ||
        e.n.toLowerCase().includes("hammer curl"),
    ).length;
    const barbells = allEx.filter((e) =>
      e.n.toLowerCase().includes("barbell"),
    ).length;
    const bodyweight = allEx.filter((e) =>
      [
        "Plank",
        "Bicycle Crunch",
        "Hanging",
        "Lying Leg",
        "Russian Twist",
        "Good Morning",
        "Ab Wheel",
      ].some((kw) => e.n.includes(kw)),
    ).length;
    const chips = Object.entries(counts)
      .map(([t, cnt]) => {
        const tc = typeColors[t] || {
          c: "var(--t2)",
          bg: "rgba(0,0,0,.03)",
          icon: "⚡",
        };
        const lbl = typeLabels[t] || t;
        return `<div style="display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid var(--bd);border-radius:16px;padding:12px 14px;box-shadow:var(--shadow-sm);">
            <div style="font-size:20px; background:${tc.c}15; width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; border:1px solid ${tc.c}25;">${tc.icon}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:900;color:var(--t)">${lbl}</div>
              <div style="font-size:11px;color:var(--t3);margin-top:2px; font-weight:700;">${cnt} ex · <span style="color:${tc.c}">${setCounts[t]} sets</span></div>
            </div>
          </div>`;
      })
      .join("");
    breakdownHTML = `
        <div style="border-top:1px solid var(--bd);margin-top:20px;padding-top:20px">
          <div style="font-size:11px;font-weight:900;letter-spacing:1px;color:${wc};text-transform:uppercase;margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            <span style="background:${wc}22; padding:4px 8px; border-radius:6px;">📊</span> Exercise Breakdown
          </div>
          <div class="breakdown-wrapper" style="display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:14px;scrollbar-width:none;-ms-overflow-style:none;">
            <div class="g-chip" style="background:${wc}12; border-color:${wc}25; color:${wc}"><span>🏋️</span><span>${machines} Machines</span></div>
            <div class="g-chip" style="background:rgba(139,92,246,0.1); border-color:rgba(139,92,246,0.2); color:var(--purple)"><span>🔵</span><span>${dumbbells} DBs</span></div>
            <div class="g-chip" style="background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.2); color:var(--red)"><span>🔴</span><span>${barbells} BBs</span></div>
            <div class="g-chip" style="background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.2); color:var(--green)"><span>🤸</span><span>${bodyweight} BW</span></div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:4px;">${chips}</div>
        </div>`;
  }

  const quotes = [
    "Sweat is just fat crying. Keep going! 💧",
    "Discipline is doing what needs to be done, even if you don't want to. 🦾",
    "Success is hidden in your daily routine. 🏆",
    "You don't have to be great to start, but you have to start to be great. 🚀",
  ];
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  const quoteHTML = `
      <div style="text-align:center; padding:40px 20px; border-top:1px dashed var(--bd); margin-top:30px; opacity:0.8; background:linear-gradient(to bottom, transparent, var(--bg3)); border-radius:0 0 24px 24px;">
        <div style="font-size:16px; font-style:italic; font-family:'Manrope',sans-serif; font-weight:800; color:var(--t2); line-height:1.6;">"${randomQuote}"</div>
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-top:12px; font-weight:900; color:var(--gold);">FitOS Motivation · Keep Pushing</div>
      </div>`;

  if (isRest) {
    return `<div class="p-card wo-header" style="border-top:6px solid var(--t3); background:var(--bg2); margin-bottom:20px; padding:32px 24px; text-align:center; box-shadow:var(--shadow-lg);">
            <div style="font-size:52px; margin-bottom:16px; animation: float 3s ease-in-out infinite;">🌙</div>
            <div class="wo-day" style="color:var(--t); font-size:32px; font-weight:900; letter-spacing:-1.2px;">Recovery Mode</div>
            <div class="wo-meta" style="font-size:13px; font-weight:700; color:var(--t3); margin-top:6px; text-transform:uppercase; letter-spacing:1px;">Sunday · Active Rest & Reset</div>
            <div style="background:var(--bg3); padding:20px; border-radius:20px; font-size:14px; font-style:italic; border:1px solid var(--bd); max-width:400px; margin:24px auto; line-height:1.6; color:var(--t2);">
              "${wd.tip}"
            </div>
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:32px;">
                <div style="text-align:center;"><div style="font-size:28px; margin-bottom:6px;">💧</div><div style="font-size:11px; font-weight:900; color:var(--t3);">HYDRATE</div></div>
                <div style="text-align:center;"><div style="font-size:28px; margin-bottom:6px;">🥗</div><div style="font-size:11px; font-weight:900; color:var(--t3);">CLEAN DIET</div></div>
                <div style="text-align:center;"><div style="font-size:28px; margin-bottom:6px;">🧘</div><div style="font-size:11px; font-weight:900; color:var(--t3);">STRETCH</div></div>
            </div>
          </div>
          <div style="padding:0 4px">${secHTML}</div>
          ${quoteHTML}`;
  }

  return `<div class="p-card wo-header" style="border-top:6px solid ${wc}; background:var(--bg2); margin-bottom:16px; padding:18px; border-radius:22px; box-shadow:var(--shadow-lg);">
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:nowrap; min-width:0;">
      <div class="ex-num-new" style="background:${wc}; color:white; width:40px; height:40px; font-size:18px; font-weight:900; border-radius:14px; box-shadow:0 6px 16px ${wc}33; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${wd.name.charAt(0)}</div>
      <div style="flex:1 1 auto; min-width:0;">
        <div class="wo-day" style="color:var(--t); font-size:24px; font-weight:900; letter-spacing:-0.8px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${wd.name}</div>
        <div class="wo-meta" style="font-size:11px; font-weight:800; color:var(--t3); margin-top:4px; text-transform:uppercase; letter-spacing:0.4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${wd.days} · Fit Master Gym</div>
      </div>
      <div style="font-size:10px; font-weight:900; background:var(--bg3); color:var(--t2); padding:6px 12px; border-radius:22px; border:1px solid var(--bd); text-transform:uppercase; letter-spacing:1px; white-space:nowrap;">🌅 4 AM – 6 AM</div>
    </div>
    <div class="wo-tip" style="background:var(--bg3); padding:14px 18px; border-radius:18px; font-size:12px; border:1px solid var(--bd); margin-bottom:24px; font-style:italic; line-height:1.6; color:var(--t2);">"${wd.tip}"</div>
    <div class="wo-stats" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:16px;">
      <div style="text-align:center; background:var(--bg2); padding:12px 6px; border-radius:18px; border:1px solid var(--bd); box-shadow:var(--shadow-sm);">
        <div class="ws-v" id="wod_${type}" style="color:${wc}; font-weight:900; font-size:20px; font-family:var(--mono);">${done}/${allEx.length}</div>
        <div class="ws-l" style="font-size:9px; font-weight:900; color:var(--t3); margin-top:4px; text-transform:uppercase; letter-spacing:1px;">Ex</div>
      </div>
      <div style="text-align:center; background:var(--bg2); padding:12px 6px; border-radius:18px; border:1px solid var(--bd); box-shadow:var(--shadow-sm);">
        <div class="ws-v" style="color:var(--amber); font-weight:900; font-size:20px; font-family:var(--mono);">${totalSets}</div>
        <div class="ws-l" style="font-size:9px; font-weight:900; color:var(--t3); margin-top:4px; text-transform:uppercase; letter-spacing:1px;">Sets</div>
      </div>
      <div style="text-align:center; background:var(--bg2); padding:12px 6px; border-radius:18px; border:1px solid var(--bd); box-shadow:var(--shadow-sm);">
        <div class="ws-v" style="color:var(--red); font-weight:900; font-size:20px; font-family:var(--mono);">~${wd.cal}</div>
        <div class="ws-l" style="font-size:9px; font-weight:900; color:var(--t3); margin-top:4px; text-transform:uppercase; letter-spacing:1px;">Kcal</div>
      </div>
      <div style="text-align:center; background:var(--bg2); padding:12px 6px; border-radius:18px; border:1px solid var(--bd); box-shadow:var(--shadow-sm);">
        <div class="ws-v" style="color:var(--green); font-weight:900; font-size:20px; font-family:var(--mono);">${Math.round(pct)}%</div>
        <div class="ws-l" style="font-size:9px; font-weight:900; color:var(--t3); margin-top:4px; text-transform:uppercase; letter-spacing:1px;">Prog</div>
      </div>
    </div>
    <div class="progbar" style="height:8px; background:var(--bg4); border-radius:20px; margin-bottom:20px; overflow:hidden; box-shadow:inset 0 1px 3px rgba(0,0,0,0.05);">
      <div class="progfill" id="pb_${type}" style="width:${pct}%; height:100%; background:linear-gradient(90deg, ${wc}, ${wc}aa); border-radius:20px; transition:width 1s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
    </div>
    ${breakdownHTML}
  </div>
  <div style="padding:0 4px">${secHTML}</div>
  ${quoteHTML}`;
}

function updWoProg(type) {
  const exList = getAllEx(type);
  const done = exList.filter(
    (_, i) => EX[type] && EX[type][i] && EX[type][i].completed,
  ).length;
  const pct = exList.length > 0 ? (done / exList.length) * 100 : 0;
  const pb = document.getElementById(`pb_${type}`);
  const wd = document.getElementById(`wod_${type}`);
  if (pb) pb.style.width = pct + "%";
  if (wd) wd.textContent = `${done}/${exList.length}`;
  if (done === exList.length && done > 0 && !window.__confettiFired) {
    window.__confettiFired = true;
    if (window.fireConfetti) window.fireConfetti();
    if (window.showToast)
      window.showToast("Workout Complete! You are a BEAST!", "🏆");
    setTimeout(() => (window.__confettiFired = false), 10000); // reset after 10s
  }
}

function scrollToNextEx(type, ei) {
  const nextCard = document.getElementById(`exc_${type}_${ei + 1}`);
  if (nextCard)
    setTimeout(
      () => nextCard.scrollIntoView({ behavior: "smooth", block: "center" }),
      600,
    );
}

// ============================================================
// ALL WORKOUTS OVERVIEW
// ============================================================
function buildAllWorkouts() {
  const days = [
    { day: "Monday", type: "back" },
    { day: "Tuesday", type: "chest" },
    { day: "Wednesday", type: "legs" },
    { day: "Thursday", type: "back" },
    { day: "Friday", type: "chest" },
    { day: "Saturday", type: "legs" },
    { day: "Sunday", type: "rest" },
  ];
  const todayIdx = new Date().getDay(); // 0=Sun
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
  const todayDayName = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][todayIdx];

  // Grand totals across all unique workout types
  const types = ["back", "chest", "legs", "rest"];
  let grandEx = 0,
    grandSets = 0,
    grandCal = 0;
  types.forEach((t) => {
    const ex = getAllEx(t);
    grandEx += ex.length;
    grandSets += ex.reduce((a, e) => a + (e.s || 1), 0);
    grandCal += t === "rest" ? 200 : WORKOUTS[t]?.cal || 0;
  });
  const weekCal =
    WORKOUTS.back.cal * 2 +
    WORKOUTS.chest.cal * 2 +
    WORKOUTS.legs.cal * 2 +
    200;

  let html = `
      <div style="padding:0 0 16px">
        <!-- Header -->
        <div class="p-card all-header-premium" style="padding:32px; margin-bottom:24px; border-radius:24px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
             <div class="ex-num-new" style="background:var(--gold); color:white; width:36px; height:36px; font-size:16px; box-shadow:0 8px 16px var(--gold-b)">P</div>
             <div>
                <div style="font-family:'Raleway',sans-serif;font-size:26px;font-weight:900;color:var(--t);letter-spacing:-1px; line-height:1;">Global Workout Plan</div>
                <div style="font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px; margin-top:4px;">Weekly Transformation Blueprint</div>
             </div>
          </div>
          <div style="font-size:12px;color:var(--t2);margin-bottom:24px; font-weight:600; opacity:0.8;">Fit Master Gym, Gota · Ahmedabad · 🌅 4:00 AM – 6:00 AM</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
            <div style="text-align:center;background:rgba(0,0,0,0.02);border:1px solid var(--bd);border-radius:18px;padding:14px 6px">
              <div style="font-family:var(--mono);font-size:22px;font-weight:900;color:var(--gold)">6</div>
              <div style="font-size:9px;color:var(--t3);margin-top:2px;font-weight:900;text-transform:uppercase; letter-spacing:1px;">Days</div>
            </div>
            <div style="text-align:center;background:rgba(0,0,0,0.02);border:1px solid var(--bd);border-radius:18px;padding:14px 6px">
              <div style="font-family:var(--mono);font-size:22px;font-weight:900;color:var(--blue)">${grandEx}</div>
              <div style="font-size:9px;color:var(--t3);margin-top:2px;font-weight:900;text-transform:uppercase; letter-spacing:1px;">Ex</div>
            </div>
            <div style="text-align:center;background:rgba(0,0,0,0.02);border:1px solid var(--bd);border-radius:18px;padding:14px 6px">
              <div style="font-family:var(--mono);font-size:22px;font-weight:900;color:var(--amber)">${grandSets}</div>
              <div style="font-size:9px;color:var(--t3);margin-top:2px;font-weight:900;text-transform:uppercase; letter-spacing:1px;">Sets</div>
            </div>
            <div style="text-align:center;background:rgba(0,0,0,0.02);border:1px solid var(--bd);border-radius:18px;padding:14px 6px">
              <div style="font-family:var(--mono);font-size:20px;font-weight:900;color:var(--red)">~${weekCal}</div>
              <div style="font-size:8px;color:var(--t3);margin-top:2px;font-weight:900;text-transform:uppercase; letter-spacing:1px;">Weekly Kcal</div>
            </div>
          </div>
        </div>

        <!-- Weekly Schedule Strip -->
        <div style="font-size:11px;font-weight:900;letter-spacing:.5px;color:var(--t3);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <span style="background:var(--gold-d);padding:4px;border-radius:6px">📅</span> Weekly Schedule
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:24px">
          ${dayOrder
            .map((di) => {
              const dname = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                di
              ];
              const dtype = {
                1: "back",
                2: "chest",
                3: "legs",
                4: "back",
                5: "chest",
                6: "legs",
                0: "rest",
              }[di];
              const wc = WCOL[dtype] || "var(--t3)";
              const isToday = di === todayIdx;
              const icons = { back: "💪", chest: "🎯", legs: "🦵", rest: "😴" };
              return `<div style="text-align:center;padding:12px 4px;background:${isToday ? "rgba(212,168,71,0.08)" : "var(--bg2)"};border:1px solid ${isToday ? "var(--gold)" : "var(--bd)"};border-radius:14px; transition:all 0.3s ease; ${isToday ? "box-shadow:0 8px 20px rgba(198,146,10,0.15)" : ""}">
              <div style="font-size:18px;margin-bottom:4px; filter:${isToday ? "none" : "grayscale(1) opacity(0.6)"}">${icons[dtype]}</div>
              <div style="font-size:10px;font-weight:900;color:${isToday ? "var(--gold)" : "var(--t2)"}">${dname}</div>
              <div style="font-size:9px;color:var(--t3);margin-top:2px;font-weight:800;text-transform:uppercase;letter-spacing:0.3px">${dtype === "rest" ? "Rest" : dtype}</div>
              ${isToday ? `<div style="width:5px;height:5px;background:var(--gold);border-radius:50%;margin:6px auto 0; box-shadow:0 0 8px var(--gold)"></div>` : ""}
            </div>`;
            })
            .join("")}
        </div>

        <!-- Each workout type card -->
        ${types
          .map((type) => {
            const wd =
              type === "rest"
                ? {
                    name: "Active Recovery",
                    days: "Sunday",
                    cal: 200,
                    sections: REST_EX.sections,
                  }
                : WORKOUTS[type];
            const wc = WCOL[type] || "var(--t3)";
            const allEx = getAllEx(type);
            const totalSets = allEx.reduce((a, e) => a + (e.s || 1), 0);
            const counts = {},
              setCounts = {};
            allEx.forEach((ex) => {
              const t = ex.t || "other";
              counts[t] = (counts[t] || 0) + 1;
              setCounts[t] = (setCounts[t] || 0) + (ex.s || 1);
            });

            const muscleChips = Object.entries(counts)
              .map(([t, cnt]) => {
                const tc = WCOL[t] || "var(--t2)";
                return `<div class="g-chip" style="color:${tc}; border-color:${tc}33"><span>${cnt}</span><span style="opacity:0.7">${t}</span></div>`;
              })
              .join("");

            const exRows = wd.sections
              .map((sec) => {
                const exList = sec.exercises
                  .map((ex, i) => {
                    const imgSrc = ex.img
                      ? `<div style="width:44px; height:44px; min-width:44px; border-radius:10px; overflow:hidden; background:var(--bg3); border:1px solid var(--bd); flex-shrink:0;"><img src="${ex.img}" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:9px;"></div>`
                      : "";
                    return `<div style="padding:10px 14px; display:flex; align-items:flex-start; gap:10px; border-top:1px solid var(--bd); box-sizing:border-box; max-width:100%;">
                <div style="font-size:9px; font-weight:900; color:var(--gold); min-width:18px; padding-top:2px; text-align:center;">${i + 1}</div>
                ${imgSrc}
                <div style="flex:1; min-width:0;">
                  <div style="font-size:13px; font-weight:800; color:var(--t); line-height:1.3; word-break:break-word;">${ex.n}</div>
                  <div style="font-size:11px; color:var(--t3); line-height:1.4; margin-top:3px; word-break:break-word;">${ex.d}</div>
                  <div style="display:inline-block; font-size:9px; font-weight:700; padding:2px 8px; border-radius:8px; background:rgba(198,146,10,.07); color:var(--gold); margin-top:4px;">${ex.t}</div>
                </div>
              </div>`;
                  })
                  .join("");
                return `<div style="margin-bottom:8px">
              <div style="font-size:10px; font-weight:900; letter-spacing:1px; color:var(--t2); text-transform:uppercase; padding:10px 14px; background:rgba(0,0,0,0.02)">${sec.name}</div>
              ${exList}
            </div>`;
              })
              .join("");

            return `<div class="p-card mc" id="allc_${type}" style="padding:0; margin-bottom:14px; cursor:pointer; overflow:hidden;">
            <div class="mch" onclick="window.togAllCard('${type}')" style="padding:14px 16px; display:flex; align-items:center; gap:12px; cursor:pointer; -webkit-user-select:none; user-select:none;">
              <div style="background:${wc}18; color:${wc}; width:48px; height:48px; min-width:48px; border-radius:13px; font-size:24px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${type === "back" ? "💪" : type === "chest" ? "🎯" : type === "rest" ? "😴" : "🦵"}</div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:900; font-size:15px; color:${wc}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.3;">${wd.name}</div>
                <div style="font-size:11px; color:var(--t3); font-weight:600; margin-top:2px;">${wd.days} · ${allEx.length} Exercises · ${totalSets} Sets</div>
              </div>
              <div style="font-family:var(--mono); font-weight:900; font-size:11px; color:white; background:${wc}; padding:4px 10px; border-radius:14px; white-space:nowrap; flex-shrink:0;">~${wd.cal} kcal</div>
            </div>
            <div style="padding:0 16px 12px; display:flex; gap:6px; flex-wrap:wrap;">
              <div class="g-chip"><span style="color:${wc}">🏋️</span><span>${allEx.length} Exercises</span></div>
              <div class="g-chip"><span style="color:var(--amber)">⚡</span><span>${totalSets} Sets</span></div>
              ${muscleChips}
            </div>
            <div class="mcb" style="border-top:1px solid var(--bd); display:none; max-height:70vh; overflow-y:auto; -webkit-overflow-scrolling:touch;">${exRows}</div>
          </div>`;
          })
          .join("")}
      </div>`;

  document.getElementById("allworkoutscontent").innerHTML = html;
}
const LS_KEY = "fitos_v2";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getChallengeInfo() {
  const store = loadStore();
  const started = store.challengeStarted || false;
  const startDate = store.challengeStartDate || todayStr();
  const start = new Date(startDate);
  const today = new Date(todayStr());
  const diff = started ? Math.floor((today - start) / 86400000) + 1 : 0;
  const day = started ? Math.min(Math.max(1, diff), CHALLENGE_DAYS) : 0;
  return {
    started,
    startDate,
    day,
    remaining: started ? Math.max(0, CHALLENGE_DAYS - day) : CHALLENGE_DAYS,
  };
}

function getWeeklyMenu(slot) {
  const todayIndex = new Date().getDay();
  return WEEKLY_MENU[todayIndex]?.[slot] || null;
}

function startChallenge() {
  const store = loadStore();
  store.challengeStarted = true;
  store.challengeStartDate = todayStr();
  saveStore(store);
  renderDiet();
  buildProgressTab();
  if (window.showToast) window.showToast("90-Day challenge started!", "🔥");
}

function resetChallenge() {
  if (!confirm("Reset the 90-Day challenge and clear the start date?")) return;
  const store = loadStore();
  store.challengeStarted = false;
  store.challengeStartDate = null;
  saveStore(store);
  renderDiet();
  buildProgressTab();
  if (window.showToast) window.showToast("Challenge reset. Ready to begin again!", "🔄");
}

function loadStore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store.challengeStarted === undefined) {
        store.challengeStarted = !!store.challengeStartDate;
      }
      if (store.challengeStartDate === undefined) {
        store.challengeStartDate = null;
      }
      if (!store.dailyLog) store.dailyLog = {};
      if (!store.weightLog) store.weightLog = [];
      saveStore(store);
      return store;
    }
  } catch (e) {}
  return { weightLog: [], dailyLog: {}, challengeStarted: false, challengeStartDate: null };
}

function saveStore(store) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch (e) {}
}

function getToday(store) {
  const t = todayStr();
  if (!store.dailyLog[t]) {
    store.dailyLog[t] = {
      meals: [],
      water: 0,
      isab: [false, false],
      exercises: {},
    };
  }
  return store.dailyLog[t];
}

// ============================================================
// DAILY RESET — auto resets meals/exercises each new day
// ============================================================
function checkDailyReset() {
  const store = loadStore();
  const today = todayStr();
  // If no record for today, it auto-creates fresh. EX and S are in-memory only.
  // Load today's saved state into S and EX
  const td = getToday(store);
  // Restore water
  S.water = td.water || 0;
  // Restore isab
  S.isab = td.isab || [false, false];
  // Restore meals done
  S.done = new Set(td.meals || []);
  S.skipped = new Set(td.skipped || []);
  S.cal = 0;
  S.p = 0;
  S.c = 0;
  S.f = 0;
  S.fib = 0;
  S.done.forEach((id) => {
    const item = DIET.find((x) => x.id === id);
    if (item && item.type === "meal") {
      S.cal += item.cal;
      S.p += item.p;
      S.c += item.c;
      S.f += item.f;
      S.fib += item.fib || 0;
    }
  });
  // Restore exercises
  const savedEx = td.exercises || {};
  Object.assign(EX, savedEx);
  saveStore(store);
}

// ============================================================
// SAVE HELPERS — called whenever user checks something
// ============================================================
function persistDaily() {
  const store = loadStore();
  const td = getToday(store);
  td.meals = [...S.done];
  td.skipped = [...S.skipped];
  td.water = S.water;
  td.isab = S.isab;
  td.exercises = JSON.parse(JSON.stringify(EX));
  saveStore(store);
}

// ============================================================
// WEIGHT LOGGING
// ============================================================
function saveWeight() {
  const inp = document.getElementById("wtInput");
  const val = parseFloat(inp.value);
  if (isNaN(val) || val < 30 || val > 300) {
    inp.classList.add("input-error");
    setTimeout(() => inp.classList.remove("input-error"), 1000);
    return;
  }
  const store = loadStore();
  const today = todayStr();
  // Remove existing entry for today if any
  store.weightLog = store.weightLog.filter((e) => e.date !== today);
  store.weightLog.push({ date: today, weight: val });
  store.weightLog.sort((a, b) => a.date.localeCompare(b.date));
  saveStore(store);
  inp.value = "";
  inp.classList.add("input-success");
  setTimeout(() => inp.classList.remove("input-success"), 800);
  updWeightUI();
  if (document.getElementById("tc-progress").classList.contains("on"))
    buildProgressTab();
}

function updWeightUI() {
  const store = loadStore();
  const log = store.weightLog;
  if (!log.length) return;
  const latest = log[log.length - 1];
  const start = 120; // starting weight
  const target = 75;
  document.getElementById("wtCurVal").textContent = latest.weight + " kg";
  const lost = +(start - latest.weight).toFixed(1);
  document.getElementById("wtLostLbl").textContent =
    lost > 0 ? `▼ ${lost} kg lost 🔥` : "";
  const rem = +(latest.weight - target).toFixed(1);
  document.getElementById("wtRemain").textContent =
    rem > 0 ? `${rem} kg to go` : "🎯 Goal Reached!";
}

// ============================================================
// PROGRESS TAB — full render
// ============================================================
function buildProgressTab() {
  const store = loadStore();
  const log = store.weightLog;
  const dlog = store.dailyLog;
  const today = todayStr();
  const challenge = getChallengeInfo();
  const start = CHALLENGE_WEIGHT_START,
    target = CHALLENGE_WEIGHT_TARGET;

  // Stats
  const latest = log.length ? log[log.length - 1].weight : start;
  const lost = +(start - latest).toFixed(1);
  const pct = Math.min(+((lost / (start - target)) * 100).toFixed(1), 100);

  // Streak calc
  let streak = 0;
  const sorted = Object.keys(dlog).sort().reverse();
  for (const d of sorted) {
    const dl = dlog[d];
    const hasMeal = (dl.meals || []).length >= 2;
    const hasWater = (dl.water || 0) >= 8;
    if (hasMeal || hasWater) streak++;
    else break;
  }

  // Total workouts
  const totalWo = Object.values(dlog).filter((d) => {
    const ex = d.exercises || {};
    return Object.values(ex).some((wt) =>
      Object.values(wt).some((e) => e.completed),
    );
  }).length;

  const endDate = new Date(challenge.startDate);
  endDate.setDate(endDate.getDate() + CHALLENGE_DAYS - 1);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const endLabel = `${String(endDate.getDate()).padStart(2, "0")}-${monthNames[endDate.getMonth()]}-${endDate.getFullYear()}`;
  const weeklyTarget = ((start - target) / CHALLENGE_DAYS * 7).toFixed(1);
  const challengePct = Math.min(100, Math.round((challenge.day / CHALLENGE_DAYS) * 100));

  // Weight chart (last 10 entries)
  const chartLog = log.slice(-10);
  let chartHTML = "";
  if (chartLog.length >= 2) {
    const minW = Math.min(...chartLog.map((e) => e.weight)) - 1;
    const maxW = Math.max(...chartLog.map((e) => e.weight)) + 1;
    chartHTML = `<div class="wt-chart">
          <div class="wt-chart-title">⚖️ Weight Trend — Last ${chartLog.length} Logs</div>
          <div class="wt-bars">
            ${chartLog
              .map((e) => {
                const h = Math.max(
                  4,
                  Math.round(((maxW - e.weight) / (maxW - minW)) * 70 + 10),
                );
                const shortDate = e.date.slice(5).replace("-", "/");
                return `<div class="wt-bar-col">
                <div class="wt-bar-val">${e.weight}</div>
                <div class="wt-bar" style="height:${h}px"></div>
                <div class="wt-bar-lbl">${shortDate}</div>
              </div>`;
              })
              .join("")}
          </div>
        </div>`;
  } else {
    chartHTML = `<div class="wt-chart" style="text-align:center;color:var(--t3);font-size:12px;padding:24px">
          Log weight on 2+ days to see your trend chart 📊
        </div>`;
  }

  // Weight log list
  const logRows = log
    .slice()
    .reverse()
    .slice(0, 20)
    .map((e, i, arr) => {
      const prev = arr[i + 1];
      let delta = "";
      if (prev) {
        const diff = +(e.weight - prev.weight).toFixed(1);
        delta =
          diff < 0
            ? `<span class="wlog-delta" style="color:var(--green)">▼ ${Math.abs(diff)}</span>`
            : diff > 0
              ? `<span class="wlog-delta" style="color:var(--red)">▲ ${diff}</span>`
              : `<span class="wlog-delta" style="color:var(--t3)">—</span>`;
      }
      return `<div class="wlog-row">
          <span class="wlog-date">${e.date}</span>
          <span class="wlog-kg">${e.weight} kg</span>
          ${delta}
          <button class="wlog-del" onclick="deleteWeightEntry('${e.date}')" title="Delete">✕</button>
        </div>`;
    })
    .join("");

  // Daily log summary (last 7 days)
  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    last7.push(ds);
  }
  const dailyRows = last7
    .map((ds) => {
      const dl = dlog[ds] || {};
      const meals = (dl.meals || []).length;
      const water = dl.water || 0;
      const ex = dl.exercises || {};
      const exDone = Object.values(ex).reduce(
        (a, wt) => a + Object.values(wt).filter((e) => e.completed).length,
        0,
      );
      const shortDate = ds.slice(5).replace("-", "/");
      const isToday = ds === today;
      return `<div class="dlog-row">
          <span class="dlog-date">${shortDate}${isToday ? ' <b style="color:var(--gold)">Today</b>' : ""}</span>
          <div class="dlog-chips">
            <span class="dlog-chip" style="background:${meals >= 2 ? "rgba(16,185,129,.15)" : "var(--bg)"};color:${meals >= 2 ? "var(--green)" : "var(--t3)"}">${meals >= 2 ? "✓" : meals} Meals</span>
            <span class="dlog-chip" style="background:${water >= 8 ? "rgba(75,131,232,.15)" : "var(--bg)"};color:${water >= 8 ? "var(--blue)" : "var(--t3)"}">${water >= 8 ? "💧 " + water : "💧 " + water}</span>
            ${exDone > 0 ? `<span class="dlog-chip" style="background:rgba(212,168,71,.15);color:var(--gold)">💪 ${exDone} Ex</span>` : ""}
          </div>
        </div>`;
    })
    .join("");

  document.getElementById("progressContent").innerHTML = `
        <div class="p-card pulse-glow" style="margin-bottom:24px; background:linear-gradient(135deg, var(--gold-b), transparent); border:1px solid var(--gold); padding:24px; border-radius:24px;">
          <div style="font-size:var(--fs-2xs); font-weight:900; color:var(--gold); text-transform:uppercase; letter-spacing:1px; margin-bottom:var(--space-xs);">AI Prediction Engine 🧠</div>
          <div style="font-family:'Raleway',sans-serif; font-size:var(--fs-lg); font-weight:900; color:var(--t); letter-spacing:-0.5px; line-height:1.2;">
            At this rate, you could lose <span style="color:var(--green)">${(totalWo * 0.15).toFixed(1)}kg</span> by next Sunday.
          </div>
          <div style="font-size:var(--fs-3xs); color:var(--t3); margin-top:var(--space-xs); font-weight:600;">Based on your consistency: ${streak} day streak & ${totalWo} sessions.</div>
        </div>

        <div class="wt-chart" style="padding:18px;margin-bottom:18px;background:linear-gradient(135deg,rgba(5,150,105,.08),rgba(37,99,235,.05));border:1px solid rgba(5,150,105,.12);">
          <div class="wt-chart-title">📅 90-Day Challenge Overview</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px;">
            <div style="padding:14px;border-radius:18px;background:rgba(255,255,255,.85);">
              <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:var(--t3);letter-spacing:.08em;">Challenge Window</div>
              <div style="font-size:13px;font-weight:800;color:var(--t);margin-top:8px;">${challenge.startDate} → ${endLabel}</div>
            </div>
            <div style="padding:14px;border-radius:18px;background:rgba(255,255,255,.85);">
              <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:var(--t3);letter-spacing:.08em;">Target Loss</div>
              <div style="font-size:13px;font-weight:800;color:var(--t);margin-top:8px;">${start - target} kg in ${CHALLENGE_DAYS} days</div>
            </div>
            <div style="padding:14px;border-radius:18px;background:rgba(255,255,255,.85);">
              <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:var(--t3);letter-spacing:.08em;">Days Completed</div>
              <div style="font-size:13px;font-weight:800;color:var(--t);margin-top:8px;">${challenge.day}</div>
            </div>
            <div style="padding:14px;border-radius:18px;background:rgba(255,255,255,.85);">
              <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:var(--t3);letter-spacing:.08em;">Weekly Pace</div>
              <div style="font-size:13px;font-weight:800;color:var(--t);margin-top:8px;">${weeklyTarget} kg/week</div>
            </div>
          </div>
          <div style="margin-top:12px;height:10px;background:var(--bg4);border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${challengePct}%;background:linear-gradient(90deg,var(--green),var(--blue));border-radius:999px;"></div>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--t3);">Challenge progress: ${challengePct}% complete · ${challenge.remaining} days remaining</div>
        </div>

        <div class="prog-grid">
          <div class="prog-stat">
            <div class="prog-stat-l">Lost So Far</div>
            <div class="prog-stat-v" style="color:var(--green)">${lost > 0 ? lost : 0}<span style="font-size:13px;color:var(--t3)"> kg</span></div>
            <div class="prog-stat-s">${pct}% to goal</div>
          </div>
          <div class="prog-stat">
            <div class="prog-stat-l">Current Weight</div>
            <div class="prog-stat-v" style="color:var(--gold)">${latest}<span style="font-size:13px;color:var(--t3)"> kg</span></div>
            <div class="prog-stat-s">${+(latest - target).toFixed(1)} kg to go</div>
          </div>
          <div class="prog-stat">
            <div class="prog-stat-l">Challenge Day</div>
            <div class="prog-stat-v" style="color:var(--gold)">${challenge.day}/${CHALLENGE_DAYS}</div>
            <div class="prog-stat-s">${challenge.remaining} days left</div>
          </div>
          <div class="prog-stat">
            <div class="prog-stat-l">Active Streak</div>
            <div class="prog-stat-v" style="color:var(--amber)">${streak}<span style="font-size:13px;color:var(--t3)"> days</span></div>
            <div class="prog-stat-s">${streak >= 7 ? "🔥 On fire!" : streak >= 3 ? "⚡ Keep going" : "🌱 Build it"}</div>
          </div>
          <div class="prog-stat">
            <div class="prog-stat-l">Workouts Done</div>
            <div class="prog-stat-v" style="color:var(--blue)">${totalWo}</div>
            <div class="prog-stat-s">Total sessions</div>
          </div>
        </div>

        <!-- Overall Progress Bar -->
        <div class="wt-chart" style="padding:14px 16px;margin-bottom:14px">
          <div class="wt-chart-title">🎯 90-Day Challenge Progress — ${start}kg → ${target}kg</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
            <div style="flex:1;height:10px;background:var(--bd);border-radius:5px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--gold),var(--green));border-radius:5px;transition:width 1s cubic-bezier(.34,1.56,.64,1)"></div>
            </div>
            <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--gold);flex-shrink:0">${pct}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-top:4px">
            <span>Start: ${start} kg</span><span>Goal: ${target} kg</span>
          </div>
        </div>

        ${chartHTML}

        <div class="sh" style="margin-bottom:10px">📅 Last 7 Days — Daily Log</div>
        ${dailyRows || '<div style="color:var(--t3);font-size:12px;text-align:center;padding:16px">Start checking off meals & water to see your log!</div>'}

        ${
          log.length
            ? `
          <div class="sh" style="margin:14px 0 8px">⚖️ All Weight Entries</div>
          <div class="wlog-list">${logRows}</div>
        `
            : ""
        }
      `;
}

function deleteWeightEntry(date) {
  const store = loadStore();
  store.weightLog = store.weightLog.filter((e) => e.date !== date);
  saveStore(store);
  updWeightUI();
  buildProgressTab();
}

// ============================================================
// PATCHED FUNCTIONS — now also call persistDaily()
// ============================================================
let curMobTab = "diet";
function skipMeal(e, id) {
  e.stopPropagation();
  const s = DIET.find((x) => x.id === id);
  if (!s || s.type !== "meal") return;
  const btnD = $("chk_" + id), btnS = $("skp_" + id), card = document.querySelector(`[data-id="${id}"]`);
  if (S.done.has(id)) {
    S.done.delete(id);
    S.cal -= s.cal; S.p -= s.p; S.c -= s.c; S.f -= s.f; S.fib -= s.fib || 0;
    updMacros();
  }
  if (S.skipped.has(id)) {
    S.skipped.delete(id);
    if (btnS) { btnS.innerHTML = "✕"; btnS.classList.remove("btn-skip-skipped"); }
    if (card) { card.classList.remove("skipped"); }
    if (btnD) { btnD.style.display = ""; btnD.innerHTML = "✓"; btnD.classList.remove("btn-done-completed"); }
  } else {
    S.skipped.add(id);
    if (btnS) { btnS.innerHTML = "✕"; btnS.classList.add("btn-skip-skipped"); }
    if (card) { card.classList.add("skipped"); card.classList.remove("anow"); }
    if (btnD) { btnD.style.display = "none"; }
    if (window.showToast) window.showToast("Meal Skipped", "⏭️");
  }
  persistDaily();
}

function togMeal(e, id) {
  e.stopPropagation();
  const s = DIET.find((x) => x.id === id);
  if (!s || s.type !== "meal") return;
  const btn = $("chk_" + id), btnS = $("skp_" + id), card = document.querySelector(`[data-id="${id}"]`);
  if (S.skipped.has(id)) return;
  if (S.done.has(id)) {
    S.done.delete(id);
    if (btn) { btn.classList.remove("btn-done-completed"); btn.innerHTML = "✓"; }
    if (btnS) { btnS.style.display = ""; }
    if (card) {
      card.classList.remove("ck", "anow");
    }
    S.cal -= s.cal;
    S.p -= s.p;
    S.c -= s.c;
    S.f -= s.f;
    S.fib -= s.fib || 0;
  } else {
    S.done.add(id);
    if (btn) { btn.classList.add("btn-done-completed"); btn.innerHTML = "✓"; }
    if (btnS) { btnS.style.display = "none"; }
    if (card) {
      card.classList.add("ck");
      card.classList.remove("anow");
    }
    S.cal += s.cal;
    S.p += s.p;
    S.c += s.c;
    S.f += s.f;
    S.fib += s.fib || 0;
    if (window.showToast) window.showToast("Meal Logged successfully!", "🍱");
  }
  updMacros();
  persistDaily();
}

window.togAllCard = function (id) {
  const card = document.getElementById("allc_" + id);
  if (!card) return;
  const isOpen = card.classList.toggle("open");
  const body = card.querySelector(".mcb");
  if (body) {
    if (isOpen) {
      body.style.display = "block";
      body.style.animation = "fadeIn 0.3s ease";
    } else {
      body.style.display = "none";
    }
  }
};

function getGap(d) {
  const m = d.match(/Gap:\s*(\d+)/i);
  return m ? parseInt(m[1]) : 60;
}

function togIsab(i) {
  S.isab[i] = !S.isab[i];
  const b = $("isab" + i);
  b.classList.toggle("done", S.isab[i]);
  b.querySelector(".ib-l").textContent = S.isab[i] ? "✓ Done" : `Dose ${i + 1}`;
  persistDaily();
}

// Patched water builder — persists on click
// Patched water builder — premium "Wave" UI with Hydration Status
function buildWater() {
  const g = $("wgrid");
  if (!g) return;
  const w = S.water || 0;
  
  // Hydration status logic
  let status = "Keep going! 💧";
  let color = "var(--t3)";
  if (w >= 16) { status = "Perfectly Hydrated! 🏆"; color = "var(--green)"; }
  else if (w >= 12) { status = "Almost there! ⚡"; color = "var(--blue)"; }
  else if (w >= 8) { status = "Good progress! 👍"; color = "var(--amber)"; }
  else if (w > 0) { status = "Nicely started! 🌱"; color = "var(--gold)"; }

  g.innerHTML = `
    <div class="wt-container">
      <div class="wt-header">
        <div class="wt-info">
          <div class="wt-count">${w} <span class="wt-unit">Glasses</span></div>
          <div class="wt-target">Target: 16 (4.0L)</div>
        </div>
        <div class="wt-icon">💧</div>
      </div>

      <div class="wt-grid">
        ${Array.from({ length: 16 })
          .map(
            (_, i) => `
          <button class="wt-glass ${i < w ? "filled" : ""}" onclick="addWater(${i < w ? -1 : 1})" data-index="${i}">
            <div class="wt-glass-icon">${i < w ? "🌊" : "🧊"}</div>
            <div class="wt-glass-fill"></div>
          </button>
        `,
          )
          .join("")}
      </div>

      <div class="wt-status" style="text-align:center; margin-bottom:12px; font-weight:800; font-size:14px; color:${color}; animation: float-sm 3s ease-in-out infinite;">${status}</div>

      <div class="wt-progress">
        <div class="wt-progress-bar">
          <div class="wt-progress-fill" style="width: ${(w / 16) * 100}%"></div>
        </div>
        <div class="wt-progress-text">${Math.round((w / 16) * 100)}% Complete · ${w * 250}ml logged</div>
      </div>
    </div>`;
}

window.addWater = function (val) {
  S.water = Math.max(0, (S.water || 0) + val);
  persistDaily();
  buildWater();
  if (val > 0) {
    if (window.haptic) window.haptic([40]);
    if (window.showToast) window.showToast("+250ml Water logged!", "💧");
  }
};

// Patched set tracking — persists
function togSet(type, ei, si) {
  if (!EX[type]) EX[type] = {};
  if (!EX[type][ei]) EX[type][ei] = { done: 0, completed: false };
  const exList = getAllEx(type);
  EX[type][ei].done = EX[type][ei].done === si + 1 ? si : si + 1;
  const ad = EX[type][ei].done;
  const row = document.getElementById(`sr_${type}_${ei}`);
  if (row)
    row
      .querySelectorAll(".set-dot-new")
      .forEach((d, j) => d.classList.toggle("dn", j < ad));
  EX[type][ei].completed = ad >= exList[ei].s;
  const card = document.getElementById(`exc_${type}_${ei}`);
  if (card) card.classList.toggle("done-ex", EX[type][ei].completed);
  updWoProg(type);
  if (ad > 0) window.haptic([50]);
  if (ad > 0 && ad < exList[ei].s) {
    startRestTimer(getGap(exList[ei].d));
  }
  if (EX[type][ei].completed) {
    window.haptic([100, 50, 100]);
    if (window.showToast) window.showToast("Exercise Complete! 🔥", "💪");
    scrollToNextEx(type, ei);
  }
}

function togSingle(type, ei) {
  if (!EX[type]) EX[type] = {};
  if (!EX[type][ei]) EX[type][ei] = { done: 0, completed: false };
  EX[type][ei].completed = !EX[type][ei].completed;
  EX[type][ei].done = EX[type][ei].completed ? 1 : 0;
  const b = document.getElementById(`ek_${type}_${ei}`);
  if (b) b.classList.toggle("dn", EX[type][ei].completed);
  const card = document.getElementById(`exc_${type}_${ei}`);
  if (card) card.classList.toggle("done-ex", EX[type][ei].completed);
  updWoProg(type);
  persistDaily();
  if (EX[type][ei].completed) {
    if (window.showToast) window.showToast("Nailed it! ⚡", "🔥");
    const exList = getAllEx(type);
    startRestTimer(getGap(exList[ei].d));
    scrollToNextEx(type, ei);
  }
}

// ============================================================
// TAB SWITCHING — updated to handle progress tab
// ============================================================
function showTab(id, btn) {
  document.querySelectorAll(".tc").forEach((t) => t.classList.remove("on"));
  document
    .querySelectorAll("#desktopTabbar .tab")
    .forEach((b) => b.classList.remove("on"));
  const tc = document.getElementById("tc-" + id);
  if (tc) tc.classList.add("on");
  if (btn) btn.classList.add("on");
  else {
    document.querySelectorAll("#desktopTabbar .tab").forEach((b) => {
      if (
        b.getAttribute("onclick") &&
        b.getAttribute("onclick").includes("'" + id + "'")
      )
        b.classList.add("on");
    });
  }
  $("sidebarPanel").classList.remove("mob-visible");
  if (id === "workout") {
    const wt = todayWT();
    $("wocontent").innerHTML =
      wt === "rest" ? buildWorkoutHTML("rest") : buildWorkoutHTML(wt);
  }
  if (id === "rest") $("restcontent").innerHTML = buildWorkoutHTML("rest");
  if (id === "allworkouts") buildAllWorkouts();
  if (id === "progress") buildProgressTab();
}

function mobTab(id, btn) {
  document.querySelectorAll(".bntab").forEach((b) => b.classList.remove("on"));
  if (btn) btn.classList.add("on");
  curMobTab = id;

  const panel = $("sidebarPanel");
  const mainArea = $("mainArea");

  if (id === "stats") {
    panel.classList.add("mob-visible");
    mainArea.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  panel.classList.remove("mob-visible");
  mainArea.style.display = "";

  document.querySelectorAll(".tc").forEach((t) => t.classList.remove("on"));
  document
    .querySelectorAll("#desktopTabbar .tab")
    .forEach((b) => b.classList.remove("on"));
  const tc = document.getElementById("tc-" + id);
  if (tc) tc.classList.add("on");
  document.querySelectorAll("#desktopTabbar .tab").forEach((b) => {
    if (
      b.getAttribute("onclick") &&
      b.getAttribute("onclick").includes("'" + id + "'")
    )
      b.classList.add("on");
  });
  if (id === "workout") {
    const wt = todayWT();
    $("wocontent").innerHTML =
      wt === "rest" ? buildWorkoutHTML("rest") : buildWorkoutHTML(wt);
  }
  if (id === "rest") $("restcontent").innerHTML = buildWorkoutHTML("rest");
  if (id === "allworkouts") buildAllWorkouts();
  if (id === "progress") buildProgressTab();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// PREMIUM UI/UX UPGRADES (Injected Natively)
// ============================================================
const pStyle = document.createElement("style");
pStyle.innerHTML = `
      .topbar {
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        background: rgba(253, 250, 244, 0.95) !important;
        z-index: 99998 !important;
      }
      .botnav {
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        background: rgba(253, 250, 244, 0.98) !important;
        z-index: 99999 !important;
        pointer-events: all !important;
      }
      .excard { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important; }
      .excard.done-ex {
        opacity: 0.55 !important; transform: scale(0.975) !important;
        box-shadow: inset 0 4px 15px rgba(0,0,0,0.04) !important;
        background: transparent !important; border-color: transparent !important;
      }
      #toast-box {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; gap: 8px; z-index: 99990; pointer-events: none;
      }
      .ftoast {
        background: rgba(10, 22, 40, 0.95); color: #FFF;
        padding: 12px 24px; border-radius: 30px;
        font-size: 14px; font-weight: 700; font-family: 'Manrope', sans-serif;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.1);
        display: flex; align-items: center; gap: 10px;
        animation: toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes toastIn {
        0% { opacity: 0; transform: translateY(20px) scale(0.9); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      .ftoast.out { animation: toastOut 0.3s ease-in forwards; }
      @keyframes toastOut {
        100% { opacity: 0; transform: translateY(-10px) scale(0.95); }
      }
    `;
document.head.appendChild(pStyle);

const txb = document.createElement("div");
txb.id = "toast-box";
document.body.appendChild(txb);

window.showToast = function (msg, icon = "✨") {
  const t = document.createElement("div");
  t.className = "ftoast";
  t.innerHTML = `<span style="font-size:16px">${icon}</span> <span>${msg}</span>`;
  document.getElementById("toast-box").appendChild(t);
  setTimeout(() => {
    t.classList.add("out");
    setTimeout(() => t.remove(), 300);
  }, 2500);
};

window.fireConfetti = function () {
  const colors = [
    "#C6920A",
    "#15803D",
    "#1D4ED8",
    "#B91C1C",
    "#D4A847",
    "#0F766E",
  ];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement("div");
    c.style.cssText = `position:fixed; width:9px; height:${Math.random() > 0.5 ? 9 : 14}px; 
          background:${colors[Math.floor(Math.random() * colors.length)]};
          left:${Math.random() * 100}vw; top:-15px; z-index:9999;
          border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
          pointer-events:none; opacity:${0.6 + Math.random() * 0.4};`;
    document.body.appendChild(c);
    const ang = Math.random() * Math.PI * 2;
    const vel = 2 + Math.random() * 4;
    let x = 0,
      y = 0,
      rot = 0;
    const anim = setInterval(() => {
      x += Math.cos(ang) * vel + (Math.random() - 0.5);
      y += Math.sin(ang) * vel + 4;
      rot += 5 + Math.random() * 10;
      c.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
      if (y > window.innerHeight) {
        clearInterval(anim);
        c.remove();
      }
    }, 16);
  }
};

// REST TIMER CORE
let restInterval;
window.startRestTimer = function (sec) {
  if (sec <= 0) return;
  clearInterval(restInterval);
  const overlay = document.getElementById("restTimerOverlay");
  const valEl = document.getElementById("timerVal");
  const ring = document.getElementById("timerRing");
  if (!overlay) return;

  overlay.style.display = "flex";
  let left = sec;
  valEl.textContent = left;
  ring.style.strokeDashoffset = 0;

  restInterval = setInterval(() => {
    left--;
    valEl.textContent = left;
    const offset = 502.6 - (left / sec) * 502.6;
    ring.style.strokeDashoffset = offset;

    if (left <= 0) {
      clearInterval(restInterval);
      overlay.style.display = "none";
      if (window.showToast)
        window.showToast("Break Over! Back to work! 💪", "⚡");
    }
  }, 1000);
};

window.skipRest = function () {
  clearInterval(restInterval);
  document.getElementById("restTimerOverlay").style.display = "none";
};

// DATA GUARD (Backup/Restore)
window.exportData = function () {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    data[k] = localStorage.getItem(k);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fitos_backup_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  if (window.showToast) window.showToast("Backup saved to downloads!", "💾");
};

window.importData = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ex) {
    try {
      const data = JSON.parse(ex.target.result);
      localStorage.clear();
      for (const k in data) localStorage.setItem(k, data[k]);
      alert("Restore Successful! Page will reload.");
      window.location.reload();
    } catch (err) {
      alert("Invalid backup file!");
    }
  };
  reader.readAsText(file);
};

// ============================================================
// INIT
// ============================================================
checkDailyReset(); // load today's saved state first
buildWeek();

// Parse URL for PWA shortcuts
const params = new URLSearchParams(window.location.search);
const initTab = params.get("tab");
if (initTab === "workout") {
  setTimeout(
    () => mobTab("workout", document.getElementById("bn-workout")),
    100,
  );
} else if (initTab === "progress") {
  setTimeout(
    () => mobTab("progress", document.getElementById("bn-progress")),
    100,
  );
}
buildWater();
renderDiet();
// Re-render done states on meal cards after diet rendered
setTimeout(() => {
  S.done.forEach((id) => {
    const btn = $("chk_" + id);
    const btnS = $("skp_" + id);
    const card = document.querySelector(`[data-id="${id}"]`);
    if (btn) { btn.classList.add("done"); btn.innerHTML = "✓ Completed"; btn.style.background = "var(--green)"; btn.style.boxShadow = "none"; }
    if (btnS) { btnS.style.display = "none"; }
    if (card) card.classList.add("ck");
  });
  S.skipped.forEach((id) => {
    const btnD = $("chk_" + id);
    const btnS = $("skp_" + id);
    const card = document.querySelector(`[data-id="${id}"]`);
    if (btnS) { btnS.innerHTML = "✕ Skipped"; btnS.classList.add("btn-skip-skipped"); }
    if (card) { card.classList.add("skipped"); }
    if (btnD) { btnD.style.display = "none"; }
  });
  // Restore isabgol buttons
  [0, 1].forEach((i) => {
    if (S.isab[i]) {
      const b = $("isab" + i);
      if (b) {
        b.classList.add("done");
        b.querySelector(".ib-l").textContent = "✓ Done";
      }
    }
  });
}, 50);
updDay();
updWeightUI();
tick();
setInterval(tick, 1000);
hlSlot();
setInterval(hlSlot, 60000);
setTimeout(updMacros, 300);

// Initialize notifications and reminders
initializeNotifications();

// Auto-initialize reminders if permissions already granted
if (Notification.permission === "granted") {
  startAutomaticReminders();
}