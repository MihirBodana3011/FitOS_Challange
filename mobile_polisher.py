import sys

css_path = r"c:\Users\Admin\Downloads\Weight_Loss_Plan-main\style.css"

with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

# Replace tiny mobile font sizes
css = css.replace("font-size: 13.5px !important;", "font-size: 14.5px !important;")
css = css.replace("font-size: 10px !important;", "font-size: 11px !important;")
css = css.replace("font-size: 10.5px !important;", "font-size: 11.5px !important;")

# Target botnav for hardware acceleration and touch callouts
botnav_replace = """.botnav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(var(--botnav) + var(--safe-b));
    padding-bottom: var(--safe-b);
    background: var(--bg2);
    border-top: 1px solid var(--bd);
    z-index: 400;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255, 255, 255, 0.95);
    transition: box-shadow 0.3s ease;
    /* Native Mobile Polish */
    transform: translateZ(0); 
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }"""

# Since botnav exists inside a media query (or several), it's easier to just find the large desktop overriding one, 
# But let's just use string replace on the exact definition from line 2887
old_botnav = """.botnav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(var(--botnav) + var(--safe-b));
    padding-bottom: var(--safe-b);
    background: var(--bg2);
    border-top: 1px solid var(--bd);
    z-index: 400;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255, 255, 255, 0.95);
    transition: box-shadow 0.3s ease;
  }"""

css = css.replace(old_botnav, botnav_replace)

# Add overscroll-behavior to HTML
html_old = """html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  scroll-padding-top: 70px;
}"""
html_new = """html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  scroll-padding-top: 70px;
  overscroll-behavior-y: none; /* Prevents PWA pull-to-refresh blank screen */
  -webkit-overflow-scrolling: touch;
}"""
css = css.replace(html_old, html_new)

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css)

print("CSS updated with ultimate mobile optimizations.")
