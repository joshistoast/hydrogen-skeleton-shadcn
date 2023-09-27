import {json, redirect, type LoaderArgs} from '@shopify/remix-oxygen';
import {Link, useLoaderData, type V2_MetaFunction} from '@remix-run/react';
import {Money, Image, flattenConnection} from '@shopify/hydrogen';
import type {OrderLineItemFullFragment} from 'storefrontapi.generated';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { buttonVariants } from '~/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';

export const meta: V2_MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Order ${data?.order?.name}`}];
};

export async function loader({params, context}: LoaderArgs) {
  const {session, storefront} = context;

  if (!params.id) {
    return redirect('/account/orders');
  }

  const orderId = atob(params.id);
  const customerAccessToken = await session.get('customerAccessToken');

  if (!customerAccessToken) {
    return redirect('/account/login');
  }

  const {order} = await storefront.query(CUSTOMER_ORDER_QUERY, {
    variables: {orderId},
  });

  if (!order || !('lineItems' in order)) {
    throw new Response('Order not found', {status: 404});
  }

  const lineItems = flattenConnection(order.lineItems);
  const discountApplications = flattenConnection(order.discountApplications);

  const firstDiscount = discountApplications[0]?.value;

  const discountValue =
    firstDiscount?.__typename === 'MoneyV2' && firstDiscount;

  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue' &&
    firstDiscount?.percentage;

  return json({
    order,
    lineItems,
    discountValue,
    discountPercentage,
  });
}

export default function OrderRoute() {
  const {order, lineItems, discountValue, discountPercentage} =
    useLoaderData<typeof loader>();
  return (
    <div>
      <Link className={`${buttonVariants({variant: "link"})} pl-0`} to="/account/orders">← Back to Orders</Link>
      <div>
        <h2> Order {order.name}</h2>
        <span className="text-sm text-muted-foreground">Placed on {new Date(order.processedAt!).toDateString()}</span>
      </div>
      <Table className="my-2">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((lineItem, lineItemIndex) => (
            <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
          ))}
        </TableBody>
        <TableFooter>
          {((discountValue && discountValue.amount) ||
            discountPercentage) && (
              <TableRow>
                <TableHead scope="row" colSpan={3}>
                  Discounts
                </TableHead>
                <TableHead scope="row">
                  Discounts
                </TableHead>
                <TableCell>
                  {discountPercentage ? (
                    <span>-{discountPercentage}% OFF</span>
                  ) : (
                    discountValue && <Money data={discountValue!} />
                  )}
                </TableCell>
              </TableRow>
            )}
          <TableRow>
            <TableHead scope="row" colSpan={2}>
              Subtotal
            </TableHead>
            <TableHead scope="row">
              Subtotal
            </TableHead>
            <TableCell>
              <Money data={order.subtotalPriceV2!} />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableHead scope="row" colSpan={2}>
              Tax
            </TableHead>
            <TableHead scope="row">
              Tax
            </TableHead>
            <TableCell>
              <Money data={order.totalTaxV2!} />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableHead scope="row" colSpan={2}>
              Total
            </TableHead>
            <TableHead>
              Total
            </TableHead>
            <TableCell>
              <Money data={order.totalPriceV2!} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      <div className="grid gap-4 my-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent>
            {order?.shippingAddress ? (
              <address>
                <p>
                  {order.shippingAddress.firstName &&
                    order.shippingAddress.firstName + ' '}
                  {order.shippingAddress.lastName}
                </p>
                {order?.shippingAddress?.formatted ? (
                  order.shippingAddress.formatted.map((line: string) => (
                    <p key={line}>{line}</p>
                  ))
                ) : (
                  <></>
                )}
              </address>
            ) : (
              <p>No shipping address defined</p>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>OrderStatus</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <p>{order.fulfillmentStatus}</p>
          </CardContent>
          <CardFooter>
            <Link className={`${buttonVariants({variant: "link"})} pl-0`} to={order.statusUrl} target="_blank" rel="noreferrer">
              View Order Status →
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function OrderLineRow({lineItem}: {lineItem: OrderLineItemFullFragment}) {
  return (
    <TableRow key={lineItem.variant!.id}>
      <TableCell>
        <div>
          <Link to={`/products/${lineItem.variant!.product!.handle}`} className="flex items-start gap-2">
            {lineItem?.variant?.image && (
              <Image data={lineItem.variant.image} width={96} height={96} />
            )}
            <div className="flex flex-col gap-1">
              <span>{lineItem.title}</span>
              <span className="text-sm text-muted-foreground">{lineItem.variant!.title}</span>
            </div>
          </Link>
        </div>
      </TableCell>
      <TableCell>
        <Money data={lineItem.variant!.price!} />
      </TableCell>
      <TableCell>{lineItem.quantity}</TableCell>
      <TableCell>
        <Money data={lineItem.discountedTotalPrice!} />
      </TableCell>
    </TableRow>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/Order
const CUSTOMER_ORDER_QUERY = `#graphql
  fragment OrderMoney on MoneyV2 {
    amount
    currencyCode
  }
  fragment AddressFull on MailingAddress {
    address1
    address2
    city
    company
    country
    countryCodeV2
    firstName
    formatted
    id
    lastName
    name
    phone
    province
    provinceCode
    zip
  }
  fragment DiscountApplication on DiscountApplication {
    value {
      __typename
      ... on MoneyV2 {
        ...OrderMoney
      }
      ... on PricingPercentageValue {
        percentage
      }
    }
  }
  fragment OrderLineProductVariant on ProductVariant {
    id
    image {
      altText
      height
      url
      id
      width
    }
    price {
      ...OrderMoney
    }
    product {
      handle
    }
    sku
    title
  }
  fragment OrderLineItemFull on OrderLineItem {
    title
    quantity
    discountAllocations {
      allocatedAmount {
        ...OrderMoney
      }
      discountApplication {
        ...DiscountApplication
      }
    }
    originalTotalPrice {
      ...OrderMoney
    }
    discountedTotalPrice {
      ...OrderMoney
    }
    variant {
      ...OrderLineProductVariant
    }
  }
  fragment Order on Order {
    id
    name
    orderNumber
    statusUrl
    processedAt
    fulfillmentStatus
    totalTaxV2 {
      ...OrderMoney
    }
    totalPriceV2 {
      ...OrderMoney
    }
    subtotalPriceV2 {
      ...OrderMoney
    }
    shippingAddress {
      ...AddressFull
    }
    discountApplications(first: 100) {
      nodes {
        ...DiscountApplication
      }
    }
    lineItems(first: 100) {
      nodes {
        ...OrderLineItemFull
      }
    }
  }
  query Order(
    $country: CountryCode
    $language: LanguageCode
    $orderId: ID!
  ) @inContext(country: $country, language: $language) {
    order: node(id: $orderId) {
      ... on Order {
        ...Order
      }
    }
  }
` as const;
