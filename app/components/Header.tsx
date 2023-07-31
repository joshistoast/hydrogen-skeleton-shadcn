import {Await, NavLink, useMatches} from '@remix-run/react';
import {Suspense} from 'react';
import type {LayoutProps} from './Layout';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from "~/components/ui/navigation-menu"
import { Icon } from '@iconify/react';
import { SearchAside, MobileMenuAside, CartAside } from '~/components/Layout'
import { Button } from './ui/button';


type HeaderProps = Pick<LayoutProps, 'header' | 'cart' | 'isLoggedIn'>;

type Viewport = 'desktop' | 'mobile';

export function Header({header, isLoggedIn, cart}: HeaderProps) {
  const {shop, menu} = header;
  return (
    <header className="z-[1] border-b">
      <div className="container flex items-center px-4 py-2 mx-auto">
        <NavLink prefetch="intent" to="/" end>
          <strong>{shop.name}</strong>
        </NavLink>
        <HeaderMenu menu={menu} viewport="desktop" />
        <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} header={header} />
      </div>
    </header>
  );
}

export function HeaderMenu({
  menu,
  viewport,
}: {
  menu: HeaderProps['header']['menu'];
  viewport: Viewport;
}) {
  const [root] = useMatches();
  const publicStoreDomain = root?.data?.publicStoreDomain;

  function closeAside(event: React.MouseEvent<HTMLAnchorElement>) {
    if (viewport === 'mobile') {
      event.preventDefault();
      window.location.href = event.currentTarget.href;
    }
  }

  return (
    <nav
      className={`gap-1 ${viewport === 'mobile' ? 'flex flex-col' : 'ml-3 hidden md:flex'}`}
      role="navigation"
    >
      {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
        if (!item.url) return null;

        // if the url is internal, we strip the domain
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain)
            ? new URL(item.url).pathname
            : item.url;
        return (
          <NavLink
            className={({ isActive, isPending }) => `
              ${navigationMenuTriggerStyle()}
              ${viewport === 'mobile' && '!w-full !justify-start'}
              ${isActive && 'bg-accent/50'}
              ${isPending && 'opacity-50'}
            `}
            end
            key={item.id}
            onClick={closeAside}
            prefetch="intent"
            to={url}
          >
            {item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
  header,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart' | 'header'>) {
  return (
    <nav className="flex items-center gap-1 ml-auto" role="navigation">
      <HeaderMenuMobileToggle header={header} />
      <NavLink
        className={({ isActive, isPending }) => `
          ${navigationMenuTriggerStyle()}
          ${isActive && 'bg-accent/50'}
          ${isPending && 'opacity-50'}
        `}
        prefetch="intent"
        to="/account"
      >
        {isLoggedIn ? 'Account' : 'Sign in'}
      </NavLink>
      <SearchToggle />
      <CartToggle cart={cart} />
    </nav>
  );
}

function HeaderMenuMobileToggle({
  header,
}: Pick<HeaderProps, 'header'>) {
  const {menu} = header;
  return (
    <MobileMenuAside menu={menu}>
      <Button variant="ghost" className="md:hidden" size="icon">
        <Icon icon="lucide:align-justify" className="w-4 h-4" />
      </Button>
    </MobileMenuAside>
  );
}

function SearchToggle() {
  return (
    <SearchAside>
      <Button variant="ghost" size="icon">
        <Icon icon="lucide:search" className="w-4 h-4" />
      </Button>
    </SearchAside>
  );
}

type CartBadgeProps = {
  count: number;
  cart?: HeaderProps['cart'];
}
function CartBadge({count, cart}: CartBadgeProps) {
  return (
    <CartAside cart={cart}>
      <Button variant="ghost">
        <Icon icon="lucide:shopping-cart" className="w-4 h-4 mr-2" />
        {count}
      </Button>
    </CartAside>
  )
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (
    <Suspense fallback={<CartBadge count={0} cart={cart} />}>
      <Await resolve={cart}>
        {(cart) => {
          if (!cart) return <CartBadge count={0} />;
          return <CartBadge count={cart.totalQuantity || 0} cart={cart} />;
        }}
      </Await>
    </Suspense>
  );
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/461609500728',
      resourceId: null,
      tags: [],
      title: 'Collections',
      type: 'HTTP',
      url: '/collections',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609533496',
      resourceId: null,
      tags: [],
      title: 'Blog',
      type: 'HTTP',
      url: '/blogs/journal',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566264',
      resourceId: null,
      tags: [],
      title: 'Policies',
      type: 'HTTP',
      url: '/policies',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609599032',
      resourceId: 'gid://shopify/Page/92591030328',
      tags: [],
      title: 'About',
      type: 'PAGE',
      url: '/pages/about',
      items: [],
    },
  ],
};
