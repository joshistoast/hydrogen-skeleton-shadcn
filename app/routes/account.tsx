import { Icon } from '@iconify/react';
import {Form, NavLink, Outlet, useLoaderData} from '@remix-run/react';
import {json, redirect, type LoaderArgs} from '@shopify/remix-oxygen';
import React from 'react';
import type {CustomerFragment} from 'storefrontapi.generated';
import { Button, buttonVariants } from '~/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '~/components/ui/sheet';

export function shouldRevalidate() {
  return true;
}

export async function loader({request, context}: LoaderArgs) {
  const {session, storefront} = context;
  const {pathname} = new URL(request.url);
  const customerAccessToken = await session.get('customerAccessToken');
  const isLoggedIn = !!customerAccessToken?.accessToken;
  const isAccountHome = pathname === '/account' || pathname === '/account/';
  const isPrivateRoute =
    /^\/account\/(orders|orders\/.*|profile|addresses|addresses\/.*)$/.test(
      pathname,
    );

  if (!isLoggedIn) {
    if (isPrivateRoute || isAccountHome) {
      session.unset('customerAccessToken');
      return redirect('/account/login', {
        headers: {
          'Set-Cookie': await session.commit(),
        },
      });
    } else {
      // public subroute such as /account/login...
      return json({
        isLoggedIn: false,
        isAccountHome,
        isPrivateRoute,
        customer: null,
      });
    }
  } else {
    // loggedIn, default redirect to the orders page
    if (isAccountHome) {
      return redirect('/account/orders');
    }
  }

  try {
    const {customer} = await storefront.query(CUSTOMER_QUERY, {
      variables: {
        customerAccessToken: customerAccessToken.accessToken,
        country: storefront.i18n.country,
        language: storefront.i18n.language,
      },
      cache: storefront.CacheNone(),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return json(
      {isLoggedIn, isPrivateRoute, isAccountHome, customer},
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('There was a problem loading account', error);
    session.unset('customerAccessToken');
    return redirect('/account/login', {
      headers: {
        'Set-Cookie': await session.commit(),
      },
    });
  }
}

export default function Account() {
  const {customer, isPrivateRoute, isAccountHome} =
    useLoaderData<typeof loader>();

  if (!isPrivateRoute && !isAccountHome) {
    return <Outlet context={{customer}} />;
  }

  return (
    <AccountLayout customer={customer as CustomerFragment}>
      <Outlet context={{customer}} />
    </AccountLayout>
  );
}

function AccountLayout({
  customer,
  children,
}: {
  customer: CustomerFragment;
  children: React.ReactNode;
}) {
  const heading = customer
    ? customer.firstName
      ? `Welcome, ${customer.firstName}`
      : `Welcome to your account.`
    : 'Account Details';

  return (
    <div className="container flex flex-col gap-6 p-4 mx-auto">
      <h1>{heading}</h1>
      <AccountMenuAside heading={heading}>
        <Button className="flex lg:hidden">
          <Icon icon="lucide:align-justify" className="w-4 h-4 mr-2" />
          <span>Account Menu</span>
        </Button>
      </AccountMenuAside>
      <div className="flex gap-6">
        <div className="hidden w-full max-w-xs shrink-0 lg:block">
          <AccountMenu />
        </div>
        <div className="flex-1 w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

function AccountMenuAside({children, heading}: {children: React.ReactNode, heading: string}) {
  const [mobileAccountMenuOpen, setMobileAccountMenuOpen] = React.useState(false)

  return (
    <Sheet open={mobileAccountMenuOpen} onOpenChange={setMobileAccountMenuOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-2">
        <SheetHeader>
          <SheetTitle>{heading}</SheetTitle>
        </SheetHeader>

        <AccountMenu onNavLinkClick={() => setMobileAccountMenuOpen(false)} />

      </SheetContent>
    </Sheet>
  )
}

type AccountMenuItem = {
  icon: string;
  to: string;
  label: string;
}
type AccountMenuProps = {
  onNavLinkClick?: () => void;
}
function AccountMenu({onNavLinkClick}: AccountMenuProps) {
  const menu: AccountMenuItem[] = [
    {
      icon: 'lucide:box',
      to: '/account/orders',
      label: 'Orders',
    },
    {
      icon: 'lucide:user',
      to: '/account/profile',
      label: 'Profile',
    },
    {
      icon: 'lucide:map-pin',
      to: '/account/addresses',
      label: 'Addresses',
    }
  ]
  return (
    <nav role="navigation" className="flex flex-col gap-2">
      {menu.map((item, index) => (
        <NavLink
          key={index}
          to={item.to}
          onClick={onNavLinkClick}
          className={({ isActive, isPending }) => `
            ${buttonVariants({ variant: isActive ? 'secondary' : 'link' })}
            ${isPending ? 'animate-pulse' : ''}
            !justify-start
          `}
        >
          <Icon icon={item.icon} className="w-4 h-4 mr-2" />
          {item.label}
        </NavLink>
      ))}
      <Logout />
    </nav>
  );
}

function Logout() {
  return (
    <Form className="w-full" method="POST" action="/account/logout">
      <Button type="submit" variant="link" className="!text-red-400 !justify-start w-full">
        <Icon icon="lucide:log-out" className="w-4 h-4 mr-2" />
        <span>Sign Out</span>
      </Button>
    </Form>
  );
}

export const CUSTOMER_FRAGMENT = `#graphql
  fragment Customer on Customer {
    acceptsMarketing
    addresses(first: 6) {
      nodes {
        ...Address
      }
    }
    defaultAddress {
      ...Address
    }
    email
    firstName
    lastName
    numberOfOrders
    phone
  }
  fragment Address on MailingAddress {
    id
    formatted
    firstName
    lastName
    company
    address1
    address2
    country
    province
    city
    zip
    phone
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/customer
const CUSTOMER_QUERY = `#graphql
  query Customer(
    $customerAccessToken: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customer(customerAccessToken: $customerAccessToken) {
      ...Customer
    }
  }
  ${CUSTOMER_FRAGMENT}
` as const;
