import { defer, type LoaderArgs } from '@shopify/remix-oxygen'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  useMatches,
  useRouteError,
  LiveReload,
  useLoaderData,
  ScrollRestoration,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  Link,
} from '@remix-run/react'
import type { CustomerAccessToken } from '@shopify/hydrogen/storefront-api-types'
import type { HydrogenSession } from '../server'
import favicon from '../public/favicon.svg'
import appStyles from './styles/app.css'
import { Layout } from '~/components/Layout'
import tailwindCss from './styles/tailwind.css'
import { ThemeProvider } from '~/components/ThemeContext'
import { buttonVariants } from './components/ui/button'
import { Icon } from '@iconify/react'

// This is important to avoid re-fetching root queries on sub-navigations
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') {
    return true
  }

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) {
    return true
  }

  return false
}

export function links() {
  return [
    {rel: 'stylesheet', href: tailwindCss},
    {rel: 'stylesheet', href: appStyles},
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
  ]
}

export async function loader({context}: LoaderArgs) {
  const {storefront, session, cart} = context
  const customerAccessToken = await session.get('customerAccessToken')
  const publicStoreDomain = context.env.PUBLIC_STORE_DOMAIN

  // validate the customer access token is valid
  const {isLoggedIn, headers} = await validateCustomerAccessToken(
    session,
    customerAccessToken,
  )

  // defer the cart query by not awaiting it
  const cartPromise = cart.get()

  // defer the footer query (below the fold)
  const footerPromise = storefront.query(FOOTER_QUERY, {
    cache: storefront.CacheLong(),
    variables: {
      footerMenuHandle: 'footer', // Adjust to your footer menu handle
    },
  })

  // await the header query (above the fold)
  const headerPromise = storefront.query(HEADER_QUERY, {
    cache: storefront.CacheLong(),
    variables: {
      headerMenuHandle: 'main-menu', // Adjust to your header menu handle
    },
  })

  return defer(
    {
      cart: cartPromise,
      footer: footerPromise,
      header: await headerPromise,
      isLoggedIn,
      publicStoreDomain,
    },
    {headers},
  )
}

export default function App() {
  const data = useLoaderData<typeof loader>()

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider>
          <Layout {...data}>
            <Outlet />
          </Layout>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()
  const [root] = useMatches()
  let errorMessage = 'Unknown error'
  let errorStatus = 500

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data
    errorStatus = error.status
  } else if (error instanceof Error) {
    errorMessage = error.message
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider>
          <Layout {...root.data}>
            <div className="flex items-center flex-1">
              <div className="container p-4 mx-auto">
                <p className="font-mono font-semibold text-rose-400">{errorStatus}</p>
                <h1>Oops</h1>
                {errorMessage && (
                  <p className="text-muted-foreground">{errorMessage}</p>
                )}
                <Link to="/" className={`${buttonVariants({ variant: 'link' })} mt-6 pl-0`}>
                  <Icon icon="lucide:arrow-left" className="w-4 h-4 mr-2" />
                  Go home
                </Link>
              </div>
            </div>
          </Layout>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}

/**
 * Validates the customer access token and returns a boolean and headers
 * @see https://shopify.dev/docs/api/storefront/latest/objects/CustomerAccessToken
 *
 * @example
 * ```ts
 * //
 * const {isLoggedIn, headers} = await validateCustomerAccessToken(
 *  customerAccessToken,
 *  session,
 *  )
 *  ```
 *  */
async function validateCustomerAccessToken(
  session: HydrogenSession,
  customerAccessToken?: CustomerAccessToken,
) {
  let isLoggedIn = false
  const headers = new Headers()
  if (!customerAccessToken?.accessToken || !customerAccessToken?.expiresAt) {
    return {isLoggedIn, headers}
  }
  const expiresAt = new Date(customerAccessToken.expiresAt).getTime()
  const dateNow = Date.now()
  const customerAccessTokenExpired = expiresAt < dateNow

  if (customerAccessTokenExpired) {
    session.unset('customerAccessToken')
    headers.append('Set-Cookie', await session.commit())
  } else {
    isLoggedIn = true
  }

  return {isLoggedIn, headers}
}

const MENU_FRAGMENT = `#graphql
  fragment MenuItem on MenuItem {
    id
    resourceId
    tags
    title
    type
    url
  }
  fragment ChildMenuItem on MenuItem {
    ...MenuItem
  }
  fragment ParentMenuItem on MenuItem {
    ...MenuItem
    items {
      ...ChildMenuItem
    }
  }
  fragment Menu on Menu {
    id
    items {
      ...ParentMenuItem
    }
  }
` as const

const HEADER_QUERY = `#graphql
  fragment Shop on Shop {
    id
    name
    description
    primaryDomain {
      url
    }
    brand {
      logo {
        image {
          url
        }
      }
    }
  }
  query Header(
    $country: CountryCode
    $headerMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    shop {
      ...Shop
    }
    menu(handle: $headerMenuHandle) {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const

const FOOTER_QUERY = `#graphql
  query Footer(
    $country: CountryCode
    $footerMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    menu(handle: $footerMenuHandle) {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const
