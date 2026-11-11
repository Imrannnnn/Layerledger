with open('client/src/components/inventory/MasterList.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines[:2105]):
    if line.startswith('function ') or line.startswith('const '):
        if '=>' in line or '(' in line:
            print(f"{i+1}: {line.strip()[:80]}")
