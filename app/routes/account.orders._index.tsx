import { Icon } from '@iconify/react';
import {Link, useLoaderData} from '@remix-run/react';
import {Money, Pagination, getPaginationVariables} from '@shopify/hydrogen';
import {
  json,
  redirect,
  type LoaderArgs,
  type V2_MetaFunction,
} from '@shopify/remix-oxygen';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'storefrontapi.generated';
import { Badge } from '~/components/ui/badge';
import { buttonVariants } from '~/components/ui/button';
import { Card, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';

export const meta: V2_MetaFunction = () => {
  return [{title: 'Orders'}];
};

export async function loader({request, context}: LoaderArgs) {
  const {session, storefront} = context;

  const customerAccessToken = await session.get('customerAccessToken');
  if (!customerAccessToken?.accessToken) {
    return redirect('/account/login');
  }

  try {
    const paginationVariables = getPaginationVariables(request, {
      pageBy: 20,
    });

    const {customer} = await storefront.query(CUSTOMER_ORDERS_QUERY, {
      variables: {
        customerAccessToken: customerAccessToken.accessToken,
        country: storefront.i18n.country,
        language: storefront.i18n.language,
        ...paginationVariables,
      },
      cache: storefront.CacheNone(),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return json({customer});
  } catch (error: unknown) {
    if (error instanceof Error) {
      return json({error: error.message}, {status: 400});
    }
    return json({error}, {status: 400});
  }
}

export default function Orders() {
  const {customer} = useLoaderData<{customer: CustomerOrdersFragment}>();
  const {orders, numberOfOrders} = customer;
  return (
    <div>
      <h2>
        Orders <small>({numberOfOrders})</small>
      </h2>
      {orders.nodes.length ? <OrdersList orders={orders} /> : <EmptyOrders />}
    </div>
  );
}

function OrdersList({orders}: Pick<CustomerOrdersFragment, 'orders'>) {
  return (
    <div className="flex flex-col gap-4">
      {orders?.nodes.length ? (
        <Pagination connection={orders}>
          {({nodes, isLoading, PreviousLink, NextLink}) => {
            return (
              <>
                <div className="flex justify-center w-full">
                  <PreviousLink className={buttonVariants({ variant: 'default' })} aria-disabled={isLoading}>
                    <>
                      <Icon icon={isLoading ? 'lucide:loader-2' : 'lucide:arrow-up'} className={`${isLoading ? 'animate-spin' : ''} w-4 h-4 mr-2`} />
                      <span>{isLoading ? 'Loading' : 'Load'} previous</span>
                    </>
                  </PreviousLink>
                </div>

                {nodes.map((order) => {
                  return <OrderItem key={order.id} order={order} />;
                })}

                <div className="flex justify-center w-full">
                  <NextLink className={buttonVariants({ variant: 'default' })} aria-disabled={isLoading}>
                    <>
                      <Icon icon={isLoading ? 'lucide:loader-2' : 'lucide:arrow-down'} className={`${isLoading ? 'animate-spin' : ''} mr-2 w-4 h-4`} />
                      <span>{isLoading ? 'Loading' : 'Load'} more</span>
                    </>
                  </NextLink>
                </div>
              </>
            );
          }}
        </Pagination>
      ) : (
        <EmptyOrders />
      )}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div>
      <p>You haven&apos;t placed any orders yet.</p>
      <br />
      <p>
        <Link className={buttonVariants({ variant: 'link' })} to="/collections">Start Shopping →</Link>
      </p>
    </div>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">{order.financialStatus}</Badge>
          <Badge variant="outline">{order.fulfillmentStatus}</Badge>
        </div>
        <CardTitle>
          #{order.orderNumber}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{new Date(order.processedAt).toDateString()}</span>
          •
          <Money data={order.currentTotalPrice} />
        </div>
      </CardHeader>
      <CardFooter>
        <Link
          className={`${buttonVariants({ variant: 'link' })} !p-0`}
          to={`/account/orders/${btoa(order.id)}`}
        >
          View Order
          <Icon icon="lucide:arrow-right" className="ml-1" />
        </Link>
      </CardFooter>
    </Card>
  );
}

const ORDER_ITEM_FRAGMENT = `#graphql
  fragment OrderItem on Order {
    currentTotalPrice {
      amount
      currencyCode
    }
    financialStatus
    fulfillmentStatus
    id
    lineItems(first: 10) {
      nodes {
        title
        variant {
          image {
            url
            altText
            height
            width
          }
        }
      }
    }
    orderNumber
    customerUrl
    statusUrl
    processedAt
  }
` as const;

export const CUSTOMER_FRAGMENT = `#graphql
  fragment CustomerOrders on Customer {
    numberOfOrders
    orders(
      sortKey: PROCESSED_AT,
      reverse: true,
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      nodes {
        ...OrderItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        hasNextPage
        endCursor
      }
    }
  }
  ${ORDER_ITEM_FRAGMENT}
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/customer
const CUSTOMER_ORDERS_QUERY = `#graphql
  ${CUSTOMER_FRAGMENT}
  query CustomerOrders(
    $country: CountryCode
    $customerAccessToken: String!
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    customer(customerAccessToken: $customerAccessToken) {
      ...CustomerOrders
    }
  }
` as const;
