import { fmt, uid, today, recipeCost, calcFullCost, parseCSV } from './helpers';

describe('client helpers', () => {
  describe('fmt', () => {
    it('should format numbers to Naira currency', () => {
      expect(fmt(12500)).toBe('₦12,500');
      expect(fmt(0)).toBe('₦0');
      expect(fmt(150.75)).toBe('₦151'); // rounded to nearest int
      expect(fmt(null)).toBe('₦0');
    });
  });

  describe('uid', () => {
    it('should generate a string starting with an underscore', () => {
      const id = uid();
      expect(typeof id).toBe('string');
      expect(id.startsWith('_')).toBe(true);
      expect(id.length).toBeGreaterThan(3);
    });

    it('should generate unique values on subsequent calls', () => {
      const id1 = uid();
      const id2 = uid();
      expect(id1).not.toBe(id2);
    });
  });

  describe('today', () => {
    it('should return a date string in YYYY-MM-DD format', () => {
      const dateStr = today();
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('recipeCost', () => {
    const mockInv = [
      { id: 'i1', cost: 100 },
      { id: 'i2', cost: 200 },
      { id: 'i3', cost: 300 }
    ];

    it('should calculate the total cost of a recipe', () => {
      const mockRecipe = {
        ing: [
          { iid: 'i1', qty: 2.5 },
          { iid: 'i2', qty: 1 }
        ]
      };
      // 2.5 * 100 + 1 * 200 = 250 + 200 = 450
      expect(recipeCost(mockRecipe, mockInv)).toBe(450);
    });

    it('should return 0 if recipe is null/undefined', () => {
      expect(recipeCost(null, mockInv)).toBe(0);
    });

    it('should ignore ingredients not found in the inventory', () => {
      const mockRecipe = {
        ing: [
          { iid: 'i1', qty: 1 },
          { iid: 'non-existent', qty: 10 }
        ]
      };
      expect(recipeCost(mockRecipe, mockInv)).toBe(100);
    });
  });

  describe('calcFullCost', () => {
    const mockInv = [
      { id: 'i1', cost: 100 }, // Flour
      { id: 'i20', cost: 1000 }, // Cocoa Powder
      { id: 'i21', cost: 500 }, // Dark Chocolate (decoration)
      { id: 'i31', cost: 200 } // Flowers (decoration)
    ];

    const mockRecipe = {
      ing: [
        { iid: 'i1', qty: 1 }
      ]
    };

    it('should calculate base recipe cost with default accessory %', () => {
      // Base cost: 1 * 100 = 100
      // Default accessory percentage is 10% if not specified or passed as undefined/falsy
      // So with 10% it's 100 * 1.1 = 110
      expect(calcFullCost(mockRecipe, mockInv, '', [], 10)).toBeCloseTo(110);
    });

    it('should handle flavor extras', () => {
      // flavor: chocolate (uses i20 with qty 0.08 based on constants.js)
      // Base: 100
      // Chocolate extra: 0.08 * 1000 = 80
      // Total before accessory: 180
      // With 10% accessory: 180 * 1.1 = 198
      expect(calcFullCost(mockRecipe, mockInv, 'chocolate', [], 10)).toBeCloseTo(198);
    });

    it('should handle decoration extras (falling back to default accessoryPct of 10 if 0 is passed)', () => {
      // decorationIds: ['d3'] (maps to i31 with qty 3 in DECORATION_ITEMS)
      // Base: 100
      // D3 extra: 3 * 200 = 600
      // Total before accessory: 700
      // Passing 0 triggers fallback to 10% accessory: 700 * 1.1 = 770
      expect(calcFullCost(mockRecipe, mockInv, '', ['d3'], 0)).toBeCloseTo(770);
    });



    it('should return 0 if recipe is null', () => {
      expect(calcFullCost(null, mockInv, '', [], 10)).toBe(0);
    });
  });

  describe('parseCSV', () => {
    it('should parse standard CSV format correctly', () => {
      const csvText = `Name,Category,Unit,Cost,Stock,MinStock
Flour,Dry Goods,kg,1140,50,10
Sugar,Dry Goods,kg,1500,50,10`;

      const result = parseCSV(csvText);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Flour');
      expect(result[0].cat).toBe('Dry Goods');
      expect(result[0].unit).toBe('kg');
      expect(result[0].cost).toBe(1140);
      expect(result[0].stock).toBe(50);
      expect(result[0].minStock).toBe(10);
    });

    it('should return empty list if CSV has no data rows', () => {
      const csvText = `Name,Category,Unit,Cost,Stock,MinStock`;
      expect(parseCSV(csvText)).toEqual([]);
    });
  });
});
