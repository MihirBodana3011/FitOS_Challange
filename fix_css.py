import sys

file_path = r"c:\Users\Admin\Downloads\Weight_Loss_Plan-main\style.css"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# find the exact place
split_str = "  z-index: 9999;\n}"
parts = content.split(split_str)
if len(parts) == 2:
    new_tail = """

/* Rest Timer Overlay */
.rest-timer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(7, 15, 30, 0.85);
    backdrop-filter: blur(10px);
    z-index: 10000;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    text-align: center;
}

.rest-timer-ring {
    position: relative;
    width: clamp(140px, 30vw, 180px);
    height: clamp(140px, 30vw, 180px);
}

/* Large screens - prevent excessive sizing */
@media (min-width: 1440px) {
    .layout {
        max-width: 1400px;
        margin: 0 auto;
    }
    
    .rb-wrap {
        width: clamp(140px, 20vw, 180px);
        height: clamp(140px, 20vw, 180px);
    }
    
    .rest-timer-ring {
        width: clamp(160px, 25vw, 200px);
        height: clamp(160px, 25vw, 200px);
    }
}

/* Very small screens - ensure readability */
@media (max-width: 360px) {
    .layout {
        padding-bottom: calc(var(--botnav) + var(--safe-b) + var(--space-sm));
    }
    
    .tc {
        padding: var(--space-md) var(--space-xs) var(--space-lg);
    }
    
    .sh {
        font-size: var(--fs-sm);
        margin-bottom: var(--space-xs);
    }
    
    .bntab {
        padding: var(--space-xs) var(--space-xs);
    }
    
    .bnico {
        font-size: var(--fs-lg);
    }
    
    .bnlbl {
        font-size: var(--fs-3xs);
    }
}"""
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(parts[0] + split_str + new_tail)
    print("Fixed CSS!")
else:
    print("Could not find the split string!")
