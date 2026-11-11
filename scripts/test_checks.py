import math

CM2 = 6.4516

def plan(s, a, b=0):
    if s == 'round':
        return math.pi * a * a / 4
    elif s == 'square':
        return a * a
    elif s == 'rect':
        return a * b
    raise ValueError(f"Unknown shape {s}")

def peri(s, a, b=0):
    if s == 'round':
        return math.pi * a
    elif s == 'square':
        return 4 * a
    elif s == 'rect':
        return 2 * (a + b)
    raise ValueError(f"Unknown shape {s}")

def mass(areaIn2, mm, den, waste):
    return areaIn2 * CM2 * (mm / 10.0) * den * (1.0 + waste)

def reverseThickness(grams, areaIn2, den, waste):
    return grams / (areaIn2 * CM2 * den * (1.0 + waste)) * 10.0

def perPan(W, L, w, l):
    a = math.floor(L / l) * math.floor(W / w)
    b = math.floor(L / w) * math.floor(W / l)
    return max(a, b)

print("--- Check 1: Calibration ---")
# 617 g poured into 6 inch round, levelled to 2 inches.
# Plan area: PI * 6^2 / 4 = 28.27433388...
cal_pa = plan('round', 6)
cal_d = 617 / (cal_pa * 2)
print(f"Plan area: {cal_pa:.3f} in² (Expected 28.274)")
print(f"Density: {cal_d:.3f} g/in²/in (Expected 10.911)")

print("\n--- Check 2: Height division across mixed flavours ---")
# 10 inch round, 7 inches tall, 3 flavour rows at 1 layer each.
# Densities: 10.911 van, 11.088 cho, 13.104 rv. Trim 8% on all 3.
pa_10 = plan('round', 10)
layers = [
    {'name': 'van', 'd': 10.911, 'n': 1, 'trim': 0.08},
    {'name': 'cho', 'd': 11.088, 'n': 1, 'trim': 0.08},
    {'name': 'rv',  'd': 13.104, 'n': 1, 'trim': 0.08}
]
nL = sum(L['n'] for L in layers)
th = 7.0 / nL
print(f"Layer thickness: {th:.2f} in (Expected 2.33 in)")
total_bat = 0
for L in layers:
    gpl = L['d'] * pa_10 * th * (1 + L['trim'])
    total_bat += gpl * L['n']
    print(f"{L['name']}, one pan: {gpl:.0f} g (Expected van: 2160, cho: 2195, rv: 2594)")
print(f"Total batter: {total_bat/1000:.2f} kg (Expected about 6.95 kg)")

print("\n--- Check 3: Covering mass ---")
# Same cake: 10 in round, 7 in tall.
# Surface area = plan + peri * H
# Gap area = plan * max(nL - 1, 0)
surf_10 = pa_10 + peri('round', 10) * 7.0
gap_10 = pa_10 * (nL - 1)
print(f"Surface area: {surf_10:.2f} in² (Expected 298.45)")
print(f"Gap area: {gap_10:.2f} in² (Expected 157.08)")

# Fondant finish, 8 mm, density 1.35, waste 25%
fondant_mass = mass(surf_10, 8.0, 1.35, 0.25)
print(f"Fondant finish: {fondant_mass:.0f} g (Expected 2,599 g)")

# Buttercream filling, 4.5 mm, density 0.90, waste 15%
bc_fill_mass = mass(gap_10, 4.5, 0.90, 0.15)
print(f"Buttercream filling: {bc_fill_mass:.0f} g (Expected 472 g)")

print("\n--- Check 4: Thickness round trip ---")
rev_mm = reverseThickness(fondant_mass, surf_10, 1.35, 0.25)
print(f"Reverse thickness: {rev_mm:.2f} mm (Expected 8.00 mm)")

print("\n--- Check 5: Portions geometry ---")
# 100 servings, slices 2 by 2 by 4 inches, 5% cutting allowance, 12 by 18 tray.
# 3 layers inside as 2 vanilla and 1 chocolate.
servings = 100
allowance = 0.05
needed = math.ceil(servings * (1 + allowance))
print(f"Needed with allowance: {needed} (Expected 105)")
slices_per_slab = perPan(12, 18, 2, 2)
print(f"Slices a slab gives: {slices_per_slab} (Expected 54)")
slabs = max(1, math.ceil(needed / slices_per_slab))
print(f"Slabs: {slabs} (Expected 2)")
p_layers = [
    {'name': 'van', 'd': 10.911, 'n': 2, 'trim': 0.08},
    {'name': 'cho', 'd': 11.088, 'n': 1, 'trim': 0.08}
]
p_nL = sum(L['n'] for L in p_layers)
p_pans = p_nL * slabs
print(f"Pans to bake: {p_pans} (Expected 6)")
p_th = 4.0 / p_nL
print(f"Layer thickness: {p_th:.2f} in (Expected 1.33 in)")
pa_tray = 12 * 18
p_total_bat = 0
for L in p_layers:
    gpl = L['d'] * pa_tray * p_th * (1 + L['trim'])
    npans = L['n'] * slabs
    fg = gpl * npans
    p_total_bat += fg
    print(f"{L['name']}, per pan: {gpl:.0f} g, across {npans} pans (Expected van: 3,394 g across 4 pans, cho: 3,449 g across 2 pans)")
print(f"Total batter: {p_total_bat/1000:.2f} kg (Expected 20.47 kg)")

# Buttercream filling: gapArea = pa_tray * (p_nL - 1) * slabs
p_gap = pa_tray * (p_nL - 1) * slabs
p_bc_fill = mass(p_gap, 4.5, 0.90, 0.15)
print(f"Buttercream filling: {p_bc_fill/1000:.2f} kg (Expected 2.60 kg)")

print("\n--- Check 6: Layers sensitivity (3 vs 4 layers) ---")
# Same order, change layers from 3 to 4 inside 4 inch slice (e.g. 2 van, 2 cho or any split)
for ly_count in [3, 4]:
    ly_th = 4.0 / ly_count
    # let's assume ratio van 2/3, cho 1/3 or van 2, cho 2
    # In check 6: "Vanilla base recipe yielding 1,221g... total batter 20.47 kg vs 20.44 kg"
    # For 4 layers, let's say 2 van, 2 cho or 3 van 1 cho:
    # 2 van (d=10.911), 2 cho (d=11.088): avg d = 11.00
    # For 3 layers (2 van, 1 cho): avg d = (2*10.911 + 11.088)/3 = 10.97
    # Notice: pans to bake = ly_count * slabs = 8 pans
    # th = 4.0 / 4 = 1.00 in
    # gap area = pa_tray * (4 - 1) * slabs = pa_tray * 3 * 2
    fill_4 = mass(pa_tray * 3 * slabs, 4.5, 0.90, 0.15)
    # Batter for 4 layers:
    # If 2 van, 2 cho: 2*(10.911*pa_tray*1*(1+0.08)*2) + 2*(11.088*pa_tray*1*(1+0.08)*2)
    van_gpl_4 = 10.911 * pa_tray * 1.0 * 1.08
    cho_gpl_4 = 11.088 * pa_tray * 1.0 * 1.08
    bat_4 = (van_gpl_4 * 4) + (cho_gpl_4 * 4) # across 8 pans (4 van, 4 cho or 2 slabs * 2 layers)
    # Wait, if 2 van, 2 cho or whatever flavour split:
    print(f"{ly_count} layers: th={ly_th:.2f} in, pans={ly_count*slabs}, filling={mass(pa_tray*(ly_count-1)*slabs, 4.5, 0.9, 0.15)/1000:.2f} kg")

print("\n--- Check 7: Scaled recipe per pan ---")
# Vanilla base recipe yielding 1,221 g:
# 250 butter, 250 sugar, 250 eggs, 300 flour, 150 milk, 10 baking powder, 3 salt, 8 vanilla. Total = 1,221 g.
# 10 inch round at 2 inch layer thickness needs:
# d = 10.911 (from 617 / (pi*9*2))
# plan(round, 10) = pi * 25 = 78.5398
# gramsPerPan = d * plan * 2 * (1 + 0.08) = 10.91104... * 78.5398... * 2 * 1.08 = 1851.0 g
g_pan = cal_d * plan('round', 10) * 2 * 1.08
scale_factor = g_pan / 1221.0
print(f"Grams per pan: {g_pan:.1f} g (Expected 1,851 g)")
print(f"Scale factor: {scale_factor:.3f} (Expected 1.516)")
base_ings = [
    ('butter', 250), ('sugar', 250), ('eggs', 250),
    ('flour', 300), ('milk', 150), ('baking powder', 10),
    ('salt', 3), ('vanilla', 8)
]
scaled = [(name, round(amt * scale_factor)) for name, amt in base_ings]
print("Scaled ingredients:", scaled)
print("Sum of scaled:", sum(amt for _, amt in scaled))

print("\n--- Check 8: Cost stack direction ---")
direct = 100000
accessories = direct * 0.15
overhead = (direct + accessories) * 0.27
total_cost = direct + accessories + overhead
price = total_cost / (1 - 0.50)
charge = math.ceil(price / 500) * 500
print(f"Direct: {direct}")
print(f"Accessories: {accessories:.0f} (Expected 15,000)")
print(f"Overhead: {overhead:.0f} (Expected 31,050)")
print(f"Total cost: {total_cost:.0f} (Expected 146,050)")
print(f"Price: {price:.0f} (Expected 292,100)")
print(f"Charge: {charge:.0f} (Expected 292,500)")
