import re
import sys

html_path = r"c:\Users\Admin\Downloads\Weight_Loss_Plan-main\index.html"
css_path = r"c:\Users\Admin\Downloads\Weight_Loss_Plan-main\style.css"

with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

# Replace inline styles with classes
replacements = [
    (r'id="aiGreeting"\s*style="[^"]*"', r'id="aiGreeting" class="ai-greeting"'),
    (r'class="xbadge"\s*style="[^"]*"\s*onclick="requestNotificationPermission\(\)"', r'class="xbadge btn-reminders" onclick="requestNotificationPermission()"'),
    (r'style="[^"]*RESTING...\s*</div>', r'class="rest-timer-title">RESTING...</div>'),
    (r'id="timerVal"\s*style="[^"]*"', r'id="timerVal" class="rest-timer-val"'),
    (r'onclick="skipRest\(\)"\s*style="[^"]*"', r'onclick="skipRest()" class="rest-timer-btn"'),
    (r'class="wt-current-lbl"\s*style="[^"]*"', r'class="wt-current-lbl"'), # The class already has inline styles attached in index, we will move them
]

for old, new in replacements:
    html = re.sub(old, new, html, flags=re.DOTALL)

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)

# Append to CSS
css_additions = """
/* EXTRACTED UI ELEMENTS */
.ai-greeting {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--gold);
  margin-left: var(--space-sm);
  opacity: 0.9;
  white-space: nowrap;
}

.btn-reminders {
  cursor: pointer;
  background: var(--gold);
  color: white;
  border: none;
  margin-left: var(--space-sm);
  transition: transform 0.2s ease;
}
.btn-reminders:active {
  transform: scale(0.95);
}

.rest-timer-title {
  font-size: var(--fs-md);
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--gold);
  margin-bottom: var(--space-xl);
  text-transform: uppercase;
}

.rest-timer-val {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: var(--fs-3xl);
  font-weight: 800;
}

.rest-timer-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: var(--space-xs) var(--space-xl);
  border-radius: var(--r-xl);
  font-weight: 700;
  font-size: var(--fs-md);
  cursor: pointer;
  transition: all 0.3s ease;
}

.rest-timer-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}
.rest-timer-btn:active {
  transform: translateY(0) scale(0.98);
}
"""

with open(css_path, "a", encoding="utf-8") as f:
    f.write(css_additions)

print("UI Extracted")
