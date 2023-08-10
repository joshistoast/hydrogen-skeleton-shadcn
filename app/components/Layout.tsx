import {Await} from '@remix-run/react';
import {Suspense} from 'react';
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from 'storefrontapi.generated';
import {Aside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/Cart';
import {
  PredictiveSearchForm,
  PredictiveSearchResults,
} from '~/components/Search';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet"
import { CartSummary, CartCheckoutActions, CartDiscounts } from '~/components/Cart';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '@iconify/react';
import React from 'react';
import { Badge } from './ui/badge';

export type LayoutProps = {
  cart: Promise<CartApiQueryFragment | null>;
  children?: React.ReactNode;
  footer: Promise<FooterQuery>;
  header: HeaderQuery;
  isLoggedIn: boolean;
};

export function Layout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
}: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header header={header} cart={cart} isLoggedIn={isLoggedIn} />
      <main className="flex flex-col flex-1">
        {children}
      </main>
      <Suspense>
        <Await resolve={footer}>
          {(footer) => <Footer menu={footer.menu} />}
        </Await>
      </Suspense>
    </div>
  );
}

type CartAsideProps = {
  cart: LayoutProps['cart'];
  children: React.ReactNode;
}
export function CartAside({cart, children}: CartAsideProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>

      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Cart
            {cart && (
              <Badge variant="secondary">
                <Await resolve={cart}>
                  {(cart) => cart?.totalQuantity}
                </Await>
              </Badge>
            )}
          </SheetTitle>
          <SheetClose />
        </SheetHeader>
        <Suspense fallback={<p>Loading cart ...</p>}>
          <Await resolve={cart}>
            {(cart) => {
              return (
                <>
                  <CartMain cart={cart} layout="aside" />
                  {cart && (
                    <SheetFooter className="mt-auto">
                      <CartSummary cost={cart.cost} layout="aside">
                        <CartDiscounts discountCodes={cart.discountCodes} />
                        <CartCheckoutActions checkoutUrl={cart.checkoutUrl} />
                      </CartSummary>
                    </SheetFooter>
                  )}
                </>
              );
            }}
          </Await>
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}

type SearchAsideProps = {
  children: React.ReactNode;
}
export function SearchAside({ children }: SearchAsideProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Search</SheetTitle>
        </SheetHeader>

        <PredictiveSearchForm>
          {({fetchResults, inputRef}) => (
            <div className="flex items-center gap-2 my-4">
              <Input
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search"
                ref={inputRef}
                type="search"
                className="w-full"
              />
              <Button type="submit" size="icon" className="shrink-0">
                <Icon icon="lucide:search" className="w-4 h-4" />
              </Button>
            </div>
          )}
        </PredictiveSearchForm>
        <PredictiveSearchResults />

      </SheetContent>
    </Sheet>
  );
}

type MobileMenuAsideProps = {
  menu: HeaderQuery['menu'];
  children: React.ReactNode;
}
export function MobileMenuAside({menu, children}: MobileMenuAsideProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>

      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="py-2">
          <HeaderMenu menu={menu} viewport="mobile" onNavLinkClick={() => setMobileMenuOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
