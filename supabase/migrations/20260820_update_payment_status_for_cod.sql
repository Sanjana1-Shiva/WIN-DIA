-- Update checkout RPC to set correct payment status for COD orders
-- COD orders should start with 'cod_pending' instead of 'pending'

CREATE OR REPLACE FUNCTION public.create_checkout_order_transaction(
    p_user_id UUID,
    p_order_data JSONB,
    p_order_items JSONB,
    p_payment_data JSONB,
    p_shipment_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_payment public.payments%ROWTYPE;
    v_shipment public.shipments%ROWTYPE;
    v_item JSONB;
    v_payment_method TEXT;
    v_payment_status TEXT;
BEGIN
    v_payment_method := COALESCE(p_order_data->>'payment_method', 'razorpay');
    
    -- Set appropriate initial payment status based on payment method
    IF v_payment_method = 'cod' THEN
        v_payment_status := 'cod_pending';
    ELSE
        v_payment_status := 'pending';
    END IF;

    INSERT INTO public.orders (
        order_number, user_id, order_status, payment_status, payment_method,
        items_price, discount_price, tax_price, shipping_price, total_price,
        shipping_address, order_notes
    ) VALUES (
        COALESCE(p_order_data->>'order_number', 'WIN-' || floor(extract(epoch from now()) * 1000)::text),
        p_user_id,
        COALESCE(p_order_data->>'order_status', 'placed'),
        v_payment_status,
        v_payment_method,
        COALESCE((p_order_data->>'items_price')::NUMERIC, 0),
        COALESCE((p_order_data->>'discount_price')::NUMERIC, 0),
        COALESCE((p_order_data->>'tax_price')::NUMERIC, 0),
        COALESCE((p_order_data->>'shipping_price')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_price')::NUMERIC, 0),
        COALESCE(p_order_data->'shipping_address', '{}'::JSONB),
        p_order_data->>'order_notes'
    ) RETURNING * INTO v_order;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        INSERT INTO public.order_items (
            order_id, product_id, name, price, qty, flavor, net_weight_grams, image
        ) VALUES (
            v_order.id,
            (v_item->>'product_id')::UUID,
            v_item->>'name',
            COALESCE((v_item->>'price')::NUMERIC, 0),
            COALESCE((v_item->>'qty')::INTEGER, 1),
            v_item->>'flavor',
            (v_item->>'net_weight_grams')::NUMERIC,
            v_item->>'image'
        );
    END LOOP;

    INSERT INTO public.shipments (order_id, provider, courier_name, status)
    VALUES (
        v_order.id,
        'shiprocket',
        COALESCE(p_shipment_data->>'courier_name', 'Shiprocket'),
        COALESCE(p_shipment_data->>'status', 'created')
    ) RETURNING * INTO v_shipment;

    IF v_payment_method = 'cod' THEN
        INSERT INTO public.payments (
            order_id, payment_provider, transaction_id, provider_order_id,
            amount, currency, status, payment_method, raw_response
        ) VALUES (
            v_order.id, 'cod', NULL, NULL,
            COALESCE((p_payment_data->>'amount')::NUMERIC, 0),
            COALESCE(p_payment_data->>'currency', 'INR'), 'cod_pending', 'cod', '{}'::JSONB
        ) RETURNING * INTO v_payment;
    END IF;

    RETURN jsonb_build_object(
        'order', row_to_json(v_order)::JSONB,
        'payment', CASE WHEN v_payment.id IS NULL THEN NULL ELSE row_to_json(v_payment)::JSONB END,
        'shipment', row_to_json(v_shipment)::JSONB,
        'order_id', v_order.id,
        'order_number', v_order.order_number
    );
END;
$$;

-- Update existing orders to use new status values
-- Update COD orders that are still pending
UPDATE public.orders
SET payment_status = 'cod_pending'
WHERE payment_method = 'cod' 
  AND payment_status = 'pending'
  AND order_status NOT IN ('cancelled', 'delivered');

-- Update payments table for COD orders
UPDATE public.payments
SET status = 'cod_pending'
WHERE payment_method = 'cod' 
  AND status = 'pending'
  AND order_id IN (
    SELECT id FROM public.orders 
    WHERE order_status NOT IN ('cancelled', 'delivered')
  );

-- Add comment
COMMENT ON FUNCTION public.create_checkout_order_transaction IS 
'Atomic checkout transaction that creates order, order items, payment, and shipment records. 
Updated to set payment_status to cod_pending for COD orders instead of generic pending.';
