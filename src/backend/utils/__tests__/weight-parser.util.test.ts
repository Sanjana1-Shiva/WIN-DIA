import { parseWeight, parseWeightOrThrow, parseWeightWithFallback } from '../weight-parser.util';

describe('Weight Parser Utility', () => {
  describe('parseWeight', () => {
    it('should parse "480g" to 480', () => {
      const result = parseWeight('480g');
      expect(result.valid).toBe(true);
      expect(result.grams).toBe(480);
    });

    it('should parse "480 g" with space to 480', () => {
      const result = parseWeight('480 g');
      expect(result.valid).toBe(true);
      expect(result.grams).toBe(480);
    });

    it('should parse "0.48kg" to 480', () => {
      const result = parseWeight('0.48kg');
      expect(result.valid).toBe(true);
      expect(result.grams).toBe(480);
    });

    it('should parse "0.48 kg" with space to 480', () => {
      const result = parseWeight('0.48 kg');
      expect(result.valid).toBe(true);
      expect(result.grams).toBe(480);
    });

    it('should parse numeric 480 to 480', () => {
      const result = parseWeight(480);
      expect(result.valid).toBe(true);
      expect(result.grams).toBe(480);
    });

    it('should parse plain number string "480" to 480', () => {
      const result = parseWeight('480');
      expect(result.valid).toBe(true);
      expect(result.grams).toBe(480);
    });

    it('should reject null', () => {
      const result = parseWeight(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('null or undefined');
    });

    it('should reject undefined', () => {
      const result = parseWeight(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('null or undefined');
    });

    it('should reject empty string', () => {
      const result = parseWeight('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject zero', () => {
      const result = parseWeight(0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid numeric weight');
    });

    it('should reject negative values', () => {
      const result = parseWeight(-100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid numeric weight');
    });

    it('should reject "0g"', () => {
      const result = parseWeight('0g');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be positive');
    });

    it('should reject malformed string "abc"', () => {
      const result = parseWeight('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported weight format');
    });

    it('should reject unsupported unit "480lbs"', () => {
      const result = parseWeight('480lbs');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported weight format');
    });

    it('should round decimal grams "480.7g" to 481', () => {
      const result = parseWeight('480.7g');
      expect(result.valid).toBe(true);
      expect(result.grams).toBe(481);
    });

    it('should convert "1.5kg" to 1500g', () => {
      const result = parseWeight('1.5kg');
      expect(result.valid).toBe(true);
      expect(result.grams).toBe(1500);
    });
  });

  describe('parseWeightOrThrow', () => {
    it('should return grams for valid weight', () => {
      const grams = parseWeightOrThrow('480g');
      expect(grams).toBe(480);
    });

    it('should throw error for invalid weight', () => {
      expect(() => parseWeightOrThrow('invalid')).toThrow('Invalid weight');
    });

    it('should include field name in error', () => {
      expect(() => parseWeightOrThrow(null, 'product_weight')).toThrow('Invalid product_weight');
    });
  });

  describe('parseWeightWithFallback', () => {
    it('should return parsed weight for valid input', () => {
      const grams = parseWeightWithFallback('480g');
      expect(grams).toBe(480);
    });

    it('should return default fallback (480) for invalid input', () => {
      const grams = parseWeightWithFallback('invalid');
      expect(grams).toBe(480);
    });

    it('should return custom fallback for invalid input', () => {
      const grams = parseWeightWithFallback(null, 960);
      expect(grams).toBe(960);
    });
  });
});
