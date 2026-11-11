import re

with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

views = set(re.findall(r'setView\(["\'](\w+)["\']\)', text))
print('Views in App.jsx:', sorted(list(views)))

# Also check render switches in App.jsx
render_views = set(re.findall(r'view === ["\'](\w+)["\']', text))
print('Render views in App.jsx:', sorted(list(render_views)))
