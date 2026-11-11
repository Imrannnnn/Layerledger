import os
import re

files = [
    ('ba126346', '1-order-calculator.html', 'ba126346_1-order-calculator.html'),
    ('ee79e7fd', '2-recipes-and-pricing.html', 'ee79e7fd_2-recipes-and-pricing.html'),
    ('b07cb659', '3-production-sheet.html', 'b07cb659_3-production-sheet.html'),
    ('4649f4e3', '4-batter-calibration.html', '4649f4e3_4-batter-calibration.html'),
    ('d4ae948c', '5-recipe-job-tags.html', 'd4ae948c_5-recipe-job-tags.html'),
    ('8923c10e', '6-stock-adjustment.html', '8923c10e_6-stock-adjustment.html')
]

for short_id, orig_title, fname in files:
    path = os.path.join('scripts/extracted_artifacts', fname)
    with open(path, 'r', encoding='utf-8') as fp:
        html = fp.read()
    title_m = re.search(r'<title>(.*?)</title>', html, re.I)
    title = title_m.group(1) if title_m else 'No title'
    h1s = re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', html, re.I)
    # clean HTML tags from headings
    clean_h1s = [re.sub(r'<[^>]+>', '', h).strip() for h in h1s]
    css_vars = re.findall(r'(--[a-zA-Z0-9_\-]+:\s*[^;}]+)', html)
    print(f"=== {short_id}: {orig_title} ===")
    print(f"  Title tag: {title}")
    print(f"  Headings: {clean_h1s[:6]}")
    print(f"  CSS vars: {css_vars[:8]}")
    print(f"  HTML length: {len(html)} chars")
    print()
