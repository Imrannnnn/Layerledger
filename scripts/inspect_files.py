import re

files_to_check = [
    'client/src/components/inventory/MasterList.jsx',
    'client/src/components/orders/OrderCalculator.jsx',
    'client/src/components/orders/ProductionList.jsx',
    'client/src/components/orders/ProductionEntry.jsx',
    'client/src/components/orders/QuotesPage.jsx',
    'backend/controller/recipeController.js',
    'backend/controller/orderController.js',
    'backend/controller/inventoryController.js'
]

for fpath in files_to_check:
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        print(f'{fpath}: {len(lines)} lines')
    except Exception as e:
        print(f'{fpath}: {e}')
