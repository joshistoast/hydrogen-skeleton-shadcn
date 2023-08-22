import {
  json,
  redirect,
  type ActionArgs,
  type LoaderArgs,
} from '@shopify/remix-oxygen';
import {
  Form,
  Link,
  useActionData,
  type V2_MetaFunction,
} from '@remix-run/react';
import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input';
import { Button, buttonVariants } from '~/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '~/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'


type ActionResponse = {
  error: string | null;
};

export const meta: V2_MetaFunction = () => {
  return [{title: 'Login'}];
};

export async function loader({context}: LoaderArgs) {
  if (await context.session.get('customerAccessToken')) {
    return redirect('/account');
  }
  return json({});
}

export async function action({request, context}: ActionArgs) {
  const {session, storefront} = context;

  if (request.method !== 'POST') {
    return json({error: 'Method not allowed'}, {status: 405});
  }

  try {
    const form = await request.formData();
    const email = String(form.has('email') ? form.get('email') : '');
    const password = String(form.has('password') ? form.get('password') : '');
    const validInputs = Boolean(email && password);

    if (!validInputs) {
      throw new Error('Please provide both an email and a password.');
    }

    const {customerAccessTokenCreate} = await storefront.mutate(
      LOGIN_MUTATION,
      {
        variables: {
          input: {email, password},
        },
      },
    );

    if (!customerAccessTokenCreate?.customerAccessToken?.accessToken) {
      throw new Error(customerAccessTokenCreate?.customerUserErrors[0].message);
    }

    const {customerAccessToken} = customerAccessTokenCreate;
    session.set('customerAccessToken', customerAccessToken);

    return redirect('/account', {
      headers: {
        'Set-Cookie': await session.commit(),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return json({error: error.message}, {status: 400});
    }
    return json({error}, {status: 400});
  }
}

export default function Login() {
  const data = useActionData<ActionResponse>();
  const error = data?.error || null;

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Sign in.</CardTitle>
        <CardDescription>
          Sign in to your account to access your order history and update your account details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="POST" className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Email address"
              aria-label="Email address"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              minLength={8}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit">Sign in</Button>
        </Form>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-4">
        <Link className={buttonVariants({ variant: 'link' })} to="/account/recover">Forgot password →</Link>
        <Link className={buttonVariants({ variant: 'link' })} to="/account/register">Register →</Link>
      </CardFooter>
    </Card>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customeraccesstokencreate
const LOGIN_MUTATION = `#graphql
  mutation login($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerUserErrors {
        code
        field
        message
      }
      customerAccessToken {
        accessToken
        expiresAt
      }
    }
  }
` as const;
