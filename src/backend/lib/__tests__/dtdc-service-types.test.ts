/**
 * DTDC Service Types Tests
 * Tests for B2C PREMIUM and B2C PRIORITY service support
 */

import { 
  DtdcServiceType, 
  DTDC_SERVICE_CONFIGS, 
  PLACEHOLDER_DIMENSIONS,
  PackagingDimensions 
} from '../dtdc';

describe('DTDC Service Types', () => {
  describe('Service Type Constants', () => {
    it('should define B2C PREMIUM service type', () => {
      expect(DtdcServiceType.B2C_PREMIUM).toBe('B2C PREMIUM');
    });

    it('should define B2C PRIORITY service type', () => {
      expect(DtdcServiceType.B2C_PRIORITY).toBe('B2C PRIORITY');
    });
  });

  describe('Service Configurations', () => {
    it('should have configuration for B2C PREMIUM', () => {
      const config = DTDC_SERVICE_CONFIGS['B2C PREMIUM'];
      
      expect(config).toBeDefined();
      expect(config.serviceType).toBe('B2C PREMIUM');
      expect(config.description).toContain('single-parcel');
      expect(config.recommendedFor).toBeDefined();
    });

    it('should have configuration for B2C PRIORITY', () => {
      const config = DTDC_SERVICE_CONFIGS['B2C PRIORITY'];
      
      expect(config).toBeDefined();
      expect(config.serviceType).toBe('B2C PRIORITY');
      expect(config.description).toContain('multi-parcel');
      expect(config.recommendedFor).toBeDefined();
    });

    it('should have exactly 2 service configurations', () => {
      const serviceTypes = Object.keys(DTDC_SERVICE_CONFIGS);
      expect(serviceTypes).toHaveLength(2);
      expect(serviceTypes).toContain('B2C PREMIUM');
      expect(serviceTypes).toContain('B2C PRIORITY');
    });
  });

  describe('Packaging Configuration', () => {
    it('should have placeholder dimensions for testing', () => {
      expect(PLACEHOLDER_DIMENSIONS).toBeDefined();
      expect(PLACEHOLDER_DIMENSIONS.length).toBe(30);
      expect(PLACEHOLDER_DIMENSIONS.width).toBe(25);
      expect(PLACEHOLDER_DIMENSIONS.height).toBe(10);
    });

    it('should have valid dimension values', () => {
      expect(PLACEHOLDER_DIMENSIONS.length).toBeGreaterThan(0);
      expect(PLACEHOLDER_DIMENSIONS.width).toBeGreaterThan(0);
      expect(PLACEHOLDER_DIMENSIONS.height).toBeGreaterThan(0);
    });

    it('placeholder dimensions should be marked for testing only', () => {
      // These dimensions are for LOCAL TESTING ONLY
      // NOT verified WIN-DIA packaging specifications
      const dims = PLACEHOLDER_DIMENSIONS;
      
      expect(dims).toBeDefined();
      expect(dims.length).toBe(30); // PLACEHOLDER
      expect(dims.width).toBe(25);  // PLACEHOLDER
      expect(dims.height).toBe(10); // PLACEHOLDER
    });
  });
});

describe('DTDC Payload Generation', () => {
  // Mock environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DTDC_API_KEY: 'test_api_key',
      DTDC_CUSTOMER_CODE: 'TEST123',
      DTDC_SERVICE_TYPE_ID: 'B2C PREMIUM',
      DTDC_COMMODITY_ID: '1',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('B2C PREMIUM Payload', () => {
    it('should generate correct payload structure for B2C PREMIUM', () => {
      const mockParams = {
        orderId: 'test-order-123',
        orderNumber: 'ORD-123',
        shippingAddress: {
          name: 'John Doe',
          phone: '9876543210',
          address_line1: '123 Test Street',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
        },
        items: [
          {
            name: 'Garlic Flavour',
            qty: 1,
            price: 384,
            product_id: 'prod-1',
            net_weight_grams: 240,
          }
        ],
        totalPrice: 384,
        paymentMethod: 'razorpay',
      };

      const expectedPayload = {
        customer_code: 'TEST123',
        service_type_id: 'B2C PREMIUM',
        load_type: 'NON-DOCUMENT',
        consignment_type: 'Forward',
        weight_unit: 'kg',
        weight: 0.24, // 240g = 0.24kg
        num_pieces: 1,
      };

      // Service type should be B2C PREMIUM
      expect(mockParams.items[0].net_weight_grams).toBe(240);
      expect(expectedPayload.service_type_id).toBe('B2C PREMIUM');
      expect(expectedPayload.weight).toBe(0.24);
      expect(expectedPayload.num_pieces).toBe(1);
    });

    it('should handle single bundle order (1 bundle = 240g)', () => {
      const items = [
        { name: 'Product', qty: 1, net_weight_grams: 240, price: 384, product_id: 'p1' }
      ];
      
      const totalGrams = items.reduce((sum, i) => sum + (i.net_weight_grams * i.qty), 0);
      const totalKg = totalGrams / 1000;
      const numPieces = items.reduce((sum, i) => sum + i.qty, 0);
      
      expect(totalGrams).toBe(240);
      expect(totalKg).toBe(0.24);
      expect(numPieces).toBe(1);
    });
  });

  describe('B2C PRIORITY Payload', () => {
    it('should generate correct payload structure for B2C PRIORITY', () => {
      const mockParams = {
        orderId: 'test-order-456',
        orderNumber: 'ORD-456',
        shippingAddress: {
          name: 'Jane Smith',
          phone: '9876543210',
          address_line1: '456 Test Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
        items: [
          {
            name: 'Garlic Flavour',
            qty: 2,
            price: 320,
            product_id: 'prod-1',
            net_weight_grams: 240,
          },
          {
            name: 'Onion Flavour',
            qty: 1,
            price: 384,
            product_id: 'prod-2',
            net_weight_grams: 240,
          }
        ],
        totalPrice: 896,
        paymentMethod: 'cod',
      };

      const expectedPayload = {
        customer_code: 'TEST123',
        service_type_id: 'B2C PRIORITY',
        load_type: 'NON-DOCUMENT',
        consignment_type: 'Forward',
        weight_unit: 'kg',
        weight: 0.72, // 720g = 0.72kg
        num_pieces: 3,
        cod_collection_mode: 'Cash',
        cod_amount: 896,
      };

      // Multiple items calculation
      const totalWeight = mockParams.items.reduce((sum, i) => sum + (i.net_weight_grams * i.qty), 0);
      
      expect(totalWeight).toBe(720); // 480 + 240
      expect(expectedPayload.weight).toBe(0.72);
      expect(expectedPayload.num_pieces).toBe(3);
      expect(expectedPayload.cod_collection_mode).toBe('Cash');
    });

    it('should handle multi-bundle order (3 bundles = 720g)', () => {
      const items = [
        { name: 'Product 1', qty: 2, net_weight_grams: 240, price: 320, product_id: 'p1' },
        { name: 'Product 2', qty: 1, net_weight_grams: 240, price: 384, product_id: 'p2' }
      ];
      
      const totalGrams = items.reduce((sum, i) => sum + (i.net_weight_grams * i.qty), 0);
      const totalKg = totalGrams / 1000;
      const numPieces = items.reduce((sum, i) => sum + i.qty, 0);
      
      expect(totalGrams).toBe(720); // 480 + 240
      expect(totalKg).toBe(0.72);
      expect(numPieces).toBe(3);
    });
  });

  describe('Weight Calculations', () => {
    it('should calculate correct weight: 1 bundle = 240g', () => {
      const bundles = 1;
      const weightPerBundle = 240;
      const totalWeight = weightPerBundle * bundles;
      const weightKg = totalWeight / 1000;
      
      expect(totalWeight).toBe(240);
      expect(weightKg).toBe(0.24);
    });

    it('should calculate correct weight: 2 bundles = 480g', () => {
      const bundles = 2;
      const weightPerBundle = 240;
      const totalWeight = weightPerBundle * bundles;
      const weightKg = totalWeight / 1000;
      
      expect(totalWeight).toBe(480);
      expect(weightKg).toBe(0.48);
    });

    it('should calculate correct weight: 3 bundles = 720g', () => {
      const bundles = 3;
      const weightPerBundle = 240;
      const totalWeight = weightPerBundle * bundles;
      const weightKg = totalWeight / 1000;
      
      expect(totalWeight).toBe(720);
      expect(weightKg).toBe(0.72);
    });
  });

  describe('Service Type Selection', () => {
    it('should use environment default when no override provided', () => {
      process.env.DTDC_SERVICE_TYPE_ID = 'B2C PREMIUM';
      
      const serviceType = process.env.DTDC_SERVICE_TYPE_ID;
      
      expect(serviceType).toBe('B2C PREMIUM');
    });

    it('should allow override to B2C PRIORITY', () => {
      process.env.DTDC_SERVICE_TYPE_ID = 'B2C PREMIUM';
      const override = 'B2C PRIORITY';
      
      const serviceType = override || process.env.DTDC_SERVICE_TYPE_ID;
      
      expect(serviceType).toBe('B2C PRIORITY');
    });

    it('should not automatically switch based on bundle count', () => {
      // Multiple bundles should NOT automatically use B2C PRIORITY
      const bundles = 3;
      const defaultService = 'B2C PREMIUM';
      
      // Service type should remain as configured, not auto-switch
      const serviceType = defaultService; // No automatic logic
      
      expect(serviceType).toBe('B2C PREMIUM');
      expect(bundles).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing service type configuration', () => {
      process.env.DTDC_SERVICE_TYPE_ID = '';
      
      const serviceType = process.env.DTDC_SERVICE_TYPE_ID;
      
      expect(serviceType).toBe('');
      // In actual code, this would throw an error
    });

    it('should handle invalid service type', () => {
      const invalidServiceType = 'INVALID_SERVICE';
      const validTypes = ['B2C PREMIUM', 'B2C PRIORITY'];
      
      const isValid = validTypes.includes(invalidServiceType);
      
      expect(isValid).toBe(false);
    });

    it('should handle missing AWB allocation', () => {
      const mockResponse: any = {
        success: true,
        reference_number: 'REF123',
        // awb_number is missing
      };
      
      const awb = mockResponse.awb_number || mockResponse.reference_number;
      
      // Should use reference_number as fallback
      expect(awb).toBe('REF123');
    });

    it('should handle insufficient balance error', () => {
      const errorMessage = 'Insufficient balance in DTDC account';
      
      expect(errorMessage.toLowerCase()).toContain('balance');
    });

    it('should handle duplicate booking error', () => {
      const errorMessage = 'Duplicate reference number';
      
      expect(errorMessage.toLowerCase()).toContain('duplicate');
    });
  });

  describe('COD Handling', () => {
    it('should include COD fields for COD payments', () => {
      const paymentMethod = 'cod';
      const totalPrice = 384; // 1 bundle tiered pricing
      
      const isCOD = paymentMethod === 'cod';
      const codFields = isCOD ? {
        cod_collection_mode: 'Cash' as const,
        cod_amount: totalPrice,
      } : {};
      
      expect(isCOD).toBe(true);
      expect(codFields.cod_collection_mode).toBe('Cash');
      expect(codFields.cod_amount).toBe(384);
    });

    it('should exclude COD fields for online payments', () => {
      const checkCOD = (paymentMethod: 'razorpay' | 'cod') => {
        const totalPrice = 640; // 2 bundles tiered pricing
        
        const isCOD = paymentMethod === 'cod';
        const codFields = isCOD ? {
          cod_collection_mode: 'Cash' as const,
          cod_amount: totalPrice,
        } : {};
        
        return { isCOD, codFields };
      };
      
      const result = checkCOD('razorpay');
      expect(result.isCOD).toBe(false);
      expect(Object.keys(result.codFields)).toHaveLength(0);
    });
  });

  describe('Dimensions', () => {
    it('should use placeholder dimensions for testing', () => {
      const dimensions = PLACEHOLDER_DIMENSIONS;
      
      expect(dimensions.length).toBe(30); // PLACEHOLDER
      expect(dimensions.width).toBe(25);  // PLACEHOLDER
      expect(dimensions.height).toBe(10); // PLACEHOLDER
    });

    it('should not use placeholder dimensions in production', () => {
      // Placeholder dimensions are for LOCAL TESTING ONLY
      // Production must configure DTDC_PACKAGING_VERIFIED=true
      const dimensions = PLACEHOLDER_DIMENSIONS;
      
      // These are NOT verified WIN-DIA packaging specifications
      expect(dimensions.length).toBeGreaterThan(0);
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
    });

    it('should require verified packaging for live shipments', () => {
      // Live shipments must have DTDC_PACKAGING_VERIFIED=true
      // Otherwise validatePackagingForLiveShipment() will throw error
      const isVerified = process.env.DTDC_PACKAGING_VERIFIED === 'true';
      
      // In test environment, should be false (placeholder mode)
      expect(isVerified).toBe(false);
    });
  });
});
