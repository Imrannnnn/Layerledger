with open('scripts/mockup_1.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
ids = re.findall(r'id=["\']([^"\']+)["\']', text)
print('IDs in mockup 1:', ids)
