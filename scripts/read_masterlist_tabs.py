with open('client/src/components/inventory/MasterList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
tabs = re.findall(r'tab\s*===\s*["\'](\w+)["\']', text)
print('Tabs in MasterList:', set(tabs))

subtabs = re.findall(r'recipeTab\s*===\s*["\'](\w+)["\']', text)
print('Recipe subtabs:', set(subtabs))
