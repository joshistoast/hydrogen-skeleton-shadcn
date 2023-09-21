import {json, redirect, type LoaderArgs} from '@shopify/remix-oxygen';
import { useLoaderData, Link, type V2_MetaFunction } from '@remix-run/react';
import {
  Pagination,
  getPaginationVariables,
  Image,
  Money,
  flattenConnection,
} from '@shopify/hydrogen';
import type {
  Filter,
  ProductCollectionSortKeys,
} from '@shopify/hydrogen/storefront-api-types';
import type {ProductCardFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/utils';
// import SortFilter from '~/components/SortFilter';
import { buttonVariants } from '~/components/ui/button';
import { Icon } from '@iconify/react';
import { AppliedFilter, SortFilter, SortParam } from '~/components/SortFilter';
import { PRODUCT_CARD_FRAGMENT } from '~/data/fragments';

export const meta: V2_MetaFunction = ({data}) => {
  return [{title: `Hydrogen | ${data.collection.title} Collection`}];
};

type VariantFilterParam = Record<string, string | boolean>;
type PriceFiltersQueryParam = Record<'price', { max?: number; min?: number }>;
type VariantOptionFiltersQueryParam = Record<
  'variantOption',
  { name: string; value: string }
>;
type FiltersQueryParams = Array<
  VariantFilterParam | PriceFiltersQueryParam | VariantOptionFiltersQueryParam
>;

export async function loader({request, params, context}: LoaderArgs) {
  const {handle} = params;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    return redirect('/collections');
  }

  const searchParams = new URL(request.url).searchParams;
  const knownFilters = ['productVendor', 'productType'];
  const available = 'available';
  const variantOption = 'variantOption';
  const { sortKey, reverse } = getSortValuesFromParam(
    searchParams.get('sort') as SortParam,
  );
  const filters: FiltersQueryParams = [];
  const appliedFilters: AppliedFilter[] = [];

  for (const [key, value] of searchParams.entries()) {
    if (available === key) {
      filters.push({ available: value === 'true' });
      appliedFilters.push({
        label: value === 'true' ? 'In stock' : 'Out of stock',
        urlParam: {
          key: available,
          value,
        },
      });
    } else if (knownFilters.includes(key)) {
      filters.push({ [key]: value });
      appliedFilters.push({ label: value, urlParam: { key, value } });
    } else if (key.includes(variantOption)) {
      const [name, val] = value.split(':');
      filters.push({ variantOption: { name, value: val } });
      appliedFilters.push({ label: val, urlParam: { key, value } });
    }
  }

  // Builds min and max price filter since we can't stack them separately into
  // the filters array. See price filters limitations:
  // https://shopify.dev/custom-storefronts/products-collections/filter-products#limitations
  if (searchParams.has('minPrice') || searchParams.has('maxPrice')) {
    const price: { min?: number; max?: number } = {};
    if (searchParams.has('minPrice')) {
      price.min = Number(searchParams.get('minPrice')) || 0;
      appliedFilters.push({
        label: `Min: $${price.min}`,
        urlParam: { key: 'minPrice', value: searchParams.get('minPrice')! },
      });
    }
    if (searchParams.has('maxPrice')) {
      price.max = Number(searchParams.get('maxPrice')) || 0;
      appliedFilters.push({
        label: `Max: $${price.max}`,
        urlParam: { key: 'maxPrice', value: searchParams.get('maxPrice')! },
      });
    }
    filters.push({
      price,
    });
  }

  const { collection } = await context.storefront.query(
    COLLECTION_QUERY,
    {
      variables: {
        ...paginationVariables,
        handle,
        filters,
        sortKey,
        reverse,
        country: context.storefront.i18n.country,
        language: context.storefront.i18n.language,
      },
    },
  );

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }
  return json({
    collection,
    appliedFilters,
  });
}

export default function Collection() {
  const { collection, appliedFilters } = useLoaderData<typeof loader>()

  return (
    <div className="container flex flex-col gap-4 p-4 mx-auto">
      <h1>{collection.title}</h1>

      {collection.description && (
        <p className="collection-description">{collection.description}</p>
      )}

      <SortFilter
        filters={collection.products.filters as Filter[]}
        appliedFilters={appliedFilters}
      >
        <Pagination connection={collection.products}>
          {({nodes, isLoading, PreviousLink, NextLink}) => (
            <>
              <div className="flex justify-center w-full">
                <PreviousLink className={buttonVariants({ variant: 'default' })} aria-disabled={isLoading}>
                  <>
                    <Icon icon={isLoading ? 'lucide:loader-2' : 'lucide:arrow-up'} className={`${isLoading ? 'animate-spin' : ''} w-4 h-4 mr-2`} />
                    <span>{isLoading ? 'Loading' : 'Load'} previous</span>
                  </>
                </PreviousLink>
              </div>

              <ProductsGrid products={nodes} />

              <div className="flex justify-center w-full">
                <NextLink className={buttonVariants({ variant: 'default' })} aria-disabled={isLoading}>
                  <>
                    <Icon icon={isLoading ? 'lucide:loader-2' : 'lucide:arrow-down'} className={`${isLoading ? 'animate-spin' : ''} mr-2 w-4 h-4`} />
                    <span>{isLoading ? 'Loading' : 'Load'} more</span>
                  </>
                </NextLink>
              </div>
            </>
          )}
        </Pagination>
      </SortFilter>
    </div>
  );
}

function ProductsGrid({products}: {products: ProductCardFragment[]}) {
  return (
    <div className="products-grid">
      {products.map((product, index) => {
        return (
          <ProductCard
            key={product.id}
            product={product}
            loading={index < 8 ? 'eager' : undefined}
          />
        );
      })}
    </div>
  );
}

function ProductCard({
  product,
  loading,
}: {
  product: ProductCardFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variant = product.variants.nodes[0];
  const variantUrl = useVariantUrl(product.handle, variant.selectedOptions);
  return (
    <Link
      className="flex flex-col gap-2"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
    >
      {product.featuredImage && (
        <Image
          alt={product.featuredImage.altText || product.title}
          aspectRatio='1/1'
          data={product.featuredImage}
          loading={loading}
          sizes="(min-width: 45em) 400px, 100vw"
          className="object-cover w-full h-full"
        />
      )}
      <div>
        <h4>{product.title}</h4>
        <Money data={product.priceRange.minVariantPrice} className="text-sm" />
      </div>
    </Link>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  query CollectionDetails(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys!
    $reverse: Boolean
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      seo {
        description
        title
      }
      image {
        id
        url
        width
        height
        altText
      }
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        filters: $filters,
        sortKey: $sortKey,
        reverse: $reverse
      ) {
        filters {
          id
          label
          type
          values {
            id
            label
            count
            input
          }
        }
        nodes {
          ...ProductCard
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          hasNextPage
          startCursor
          endCursor
        }
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
` as const;

function getSortValuesFromParam(sortParam: SortParam | null): {
  sortKey: ProductCollectionSortKeys;
  reverse: boolean;
} {
  switch (sortParam) {
    case 'price-high-low':
      return {
        sortKey: 'PRICE',
        reverse: true,
      };
    case 'price-low-high':
      return {
        sortKey: 'PRICE',
        reverse: false,
      };
    case 'best-selling':
      return {
        sortKey: 'BEST_SELLING',
        reverse: false,
      };
    case 'newest':
      return {
        sortKey: 'CREATED',
        reverse: true,
      };
    case 'featured':
      return {
        sortKey: 'MANUAL',
        reverse: false,
      };
    default:
      return {
        sortKey: 'RELEVANCE',
        reverse: false,
      };
  }
}
