with open('client/src/components/inventory/MasterList.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(2080, 2130):
    print(f"{i+1}: {lines[i]}", end='')
