with open('scripts/mockup_1.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re

for pane_id in ['pane-b', 'pane-c', 'pane-p', 'pane-o', 'pane-z']:
    start = text.find(f'id="{pane_id}"')
    if start != -1:
        # find closing tag or next pane
        next_pane = text.find('class="pane', start + 10)
        chunk = text[start:next_pane] if next_pane != -1 else text[start:start+2500]
        print(f"=== {pane_id} (len: {len(chunk)}) ===")
        print(chunk[:1000])
        print("...\n")
