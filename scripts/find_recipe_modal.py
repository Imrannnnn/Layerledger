with open('client/src/components/inventory/MasterList.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'RecipeModal' in line:
        print(f"{i+1}: {line.strip()[:100]}")
