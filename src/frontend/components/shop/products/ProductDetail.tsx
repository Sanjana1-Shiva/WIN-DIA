"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useMemo, type TouchEvent } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";

import { addToCart } from "@/src/frontend/redux/slices/cartSlice";
import {
  addToWishlist,
  removeFromWishlist,
} from "@/src/frontend/redux/slices/wishlistSlice";
import { supabase } from "@/src/frontend/lib/supabase/client";

import { ProductCard } from "./ProductCard";
import {
  findProductByRouteId,
  getRecommendations,
} from "./productLookup";
import {
  toStoreProduct,
  type Product,
  type ProductTheme,
} from "./productShared";
import { ComboSelector } from "./ComboSelector";

import styles from "./ProductDetail.module.scss";

type ProductDetailProps = {
  /** The route id from the URL, e.g. "everyday-oat-thins". */
  readonly routeId: string;
};

export function ProductDetail({ routeId }: ProductDetailProps) {
  const match = findProductByRouteId(routeId);

  if (!match) {
    return (
      <section className={styles.section}>
        <div className={styles.notFound}>
          <p className={styles.infoEyebrow}>Windia Thins</p>

          <h1 className={styles.infoName}>
            We couldn&apos;t find that product
          </h1>

          <p className={styles.description}>
            It may have been renamed or removed.
          </p>

          <Link className={styles.backLink} href="/">
            Back to shop
          </Link>
        </div>
      </section>
    );
  }

  return (
    <ProductDetailContent
      product={match.product}
      theme={match.theme}
      routeId={routeId}
    />
  );
}

function ProductDetailContent({
  product,
  theme,
  routeId,
}: {
  product: Product;
  theme: ProductTheme;
  routeId: string;
}) {
  const dispatch = useDispatch();
  const router = useRouter();
  const wishlistItems = useSelector((s: any) => s.wishlist.wishlistItems);

  /* -----------------------------
     Main product state
  ----------------------------- */

  const [quantity, setQuantityState] = useState(0);
  
  const storeProduct = useMemo(() => toStoreProduct(product, theme), [product, theme]);
  const isWishlisted = useMemo(() => 
    wishlistItems.some((item: any) => (item.id || item._id) === storeProduct.id),
    [wishlistItems, storeProduct.id]
  );

  /* -----------------------------
     Combo Selector (for combo products)
  ----------------------------- */
  const isComboProduct = product.name?.toLowerCase().includes('combo') || 
                          product.name?.toLowerCase().includes('assorted');
  
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);

  // Define available flavors for combo
  const comboFlavors = [
    { id: 'curry-leaves', name: 'Curry Leaves', available: true, stock: 100 },
    { id: 'garlic', name: 'Garlic', available: true, stock: 100 },
    { id: 'jeera', name: 'Jeera', available: true, stock: 100 },
    { id: 'onion', name: 'Onion', available: true, stock: 100 },
  ];

  const handleComboConfirm = async (selections: Record<string, number>) => {
    if (!(await requireAuth())) return;

    // Add combo with user's flavor selections
    const comboProduct = {
      ...storeProduct,
      flavorSelections: selections,
      customNote: `Combo: ${Object.entries(selections)
        .filter(([_, count]) => count > 0)
        .map(([id, count]) => {
          const flavor = comboFlavors.find(f => f.id === id);
          return `${flavor?.name} (${count})`;
        })
        .join(', ')}`
    };

    dispatch(addToCart(comboProduct, 1));
    toast.success("Combo added to cart with your flavor selection!");
    setQuantity(quantity + 1);
  };

  /* -----------------------------
     Product image carousel
  ----------------------------- */

  const detailImages = Array.isArray(product.image)
    ? product.image
    : [product.image];

  const [detailImageIndex, setDetailImageIndex] = useState(0);

  const touchStartX = useRef<number | null>(null);

  const nextDetailImage = () => {
    setDetailImageIndex((current) =>
      current === detailImages.length - 1 ? 0 : current + 1
    );
  };

  const previousDetailImage = () => {
    setDetailImageIndex((current) =>
      current === 0 ? detailImages.length - 1 : current - 1
    );
  };

  const handleDetailTouchStart = (
    event: TouchEvent<HTMLDivElement>
  ) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleDetailTouchEnd = (
    event: TouchEvent<HTMLDivElement>
  ) => {
    if (touchStartX.current === null) return;

    const touchEndX = event.changedTouches[0].clientX;

    const difference =
      touchStartX.current - touchEndX;

    if (Math.abs(difference) > 50) {
      if (difference > 0) {
        nextDetailImage();
      } else {
        previousDetailImage();
      }
    }

    touchStartX.current = null;
  };

  /* -----------------------------
     Recommendations state
  ----------------------------- */

  const [recQuantities, setRecQuantities] =
    useState<Record<string, number>>({});

  const recWishlistedIds = useMemo(() => 
    new Set(wishlistItems.map((item: any) => item.id || item._id)),
    [wishlistItems]
  );

  /* -----------------------------
     Authentication
  ----------------------------- */

  const requireAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=/product/${routeId}`);
      return false;
    }

    return true;
  };

  /* -----------------------------
     Main product quantity
  ----------------------------- */

  const setQuantity = async (next: number) => {
    const nextQuantity = Math.max(0, next);

    if (nextQuantity > quantity) {
      if (!(await requireAuth())) return;

      dispatch(
        addToCart(
          toStoreProduct(product, theme),
          nextQuantity - quantity
        )
      );

      toast.success("Added to cart");
    }

    setQuantityState(nextQuantity);
  };

  /* -----------------------------
     Main product wishlist
  ----------------------------- */

  const toggleWishlist = async () => {
    const next = !isWishlisted;

    if (next && !(await requireAuth())) return;

    if (next) {
      dispatch(addToWishlist(storeProduct));
      toast.success("Saved to wishlist");
    } else {
      dispatch(removeFromWishlist(storeProduct.id));
      toast("Removed from wishlist");
    }
  };

  /* -----------------------------
     Buy Now
  ----------------------------- */

  const buyNow = async () => {
    if (!(await requireAuth())) return;

    dispatch(
      addToCart(
        toStoreProduct(product, theme),
        1
      )
    );

    toast.success("Added to cart");

    router.push("/checkout");
  };

  /* -----------------------------
     Recommendations
  ----------------------------- */

  const recommendations = getRecommendations(
    routeId,
    theme,
    4
  );

  /* -----------------------------
     Recommendation quantity
  ----------------------------- */

  const setRecQuantity = async (
    recRouteId: string,
    recProduct: Product,
    recTheme: ProductTheme,
    next: number
  ) => {
    const nextQuantity = Math.max(0, next);

    const current =
      recQuantities[recRouteId] ?? 0;

    if (nextQuantity > current) {
      if (!(await requireAuth())) return;

      dispatch(
        addToCart(
          toStoreProduct(recProduct, recTheme),
          nextQuantity - current
        )
      );

      toast.success("Added to cart");
    }

    setRecQuantities((q) => ({
      ...q,
      [recRouteId]: nextQuantity,
    }));
  };

  /* -----------------------------
     Recommendation wishlist
  ----------------------------- */

  const toggleRecWishlist = async (
    recRouteId: string,
    recProduct: Product,
    recTheme: ProductTheme
  ) => {
    const storeProduct = toStoreProduct(recProduct, recTheme);
    const next = !recWishlistedIds.has(storeProduct.id);

    if (next && !(await requireAuth())) return;

    if (next) {
      dispatch(addToWishlist(storeProduct));
      toast.success("Saved to wishlist");
    } else {
      dispatch(
        removeFromWishlist(storeProduct.id)
      );

      toast("Removed from wishlist");
    }
  };

  /* -----------------------------
     Page
  ----------------------------- */

  return (
    <section
      className={styles.section}
      data-navbar-theme={theme}
    >
      <div className={styles.detail}>

        {/* =========================
    PRODUCT IMAGE GALLERY
========================= */}

<div
  className={styles.detailImage}
  onTouchStart={handleDetailTouchStart}
  onTouchEnd={handleDetailTouchEnd}
>
  {/* Bundle badge */}
  <div className={styles.bundleBadge}>
    6-PACKET BUNDLE
  </div>

  {/* Wishlist heart */}
  <button
    type="button"
    className={styles.imageWishlist}
    onClick={toggleWishlist}
    aria-label="Add to wishlist"
  >
    {isWishlisted ? "♥" : "♡"}
  </button>

  {/* Product image */}
  <Image
    src={detailImages[detailImageIndex]}
    alt={`Windia Thins ${product.name} - Image ${
      detailImageIndex + 1
    }`}
    fill
    className={styles.detailProductImage}
    sizes="(max-width: 768px) 100vw, 45vw"
    priority={detailImageIndex === 0}
  />

  {/* Previous */}
  {detailImages.length > 1 && (
    <button
      type="button"
      className={`${styles.detailArrow} ${styles.detailPrevButton}`}
      onClick={previousDetailImage}
      aria-label="Previous product image"
    >
      ‹
    </button>
  )}

  {/* Next */}
  {detailImages.length > 1 && (
    <button
      type="button"
      className={`${styles.detailArrow} ${styles.detailNextButton}`}
      onClick={nextDetailImage}
      aria-label="Next product image"
    >
      ›
    </button>
  )}

  {/* Dots */}
  {detailImages.length > 1 && (
    <div className={styles.detailImageDots}>
      {detailImages.map((_, index) => (
        <button
          key={index}
          type="button"
          className={`${styles.detailImageDot} ${
            index === detailImageIndex
              ? styles.detailImageDotActive
              : ""
          }`}
          onClick={() => setDetailImageIndex(index)}
          aria-label={`Show product image ${index + 1}`}
        />
      ))}
    </div>
  )}
</div>

        {/* =========================
            PRODUCT INFORMATION
        ========================= */}

        <div className={styles.detailContent}>

          {/* Product eyebrow */}

          <p className={styles.infoEyebrow}>
            {product.title}
          </p>

          {/* Product name */}

          <h1 className={styles.infoName}>
            {product.name}
          </h1>

          {/* Description */}

          <p className={styles.description}>
            {product.description}
          </p>

          {/* Price */}

          <p className={styles.price}>
            {product.price}
          </p>

          {/* Offer */}

          {product.offer && (
            <p className={styles.offer}>
              {product.offer}
            </p>
          )}

          {/* Offer details */}

          {product.offerDetails && (
            <p className={styles.offerDetails}>
              {product.offerDetails}
            </p>
          )}

          {/* Delivery */}

          {product.delivery && (
            <p className={styles.delivery}>
              {product.delivery}
            </p>
          )}

          {/* Quantity controls */}

          <div className={styles.quantity}>
            <button
              type="button"
              onClick={() =>
                setQuantity(quantity - 1)
              }
              disabled={quantity === 0}
              aria-label="Decrease quantity"
            >
              −
            </button>

            <span>{quantity}</span>

            <button
              type="button"
              onClick={() =>
                setQuantity(quantity + 1)
              }
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Add to cart */}

          <button
            type="button"
            onClick={() => {
              if (isComboProduct) {
                setIsComboModalOpen(true);
              } else {
                setQuantity(quantity + 1);
              }
            }}
            className={styles.addToCart}
          >
            {isComboProduct ? 'Customize Combo' : 'Add to Cart'}
          </button>

          {/* Buy now */}

          <button
            type="button"
            onClick={() => {
              if (isComboProduct) {
                setIsComboModalOpen(true);
              } else {
                buyNow();
              }
            }}
            className={styles.buyNow}
          >
            Buy Now
          </button>

         
        </div>
      </div>

      {/* =========================
          RECOMMENDATIONS
      ========================= */}

      {recommendations.length > 0 && (
        <div
          className={styles.recommendations}
        >
          <h2
            className={
              styles.recommendationsHeading
            }
          >
            You might also like
          </h2>

          <ul
            className={
              styles.recommendationsGrid
            }
          >
            {recommendations.map(
              ({
                product: recProduct,
                theme: recTheme,
                routeId: recRouteId,
              }) => (
                <ProductCard
                  key={recRouteId}
                  product={recProduct}
                  theme={recTheme}
                  quantity={
                    recQuantities[
                      recRouteId
                    ] ?? 0
                  }
                  isWishlisted={
                    recWishlistedIds.has(
                      toStoreProduct(recProduct, recTheme).id
                    )
                  }
                  onQuantityChange={(q) =>
                    setRecQuantity(
                      recRouteId,
                      recProduct,
                      recTheme,
                      q
                    )
                  }
                  onToggleWishlist={() =>
                    toggleRecWishlist(
                      recRouteId,
                      recProduct,
                      recTheme
                    )
                  }
                />
              )
            )}
          </ul>
        </div>
      )}

      {/* Combo Selector Modal */}
      {isComboProduct && (
        <ComboSelector
          isOpen={isComboModalOpen}
          onClose={() => setIsComboModalOpen(false)}
          onConfirm={handleComboConfirm}
          availableFlavors={comboFlavors}
        />
      )}
    </section>
  );
}

