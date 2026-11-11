import os
import re

out_dir = 'scripts/extracted_artifacts'
files = [
    ('1_order_calc', 'ba126346_1-order-calculator.html'),
    ('2_recipes_pricing', 'ee79e7fd_2-recipes-and-pricing.html'),
    ('3_prod_sheet', 'b07cb659_3-production-sheet.html'),
    ('4_batter_cal', '4649f4e3_4-batter-calibration.html'),
    ('5_recipe_tags', 'd4ae948c_5-recipe-job-tags.html'),
    ('6_stock_adj', '8923c10e_6-stock-adjustment.html')
]

for name, fname in files:
    path = os.path.join(out_dir, fname)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract style block
    style_m = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
    style = style_m.group(1) if style_m else ''
    
    # Extract body HTML (without style and script)
    body_m = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL)
    body = body_m.group(1) if body_m else content
    body_no_script = re.sub(r'<script[^>]*>.*?</script>', '', body, flags=re.DOTALL)
    
    # Extract script
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
    script_text = '\n'.join(scripts)
    
    print(f"==================================================")
    print(f"ARTIFACT: {name}")
    print(f"Style size: {len(style)}, Body markup size: {len(body_no_script)}, Script size: {len(script_text)}")
    
    # Key selectors
    selectors = re.findall(r'(\.[a-zA-Z0-9_\-]+)\s*\{', style)
    print(f"Key CSS Classes ({len(set(selectors))}): {list(set(selectors))[:20]}")
    
    # Save clean body and script for inspection
    with open(os.path.join(out_dir, f'{name}_body.html'), 'w', encoding='utf-8') as f:
        f.write(body_no_script)
    with open(os.path.join(out_dir, f'{name}_script.js'), 'w', encoding='utf-8') as f:
        f.write(script_text)
    with open(os.path.join(out_dir, f'{name}_style.css'), 'w', encoding='utf-8') as f:
        f.write(style)

print("Analysis extraction complete!")
