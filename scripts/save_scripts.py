with open('scripts/mockup_0.html', 'r', encoding='utf-8') as f:
    m0 = f.read()

with open('scripts/mockup_1.html', 'r', encoding='utf-8') as f:
    m1 = f.read()

import re

m0_script = re.search(r'<script>(.*?)</script>', m0, re.DOTALL).group(1)
m1_script = re.search(r'<script>(.*?)</script>', m1, re.DOTALL).group(1)

with open('scripts/mockup_0_script.js', 'w', encoding='utf-8') as f:
    f.write(m0_script)

with open('scripts/mockup_1_script.js', 'w', encoding='utf-8') as f:
    f.write(m1_script)

print("Saved script 0 and 1.")
