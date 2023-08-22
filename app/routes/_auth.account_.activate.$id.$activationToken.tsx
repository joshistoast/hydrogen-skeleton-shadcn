import {
  json,
  redirect,
  type ActionArgs,
  type LoaderArgs,
} from '@shopify/remix-oxygen';
import {Form, useActionData, type V2_MetaFunction} from '@remix-run/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';

type ActionResponse = {
  error: string | null;
};

export const meta: V2_MetaFunction = () => {
  return [{title: 'Activate Account'}];
};

export async function loader({context}: LoaderArgs) {
  if (await context.session.get('customerAccessToken')) {
    return redirect('/account');
  }
  return json({});
}

export async function action({request, context, params}: ActionArgs) {
  const {session, storefront} = context;
  const {id, activationToken} = params;

  if (request.method !== 'POST') {
    return json({error: 'Method not allowed'}, {status: 405});
  }

  try {
    if (!id || !activationToken) {
      throw new Error('Missing token. The link you followed might be wrong.');
    }

    const form = await request.formData();
    const password = form.has('password') ? String(form.get('password')) : null;
    const passwordConfirm = form.has('passwordConfirm')
      ? String(form.get('passwordConfirm'))
      : null;

    const validPasswords =
      password && passwordConfirm && password === passwordConfirm;

    if (!validPasswords) {
      throw new Error('Passwords do not match');
    }

    const {customerActivate} = await storefront.mutate(
      CUSTOMER_ACTIVATE_MUTATION,
      {
        variables: {
          id: `gid://shopify/Customer/${id}`,
          input: {
            password,
            activationToken,
          },
        },
      },
    );

    if (customerActivate?.customerUserErrors?.length) {
      throw new Error(customerActivate.customerUserErrors[0].message);
    }

    const {customerAccessToken} = customerActivate ?? {};
    if (!customerAccessToken) {
      throw new Error('Could not activate account.');
    }
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

export default function Activate() {
  const action = useActionData<ActionResponse>();
  const error = action?.error ?? null;

  return (
    <Card className='max-w-md'>
      <CardHeader>
        <CardTitle>Activate Account.</CardTitle>
        <CardDescription>
          Create your password to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="POST" className="flex flex-col gap-4">
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
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="passwordConfirm">Re-enter password</Label>
            <Input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="current-password"
              placeholder="Re-enter password"
              aria-label="Re-enter password"
              minLength={8}
              required
            />
          </div>
          {error && (
            <Alert variant='destructive'>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit">Save</Button>
        </Form>
      </CardContent>
    </Card>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customeractivate
const CUSTOMER_ACTIVATE_MUTATION = `#graphql
  mutation customerActivate(
    $id: ID!,
    $input: CustomerActivateInput!,
    $country: CountryCode,
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerActivate(id: $id, input: $input) {
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;
