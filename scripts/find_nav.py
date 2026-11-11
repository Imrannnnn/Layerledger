with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Find NAV items or sidebar buttons
lines = text.splitlines()
for i, line in enumerate(lines):
    if 'NAV' in line or 'Sidebar' in line or 'navItems' in line or 'MENU' in line or 'setView(' in line:
        if any(w in line for w in ['MasterList', 'Calculator', 'Quotes', 'Stock', 'Inventory', 'Production']):
            print(f"{i+1}: {line.strip()[:100]}")
