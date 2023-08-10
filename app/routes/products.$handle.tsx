import {Suspense} from 'react';
import type {V2_MetaFunction} from '@shopify/remix-oxygen';
import {defer, redirect, type LoaderArgs} from '@shopify/remix-oxygen';
import type {FetcherWithComponents} from '@remix-run/react';
import {Await, Link, useLoaderData} from '@remix-run/react';
import type {
  ProductFragment,
  ProductVariantsQuery,
  ProductVariantFragment,
} from 'storefrontapi.generated';
import { Button, buttonVariants } from '~/components/ui/button'
import {
  Image,
  Money,
  VariantSelector,
  type VariantOption,
  getSelectedProductOptions,
  CartForm,
} from '@shopify/hydrogen';
import type {CartLineInput} from '@shopify/hydrogen/storefront-api-types';
import {getVariantUrl} from '~/utils';
import { Icon } from '@iconify/react';
import { Badge, BadgeProps } from '~/components/ui/badge';

export const meta: V2_MetaFunction = ({data}) => {
  return [{title: `Hydrogen | ${data.product.title}`}];
};

export async function loader({params, request, context}: LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  const selectedOptions = getSelectedProductOptions(request).filter(
    (option) =>
      // Filter out Shopify predictive search query params
      !option.name.startsWith('_sid') &&
      !option.name.startsWith('_pos') &&
      !option.name.startsWith('_psq') &&
      !option.name.startsWith('_ss') &&
      !option.name.startsWith('_v'),
  );

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  // await the query for the critical product data
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle, selectedOptions},
  });

  // In order to show which variants are available in the UI, we need to query
  // all of them. But there might be a *lot*, so instead separate the variants
  // into it's own separate query that is deferred. So there's a brief moment
  // where variant options might show as available when they're not, but after
  // this deferred query resolves, the UI will update.
  const variants = storefront.query(VARIANTS_QUERY, {
    variables: {handle},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  const firstVariant = product.variants.nodes[0];
  const firstVariantIsDefault = Boolean(
    firstVariant.selectedOptions.find(
      (option) => option.name === 'Title' && option.value === 'Default Title',
    ),
  );

  if (firstVariantIsDefault) {
    product.selectedVariant = firstVariant;
  } else {
    // if no selected variant was returned from the selected options,
    // we redirect to the first variant's url with it's selected options applied
    if (!product.selectedVariant) {
      return redirectToFirstVariant({product, request});
    }
  }
  return defer({product, variants});
}

function redirectToFirstVariant({
  product,
  request,
}: {
  product: ProductFragment;
  request: Request;
}) {
  const url = new URL(request.url);
  const firstVariant = product.variants.nodes[0];

  throw redirect(
    getVariantUrl({
      pathname: url.pathname,
      handle: product.handle,
      selectedOptions: firstVariant.selectedOptions,
      searchParams: new URLSearchParams(url.search),
    }),
    {
      status: 302,
    },
  );
}

export default function Product() {
  const {product, variants} = useLoaderData<typeof loader>();
  const {selectedVariant} = product;
  return (
    <div className="container grid items-start p-4 mx-auto md:gap-16 md:grid-cols-2">
      <ProductImage image={selectedVariant?.image} />
      <ProductMain
        selectedVariant={selectedVariant}
        product={product}
        variants={variants}
      />
    </div>
  );
}

function ProductImage({image}: {image: ProductVariantFragment['image']}) {
  if (!image) {
    return <div className="product-image" />;
  }
  return (
    <div>
      <Image
        alt={image.altText || 'Product Image'}
        data={image}
        key={image.id}
        sizes="(min-width: 45em) 50vw, 100vw"
        className="object-cover w-full h-full"
      />
    </div>
  );
}

function ProductMain({
  selectedVariant,
  product,
  variants,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedVariant'];
  variants: Promise<ProductVariantsQuery>;
}) {
  const {title, descriptionHtml} = product;
  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-2">
        <ProductBadges selectedVariant={selectedVariant} />
        <h1>{title}</h1>
        <ProductPrice selectedVariant={selectedVariant} />
      </div>
      <Suspense
        fallback={
          <ProductForm
            product={product}
            selectedVariant={selectedVariant}
            variants={[]}
          />
        }
      >
        <Await
          errorElement="There was a problem loading product variants"
          resolve={variants}
        >
          {(data) => (
            <ProductForm
              product={product}
              selectedVariant={selectedVariant}
              variants={data.product?.variants.nodes || []}
            />
          )}
        </Await>
      </Suspense>
      <div className="prose-sm prose-neutral prose-invert" dangerouslySetInnerHTML={{__html: descriptionHtml}} />
    </div>
  );
}

function ProductBadges({
  selectedVariant
}: {
  selectedVariant?: ProductVariantFragment | null}
) {
  const badges: {
    label: string;
    variant: BadgeProps['variant'];
  }[] = []

  if (selectedVariant?.compareAtPrice) {
    badges.push({ label: 'Sale', variant: 'destructive' })
  }
  if (!selectedVariant?.availableForSale) {
    badges.push({ label: 'Sold out', variant: 'outline' })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map(({ label, variant }) => (
        <Badge key={label} variant={variant}>
          {label}
        </Badge>
      ))}
    </div>
  )
}

function ProductPrice({
  selectedVariant,
}: {
  selectedVariant: ProductFragment['selectedVariant'];
}) {
  return (
    <div className="product-price">
      {selectedVariant?.compareAtPrice ? (
        <div className="flex items-center gap-2">
          {selectedVariant ? <Money data={selectedVariant.price} /> : null}
          <span className="line-through text-muted-foreground">
            <Money data={selectedVariant.compareAtPrice} />
          </span>
        </div>
      ) : (
        selectedVariant?.price && <Money data={selectedVariant?.price} />
      )}
    </div>
  );
}

function ProductForm({
  product,
  selectedVariant,
  variants,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedVariant'];
  variants: Array<ProductVariantFragment>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <VariantSelector
        handle={product.handle}
        options={product.options}
        variants={variants}
      >
        {({option}) => <ProductOptions key={option.name} option={option} />}
      </VariantSelector>
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant.id,
                  quantity: 1,
                },
              ]
            : []
        }
      >
        {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}

function ProductOptions({option}: {option: VariantOption}) {
  return (
    <div className="flex flex-col gap-2" key={option.name}>
      <h5 className="flex items-center gap-1">
        {option.name}
        {option.values.find((value) => value.isActive) && (
          <Badge variant="outline">
            {option.values.find((value) => value.isActive)?.value}
          </Badge>
        )}
      </h5>
      <div className="flex flex-wrap gap-3">
        {option.values.map(({value, isAvailable, isActive, to}) => {
          return (
            <Link
              aria-disabled={!isAvailable}
              className={`
                ${isActive ? buttonVariants({ variant: "secondary" }) : buttonVariants({ variant: "outline" })}
              `}
              key={option.name + value}
              prefetch="intent"
              preventScrollReset
              replace
              to={to}
            >
              {isActive && (
                <Icon icon="lucide:check" className="w-4 h-4 mr-2" />
              )}
              {value}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: CartLineInput[];
  onClick?: () => void;
}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <Button
            type="submit"
            onClick={onClick}
            disabled={disabled || fetcher.state !== 'idle'}
            size="lg"
          >
            {fetcher.state !== 'idle'
              ? (<Icon icon="lucide:loader-2" className="w-4 h-4 mr-2 animate-spin" />)
              : (<Icon icon="lucide:plus" className="w-4 h-4 mr-2" />)
            }
            {children}
          </Button>
        </>
      )}
    </CartForm>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    quantityAvailable
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    options {
      name
      values
    }
    selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    variants(first: 1) {
      nodes {
        ...ProductVariant
      }
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const PRODUCT_VARIANTS_FRAGMENT = `#graphql
  fragment ProductVariants on Product {
    variants(first: 250) {
      nodes {
        ...ProductVariant
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const VARIANTS_QUERY = `#graphql
  ${PRODUCT_VARIANTS_FRAGMENT}
  query ProductVariants(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...ProductVariants
    }
  }
` as const;
