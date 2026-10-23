-- Atomic checkout RPC for the live WIN-DIA schema.
-- The deployed database uses order_status/items_price and shipments.provider.

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
BEGIN
    INSERT INTO public.orders (
        order_number, user_id, order_status, payment_status, payment_method,
        items_price, discount_price, tax_price, shipping_price, total_price,
        shipping_address, order_notes
    ) VALUES (
        COALESCE(p_order_data->>'order_number', 'WIN-' || floor(extract(epoch from now()) * 1000)::text),
        p_user_id,
        COALESCE(p_order_data->>'order_status', 'placed'),
        COALESCE(p_order_data->>'payment_status', 'pending'),
        COALESCE(p_order_data->>'payment_method', 'razorpay'),
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

    IF COALESCE(p_payment_data->>'payment_method', 'razorpay') = 'cod' THEN
        INSERT INTO public.payments (
            order_id, payment_provider, transaction_id, provider_order_id,
            amount, currency, status, payment_method, raw_response
        ) VALUES (
            v_order.id, 'cod', NULL, NULL,
            COALESCE((p_payment_data->>'amount')::NUMERIC, 0),
            COALESCE(p_payment_data->>'currency', 'INR'), 'pending', 'cod', '{}'::JSONB
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
