with open('client/src/components/orders/QuotesPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if any(w in line.lower() for w in ['confirm', 'status', 'baking', 'sheet', 'production']):
        if any(w in line for w in ['confirm', 'Confirm', 'status', 'Sheet']):
            print(f"{i+1}: {line.strip()[:100]}")
