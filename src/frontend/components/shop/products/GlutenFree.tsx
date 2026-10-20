"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";

import { glutenFreeProducts, everydayProducts } from "@/src/frontend/data/products";
import { addToCart } from "@/src/frontend/redux/slices/cartSlice";
import { addToWishlist, removeFromWishlist } from "@/src/frontend/redux/slices/wishlistSlice";
import { supabase } from "@/src/frontend/lib/supabase/client";

import { ProductCard } from "./ProductCard";
import { ComboSelector } from "./ComboSelector";
import { toStoreProduct, type Product, type ProductTheme } from "./productShared";

import styles from "./GlutenFree.module.scss";

type ProductRangeProps = {
  readonly heading: string;
  readonly headingId: string;
  readonly products: readonly Product[];
  readonly theme: ProductTheme;
};

/**
 * ProductRange component displays a section of products.
 * Each product is a 12-pack bundle (12 × 40g = 480g) priced at ₹640.
 *
 * Clicking a card takes you to /product/[id] page.
 * Adding to cart/wishlist requires a logged-in Supabase session.
 */
export function ProductRange({ heading, headingId, products, theme }: ProductRangeProps) {
  const dispatch = useDispatch();
  const router = useRouter();
  const wishlistItems = useSelector((s: any) => s.wishlist.wishlistItems);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.id, 0]))
  );
  
  // Combo selector state
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [selectedComboProduct, setSelectedComboProduct] = useState<Product | null>(null);
  
  // Create a Set of wishlisted IDs from Redux store for efficient lookup
  const wishlistedIds = useMemo(() => 
    new Set(wishlistItems.map((item: any) => item.id || item._id)),
    [wishlistItems]
  );

  // Available flavors for combo selector (hardcoded for now, should come from DB)
  const availableFlavors = useMemo(() => [
    { id: "jeera", name: "Jeera", available: true, stock: 100 },
    { id: "garlic", name: "Garlic", available: true, stock: 100 },
    { id: "onion", name: "Onion", available: true, stock: 100 },
    { id: "curry-leaf", name: "Curry Leaves", available: true, stock: 100 },
  ], []);

  const requireAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login?next=/shop");
      return false;
    }
    return true;
  };

  const setQuantity = async (product: Product, next: number) => {
    // Check if this is a combo product
    const isCombo = theme === "combo" || product.id === "assorted-combo";
    
    if (isCombo && next > 0) {
      // Open combo selector modal instead of directly adding to cart
      if (!(await requireAuth())) return;
      setSelectedComboProduct(product);
      setComboModalOpen(true);
      return;
    }

    // Regular product logic
    const nextQuantity = Math.max(0, next);
    const current = quantities[product.id] ?? 0;
    if (nextQuantity > current) {
      if (!(await requireAuth())) return;
      dispatch(addToCart(toStoreProduct(product, theme), nextQuantity - current));
      toast.success("Added to cart");
    }
    setQuantities((q) => ({ ...q, [product.id]: nextQuantity }));
  };

  const handleComboConfirm = (selections: Record<string, number>) => {
    if (!selectedComboProduct) return;

    // Create combo product with selections
    const comboData = {
      ...toStoreProduct(selectedComboProduct, theme),
      comboSelections: selections,
      // Add flavor breakdown to display name
      flavorBreakdown: Object.entries(selections)
        .filter(([_, count]) => count > 0)
        .map(([flavorId, count]) => {
          const flavor = availableFlavors.find(f => f.id === flavorId);
          return `${flavor?.name} x${count}`;
        })
        .join(", "),
    };

    dispatch(addToCart(comboData, 1));
    toast.success("Combo added to cart with your custom selection!");
    setComboModalOpen(false);
    setSelectedComboProduct(null);
  };

  const toggleWishlist = async (product: Product) => {
    const storeProduct = toStoreProduct(product, theme);
    const isCurrentlyWishlisted = wishlistedIds.has(storeProduct.id);
    
    if (!isCurrentlyWishlisted && !(await requireAuth())) return;
    
    if (!isCurrentlyWishlisted) {
      dispatch(addToWishlist(storeProduct));
      toast.success("Saved to wishlist");
    } else {
      dispatch(removeFromWishlist(storeProduct.id));
      toast("Removed from wishlist");
    }
  };

  return (
    <section className={styles.section} aria-labelledby={headingId} data-navbar-theme={theme}>
      <div className={styles.headingArea}>
        <h2 id={headingId} className={styles.heading}>{heading}</h2>
      </div>

      <ul className={styles.grid}>
        {products.map((product) => {
          const storeProductId = toStoreProduct(product, theme).id;
          return (
            <ProductCard
              key={product.id}
              product={product}
              theme={theme}
              quantity={quantities[product.id] ?? 0}
              isWishlisted={wishlistedIds.has(storeProductId)}
              onQuantityChange={(q) => setQuantity(product, q)}
              onToggleWishlist={() => toggleWishlist(product)}
            />
          );
        })}
      </ul>

      {/* Combo Selector Modal */}
      <ComboSelector
        isOpen={comboModalOpen}
        onClose={() => {
          setComboModalOpen(false);
          setSelectedComboProduct(null);
        }}
        onConfirm={handleComboConfirm}
        availableFlavors={availableFlavors}
      />
    </section>
  );
}

// Combine all products for fallback
const allProducts = [...glutenFreeProducts, ...everydayProducts];

type GlutenFreeProps = {
  readonly products?: readonly Product[];
};

/** Product range component — falls back to all static products if no products provided. */
export function GlutenFree({ products }: GlutenFreeProps) {
  return (
    <ProductRange
      heading="Our Products"
      headingId="products-heading"
      products={products ?? allProducts}
      theme="everyday"
    />
  );
}