with open('client/src/components/inventory/MasterList.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(20, 70):
    print(f"{i+1}: {lines[i]}", end='')
