with open('scripts/mockup_0.html', 'r', encoding='utf-8') as f:
    m0 = f.read()

with open('scripts/mockup_1.html', 'r', encoding='utf-8') as f:
    m1 = f.read()

import re

print("=== MOCKUP 0 SCRIPT ===")
m0_script = re.search(r'<script>(.*?)</script>', m0, re.DOTALL)
if m0_script:
    print(m0_script.group(1)[:2000])

print("\n=== MOCKUP 1 SCRIPT ===")
m1_script = re.search(r'<script>(.*?)</script>', m1, re.DOTALL)
if m1_script:
    print(m1_script.group(1)[:2000])
