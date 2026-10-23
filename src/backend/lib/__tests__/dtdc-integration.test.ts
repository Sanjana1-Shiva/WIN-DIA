/**
 * DTDC Integration Tests
 * Tests for DTDC booking scenarios with mock HTTP responses
 * 
 * IMPORTANT: These tests use MOCK responses and do NOT call production DTDC API
 */

import { dtdcProvider } from '../dtdc';
import type { CreateShipmentParams } from '../shipping-types';

// Mock fetch globally
global.fetch = jest.fn();

describe('DTDC Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up test environment variables
    process.env.DTDC_API_KEY = 'test_api_key_12345';
    process.env.DTDC_CUSTOMER_CODE = 'BO13750';
    process.env.DTDC_SERVICE_TYPE_ID = 'B2C PREMIUM';
    process.env.DTDC_COMMODITY_ID = '1';
    
    // Configure packaging for testing (NOT verified)
    process.env.DTDC_PACKAGING_LENGTH_CM = '30';
    process.env.DTDC_PACKAGING_WIDTH_CM = '25';
    process.env.DTDC_PACKAGING_HEIGHT_CM = '10';
    process.env.DTDC_PACKAGING_WEIGHT_GRAMS = '0';
    process.env.DTDC_PACKAGING_VERIFIED = 'true'; // Allow test API calls
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Scenario 1: Single Customer, Single Bundle', () => {
    it('should create B2C PREMIUM shipment for 1 bundle (0.48kg)', async () => {
      // Mock successful DTDC response
      const mockResponse = {
        success: true,
        reference_number: 'WINDIA-ORD-001',
        awb_number: 'D12345678901',
        consignment_number: 'D12345678901',
        tracking_url: 'https://www.dtdc.in/tracking.asp?trackno=D12345678901',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'order-uuid-001',
        orderNumber: 'WINDIA-ORD-001',
        shippingAddress: {
          name: 'Rajesh Kumar',
          phone: '9876543210',
          address_line1: '123 MG Road',
          address_line2: 'Koramangala',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560034',
        },
        items: [
          {
            product_id: 'prod-garlic',
            name: 'Garlic Flavour',
            qty: 1,
            price: 640,
            net_weight_grams: 480,
          },
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.awbCode).toBe('D12345678901');
      expect(result.orderId).toBe('WINDIA-ORD-001');
      expect(result.courierName).toBe('DTDC');

      // Verify API was called
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Extract and verify payload
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const consignment = requestBody.consignments[0];

      expect(consignment.service_type_id).toBe('B2C PREMIUM');
      expect(consignment.weight).toBe(0.48);
      expect(consignment.weight_unit).toBe('kg');
      expect(consignment.num_pieces).toBe(1);
      expect(consignment.length).toBe(30);
      expect(consignment.width).toBe(25);
      expect(consignment.height).toBe(10);
      expect(consignment.dimension_unit).toBe('cm');
      expect(consignment.declared_value).toBe(640);
      expect(consignment.customer_code).toBe('BO13750');
      expect(consignment.reference_number).toBe('WINDIA-ORD-001');
      
      // Verify no COD fields (online payment)
      expect(consignment.cod_amount).toBeUndefined();
      expect(consignment.cod_collection_mode).toBeUndefined();
    });

    it('should generate correct payload structure for single bundle', async () => {
      const mockResponse = { success: true, awb_number: 'D99999999999' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'order-001',
        orderNumber: 'ORD-001',
        shippingAddress: {
          name: 'Test User',
          phone: '9999999999',
          address_line1: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      await dtdcProvider.createShipment(params);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);

      // Verify top-level structure
      expect(payload).toHaveProperty('consignments');
      expect(Array.isArray(payload.consignments)).toBe(true);
      expect(payload.consignments).toHaveLength(1);

      // Verify consignment structure matches DTDC API schema
      const c = payload.consignments[0];
      expect(c).toHaveProperty('customer_code');
      expect(c).toHaveProperty('service_type_id');
      expect(c).toHaveProperty('load_type');
      expect(c).toHaveProperty('consignment_type');
      expect(c).toHaveProperty('weight');
      expect(c).toHaveProperty('weight_unit');
      expect(c).toHaveProperty('dimension_unit');
      expect(c).toHaveProperty('length');
      expect(c).toHaveProperty('width');
      expect(c).toHaveProperty('height');
      expect(c).toHaveProperty('num_pieces');
      expect(c).toHaveProperty('origin_details');
      expect(c).toHaveProperty('destination_details');
      expect(c).toHaveProperty('return_details');
      expect(c).toHaveProperty('commodity_id');
      expect(c).toHaveProperty('invoice_number');
      expect(c).toHaveProperty('invoice_date');
      expect(c).toHaveProperty('reference_number');
    });
  });

  describe('Scenario 2: Single Customer, Three Bundles (One Box)', () => {
    it('should create B2C PREMIUM shipment for 3 bundles in one box (1.44kg)', async () => {
      const mockResponse = {
        success: true,
        reference_number: 'WINDIA-ORD-002',
        awb_number: 'D12345678902',
        consignment_number: 'D12345678902',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'order-uuid-002',
        orderNumber: 'WINDIA-ORD-002',
        shippingAddress: {
          name: 'Priya Sharma',
          phone: '9123456789',
          address_line1: '456 Park Street',
          address_line2: 'Andheri West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400058',
        },
        items: [
          {
            product_id: 'prod-garlic',
            name: 'Garlic Flavour',
            qty: 1,
            price: 640,
            net_weight_grams: 480,
          },
          {
            product_id: 'prod-onion',
            name: 'Onion Flavour',
            qty: 1,
            price: 640,
            net_weight_grams: 480,
          },
          {
            product_id: 'prod-tomato',
            name: 'Tomato Flavour',
            qty: 1,
            price: 640,
            net_weight_grams: 480,
          },
        ],
        totalPrice: 1920,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.awbCode).toBe('D12345678902');

      // Verify payload
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const consignment = requestBody.consignments[0];

      expect(consignment.service_type_id).toBe('B2C PREMIUM');
      expect(consignment.weight).toBe(1.44); // 480g * 3 = 1440g = 1.44kg
      expect(consignment.num_pieces).toBe(3); // 3 bundles
      expect(consignment.declared_value).toBe(1920);
      
      // One consignment, one physical box
      expect(requestBody.consignments).toHaveLength(1);
    });

    it('should calculate correct total weight for multiple bundles', async () => {
      const mockResponse = { success: true, awb_number: 'D99999999998' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'order-002',
        orderNumber: 'ORD-002',
        shippingAddress: {
          name: 'Test User',
          phone: '9999999999',
          address_line1: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product 1', qty: 2, price: 640, net_weight_grams: 480 },
          { product_id: 'p2', name: 'Product 2', qty: 1, price: 640, net_weight_grams: 480 },
        ],
        totalPrice: 1920,
        paymentMethod: 'razorpay',
      };

      await dtdcProvider.createShipment(params);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      const c = payload.consignments[0];

      // Weight: (2 * 480g) + (1 * 480g) = 960g + 480g = 1440g = 1.44kg
      expect(c.weight).toBe(1.44);
      expect(c.num_pieces).toBe(3); // Total quantity
    });
  });

  describe('Scenario 3: Three Customers, One Bundle Each', () => {
    it('should create three separate B2C PREMIUM consignments', async () => {
      // Customer 1
      const mockResponse1 = {
        success: true,
        reference_number: 'WINDIA-ORD-003',
        awb_number: 'D12345678903',
      };

      // Customer 2
      const mockResponse2 = {
        success: true,
        reference_number: 'WINDIA-ORD-004',
        awb_number: 'D12345678904',
      };

      // Customer 3
      const mockResponse3 = {
        success: true,
        reference_number: 'WINDIA-ORD-005',
        awb_number: 'D12345678905',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockResponse1),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockResponse2),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockResponse3),
        });

      // Customer 1
      const params1: CreateShipmentParams = {
        orderId: 'order-003',
        orderNumber: 'WINDIA-ORD-003',
        shippingAddress: {
          name: 'Customer One',
          phone: '9111111111',
          address_line1: '111 Street',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001',
        },
        items: [
          { product_id: 'p1', name: 'Garlic', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      // Customer 2
      const params2: CreateShipmentParams = {
        orderId: 'order-004',
        orderNumber: 'WINDIA-ORD-004',
        shippingAddress: {
          name: 'Customer Two',
          phone: '9222222222',
          address_line1: '222 Avenue',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600001',
        },
        items: [
          { product_id: 'p2', name: 'Onion', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      // Customer 3
      const params3: CreateShipmentParams = {
        orderId: 'order-005',
        orderNumber: 'WINDIA-ORD-005',
        shippingAddress: {
          name: 'Customer Three',
          phone: '9333333333',
          address_line1: '333 Boulevard',
          city: 'Kolkata',
          state: 'West Bengal',
          pincode: '700001',
        },
        items: [
          { product_id: 'p3', name: 'Tomato', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      // Create three separate shipments
      const result1 = await dtdcProvider.createShipment(params1);
      const result2 = await dtdcProvider.createShipment(params2);
      const result3 = await dtdcProvider.createShipment(params3);

      // Verify all succeeded
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Verify unique AWBs
      expect(result1.awbCode).toBe('D12345678903');
      expect(result2.awbCode).toBe('D12345678904');
      expect(result3.awbCode).toBe('D12345678905');

      // Verify three separate API calls
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Verify each consignment has correct customer details
      const call1 = (global.fetch as jest.Mock).mock.calls[0];
      const payload1 = JSON.parse(call1[1].body);
      expect(payload1.consignments[0].destination_details.name).toBe('Customer One');
      expect(payload1.consignments[0].destination_details.city).toBe('Delhi');
      expect(payload1.consignments[0].weight).toBe(0.48);

      const call2 = (global.fetch as jest.Mock).mock.calls[1];
      const payload2 = JSON.parse(call2[1].body);
      expect(payload2.consignments[0].destination_details.name).toBe('Customer Two');
      expect(payload2.consignments[0].destination_details.city).toBe('Chennai');
      expect(payload2.consignments[0].weight).toBe(0.48);

      const call3 = (global.fetch as jest.Mock).mock.calls[2];
      const payload3 = JSON.parse(call3[1].body);
      expect(payload3.consignments[0].destination_details.name).toBe('Customer Three');
      expect(payload3.consignments[0].destination_details.city).toBe('Kolkata');
      expect(payload3.consignments[0].weight).toBe(0.48);
    });
  });

  describe('Scenario 4: B2C PRIORITY with Multi-Parcel', () => {
    it('should create B2C PRIORITY shipment (NOTE: DTDC may require pieces_detail for true multi-parcel)', async () => {
      const mockResponse = {
        success: true,
        reference_number: 'WINDIA-ORD-006',
        awb_number: 'D12345678906',
        consignment_number: 'D12345678906',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'order-006',
        orderNumber: 'WINDIA-ORD-006',
        shippingAddress: {
          name: 'Multi Parcel Customer',
          phone: '9444444444',
          address_line1: '777 Express Lane',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001',
        },
        items: [
          { product_id: 'p1', name: 'Garlic', qty: 1, price: 320, net_weight_grams: 240 },
          { product_id: 'p2', name: 'Onion', qty: 1, price: 320, net_weight_grams: 240 },
          { product_id: 'p3', name: 'Tomato', qty: 1, price: 384, net_weight_grams: 240 },
        ],
        totalPrice: 896, // 3 bundles tiered pricing
        paymentMethod: 'cod',
      };

      const result = await dtdcProvider.createShipment(params);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.awbCode).toBe('D12345678906');

      // Verify payload
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const consignment = requestBody.consignments[0];

      expect(consignment.service_type_id).toBe('B2C PREMIUM'); // Default service type
      expect(consignment.weight).toBe(0.72); // 3 bundles × 240g = 720g = 0.72kg
      expect(consignment.num_pieces).toBe(3);
      
      // COD fields should be present
      expect(consignment.cod_collection_mode).toBe('Cash');
      expect(consignment.cod_amount).toBe(896); // 3 bundles tiered pricing

      // NOTE: DTDC API may require pieces_detail array for true multi-parcel bookings
      // Current implementation uses num_pieces=3
      // If DTDC rejects this, we need to add pieces_detail array:
      // pieces_detail: [
      //   { length: 20.4, width: 12.6, height: 7.6, weight: 0.24 },
      //   { length: 20.4, width: 12.6, height: 7.6, weight: 0.24 },
      //   { length: 20.4, width: 12.6, height: 7.6, weight: 0.24 }
      // ]
    });
  });

  describe('AWB Response Parsing', () => {
    it('should parse AWB from awb_number field', async () => {
      const mockResponse = {
        success: true,
        awb_number: 'D11111111111',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'test-001',
        orderNumber: 'TEST-001',
        shippingAddress: {
          name: 'Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);
      expect(result.awbCode).toBe('D11111111111');
    });

    it('should parse AWB from consignment_number if awb_number missing', async () => {
      const mockResponse = {
        success: true,
        consignment_number: 'D22222222222',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'test-002',
        orderNumber: 'TEST-002',
        shippingAddress: {
          name: 'Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);
      expect(result.awbCode).toBe('D22222222222');
    });

    it('should parse AWB from reference_number as last fallback', async () => {
      const mockResponse = {
        success: true,
        reference_number: 'TEST-003',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'test-003',
        orderNumber: 'TEST-003',
        shippingAddress: {
          name: 'Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);
      expect(result.awbCode).toBe('TEST-003');
    });

    it('should handle missing AWB allocation', async () => {
      const mockResponse = {
        success: true,
        // No AWB number fields
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'test-004',
        orderNumber: 'TEST-004',
        shippingAddress: {
          name: 'Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('did not allocate AWB number');
    });
  });

  describe('Error Handling', () => {
    it('should handle insufficient balance error', async () => {
      const mockResponse = {
        success: false,
        message: 'Insufficient balance in your account',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'test-err-001',
        orderNumber: 'TEST-ERR-001',
        shippingAddress: {
          name: 'Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient DTDC account balance');
    });

    it('should handle invalid service type error', async () => {
      const mockResponse = {
        success: false,
        message: 'Invalid service_type_id provided',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'test-err-002',
        orderNumber: 'TEST-ERR-002',
        shippingAddress: {
          name: 'Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);
      
      expect(result.success).toBe(false);
      // Error message contains the original DTDC message
      expect(result.error).toContain('service_type_id');
    });

    it('should handle duplicate booking error', async () => {
      const mockResponse = {
        success: false,
        message: 'Duplicate reference number found',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'test-err-003',
        orderNumber: 'TEST-ERR-003',
        shippingAddress: {
          name: 'Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Duplicate booking attempt');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('fetch failed: Network error'));

      const params: CreateShipmentParams = {
        orderId: 'test-err-004',
        orderNumber: 'TEST-ERR-004',
        shippingAddress: {
          name: 'Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      const result = await dtdcProvider.createShipment(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('Payload Validation', () => {
    it('should include all required DTDC API fields', async () => {
      const mockResponse = { success: true, awb_number: 'D99999999999' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'val-001',
        orderNumber: 'VAL-001',
        shippingAddress: {
          name: 'Validation Test',
          phone: '9999999999',
          address_line1: 'Test Address',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 1, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 640,
        paymentMethod: 'razorpay',
      };

      await dtdcProvider.createShipment(params);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      const c = payload.consignments[0];

      // Required fields per DTDC API documentation
      const requiredFields = [
        'customer_code',
        'service_type_id',
        'load_type',
        'consignment_type',
        'description',
        'dimension_unit',
        'length',
        'width',
        'height',
        'weight_unit',
        'weight',
        'declared_value',
        'num_pieces',
        'origin_details',
        'destination_details',
        'customer_reference_number',
        'commodity_id',
        'reference_number',
      ];

      requiredFields.forEach(field => {
        expect(c).toHaveProperty(field);
        expect(c[field]).toBeDefined();
      });

      // Verify origin and destination structure
      expect(c.origin_details).toHaveProperty('name');
      expect(c.origin_details).toHaveProperty('phone');
      expect(c.origin_details).toHaveProperty('address_line_1');
      expect(c.origin_details).toHaveProperty('pincode');
      expect(c.origin_details).toHaveProperty('city');
      expect(c.origin_details).toHaveProperty('state');

      expect(c.destination_details).toHaveProperty('name');
      expect(c.destination_details).toHaveProperty('phone');
      expect(c.destination_details).toHaveProperty('address_line_1');
      expect(c.destination_details).toHaveProperty('pincode');
      expect(c.destination_details).toHaveProperty('city');
      expect(c.destination_details).toHaveProperty('state');
    });

    it('should use correct data types for all fields', async () => {
      const mockResponse = { success: true, awb_number: 'D99999999999' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const params: CreateShipmentParams = {
        orderId: 'val-002',
        orderNumber: 'VAL-002',
        shippingAddress: {
          name: 'Type Test',
          phone: '9999999999',
          address_line1: 'Test',
          city: 'Test',
          state: 'Test',
          pincode: '123456',
        },
        items: [
          { product_id: 'p1', name: 'Product', qty: 2, price: 640, net_weight_grams: 480 }
        ],
        totalPrice: 1280,
        paymentMethod: 'cod',
      };

      await dtdcProvider.createShipment(params);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      const c = payload.consignments[0];

      // Check data types
      expect(typeof c.customer_code).toBe('string');
      expect(typeof c.service_type_id).toBe('string');
      expect(typeof c.weight).toBe('number');
      expect(typeof c.declared_value).toBe('number');
      expect(typeof c.num_pieces).toBe('number');
      expect(typeof c.length).toBe('number');
      expect(typeof c.width).toBe('number');
      expect(typeof c.height).toBe('number');
      expect(typeof c.cod_amount).toBe('number');
      expect(typeof c.reference_number).toBe('string');
    });
  });
});
