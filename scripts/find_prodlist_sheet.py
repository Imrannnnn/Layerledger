with open('client/src/components/orders/ProductionList.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if any(w in line.lower() for w in ['sheet', 'print', 'entry', 'modal', 'view']):
        print(f"{i+1}: {line.strip()[:100]}")
