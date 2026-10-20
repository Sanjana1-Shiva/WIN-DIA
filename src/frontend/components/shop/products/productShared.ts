import type { StaticImageData } from "next/image";

/**
 * The shape of a single product.
 *
 * `image` supports:
 * - One locally imported Next.js image
 * - One normal URL string
 * - Multiple images for products with front/back images
 */
export type Product = {
  readonly id: string;
  readonly title: string;
  readonly name: string;
  readonly flavour: string;

  readonly image:
    | StaticImageData
    | string
    | readonly (StaticImageData | string)[];

  readonly description: string;
  readonly price: string;

  readonly offer?: string;
  readonly offerDetails?: string;
  readonly delivery?: string;
  readonly rating?: string;
  readonly reviews?: string;
  readonly reviewList?: readonly string[];
};

/**
 * Product collection/theme.
 */
export type ProductTheme =
  | "gluten-free"
  | "everyday"
  | "combo";

/**
 * Builds the ID used in the product URL and React key.
 *
 * Example:
 * "everyday" + "garlic"
 * → "everyday-garlic"
 */
export function toRouteId(
  theme: ProductTheme,
  product: Pick<Product, "id">
) {
  return `${theme}-${product.id}`;
}

/**
 * Converts a Product into the format expected by
 * the Redux cart and wishlist.
 *
 * The product can have:
 *
 * image: garlicImage
 *
 * OR
 *
 * image: [garlicImage, garlicBackImage]
 *
 * OR
 *
 * image: "https://example.com/image.png"
 *
 * Redux receives a single image URL.
 */
export function toStoreProduct(
  product: Product,
  theme: ProductTheme
) {
  // For combo products, use the UUID directly (backend expects this)
  const isComboProduct = product.id === '9d17cedd-4abd-4765-af1e-f368d17bad32' || 
                          theme === 'combo';
  const id = isComboProduct ? product.id : toRouteId(theme, product);

  let image: string;

  // Case 1: image is a normal URL string
  if (typeof product.image === "string") {
    image = product.image;
  }

  // Case 2: image is a single imported Next.js image
  else if ("src" in product.image) {
    image = product.image.src;
  }

  // Case 3: image is an array of images
  else {
    const firstImage = product.image[0];

    if (typeof firstImage === "string") {
      image = firstImage;
    } else {
      image = firstImage.src;
    }
  }

  const storeProduct: any = {
    id,
    _id: id,
    slug: id,
    name: product.name,
    category: theme,
    flavor: product.flavour,
    description: product.description,

    // Convert "₹640" → 640
    price: Number(
      product.price.replace(/[^0-9.]/g, "")
    ),

    image,

    countInStock: 100,
    netWeight: (product as any).netWeight || 200, // Use product-specific netWeight if available
  };

  // Preserve the real database UUID if available (from API products)
  if ((product as any).dbId) {
    storeProduct.dbId = (product as any).dbId;
    storeProduct.productId = (product as any).dbId;
    storeProduct.product_id = (product as any).dbId;
  }

  return storeProduct;
}