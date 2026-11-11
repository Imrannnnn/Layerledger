with open('scripts/mockup_1.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
panes = re.findall(r'<div class="pane[^"]*" id="pane-[^"]*">(.*?)</div>\s*<!-- pane', text, re.DOTALL)
print(f'Found {len(panes)} panes')
for p in panes:
    print('--- PANE ---')
    print(p[:300])
