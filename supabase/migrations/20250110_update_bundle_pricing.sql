-- =====================================================
-- WIN-DIA Bundle Pricing Update
-- =====================================================
-- Changes bundle structure from 12-packet to 6-packet bundles
-- New pricing structure:
--   1 bundle (6 packets): ₹384 (no discount)
--   2 bundles (12 packets): ₹640 (2 packets free)
--   3 bundles (18 packets): ₹896 (4 packets free)

-- Drop the old pricing function
DROP FUNCTION IF EXISTS calculate_windia_price(integer);

-- Create new pricing function
CREATE OR REPLACE FUNCTION calculate_windia_price(bundle_count integer)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base_packet_price numeric := 64; -- ₹64 per packet
  total_price numeric;
BEGIN
  -- Validate input
  IF bundle_count IS NULL OR bundle_count < 1 THEN
    RAISE EXCEPTION 'bundle_count must be at least 1';
  END IF;

  -- Calculate price based on bundle count with tier discounts
  CASE 
    -- 1 bundle: 6 packets × ₹64 = ₹384 (no discount)
    WHEN bundle_count = 1 THEN
      total_price := base_packet_price * 6;
    
    -- 2 bundles: 12 packets, pay for 10 = ₹640
    WHEN bundle_count = 2 THEN
      total_price := base_packet_price * 10;
    
    -- 3 bundles: 18 packets, pay for 14 = ₹896
    WHEN bundle_count = 3 THEN
      total_price := base_packet_price * 14;
    
    -- 4+ bundles: Proportional pricing based on 3-bundle rate
    -- For every 3 bundles, customer pays for 14 packets
    ELSE
      DECLARE
        complete_sets integer := bundle_count / 3;
        remaining_bundles integer := bundle_count % 3;
        complete_set_price numeric := base_packet_price * 14; -- Price for 3 bundles
        remaining_price numeric;
      BEGIN
        -- Calculate remaining bundles price
        IF remaining_bundles = 1 THEN
          remaining_price := base_packet_price * 6;
        ELSIF remaining_bundles = 2 THEN
          remaining_price := base_packet_price * 10;
        ELSE
          remaining_price := 0;
        END IF;
        
        total_price := (complete_sets * complete_set_price) + remaining_price;
      END;
  END CASE;

  RETURN total_price;
END;
$$;

-- Add comment
COMMENT ON FUNCTION calculate_windia_price(integer) IS 
'Calculates WIN-DIA bundle pricing with tier discounts. 
1 bundle = 6 packets at ₹384, 2 bundles = ₹640, 3 bundles = ₹896.
Each packet is 40g at base price ₹64.';

-- Test the function
DO $$
BEGIN
  -- Test cases
  ASSERT calculate_windia_price(1) = 384, '1 bundle should be ₹384';
  ASSERT calculate_windia_price(2) = 640, '2 bundles should be ₹640';
  ASSERT calculate_windia_price(3) = 896, '3 bundles should be ₹896';
  ASSERT calculate_windia_price(4) = 1280, '4 bundles should be ₹1,280';
  ASSERT calculate_windia_price(6) = 1792, '6 bundles should be ₹1,792';
  
  RAISE NOTICE 'All pricing tests passed!';
END $$;
