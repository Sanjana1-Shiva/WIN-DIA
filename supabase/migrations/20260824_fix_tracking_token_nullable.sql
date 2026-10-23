-- Make tracking_token nullable in orders table
-- tracking_token is only generated after order placement, should not be required

ALTER TABLE orders 
ALTER COLUMN tracking_token DROP NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN orders.tracking_token IS 'Public tracking token for customers to track their order without login. Generated after order creation.';
