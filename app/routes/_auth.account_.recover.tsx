import {json, redirect, type LoaderArgs} from '@shopify/remix-oxygen';
import {Form, Link, useActionData} from '@remix-run/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button, buttonVariants } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

type ActionResponse = {
  error?: string;
  resetRequested?: boolean;
};

export async function loader({context}: LoaderArgs) {
  const customerAccessToken = await context.session.get('customerAccessToken');
  if (customerAccessToken) {
    return redirect('/account');
  }

  return json({});
}

export async function action({request, context}: LoaderArgs) {
  const {storefront} = context;
  const form = await request.formData();
  const email = form.has('email') ? String(form.get('email')) : null;

  if (request.method !== 'POST') {
    return json({error: 'Method not allowed'}, {status: 405});
  }

  try {
    if (!email) {
      throw new Error('Please provide an email.');
    }
    await storefront.mutate(CUSTOMER_RECOVER_MUTATION, {
      variables: {email},
    });

    return json({resetRequested: true});
  } catch (error: unknown) {
    const resetRequested = false;
    if (error instanceof Error) {
      return json({error: error.message, resetRequested}, {status: 400});
    }
    return json({error, resetRequested}, {status: 400});
  }
}

export default function Recover() {
  const action = useActionData<ActionResponse>();

  return (
    <Card className='max-w-md'>
      <CardHeader>
        <CardTitle>Forgot Password.</CardTitle>
        <CardDescription>
          Enter the email address associated with your account to receive a
          link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {action?.resetRequested ? (
          <>
            <Alert>
              <AlertTitle>Request Sent</AlertTitle>
              <AlertDescription>
                If that email address is in our system, you will receive an email
                with instructions about how to reset your password in a few
                minutes.
              </AlertDescription>
            </Alert>
            <Link to="/account/login">Return to Login</Link>
          </>
        ) : (
          <>
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
              {action?.error && (
                <Alert variant='destructive'>
                  <AlertDescription>{action.error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit">Request Reset Link</Button>
            </Form>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-4">
        <Link className={buttonVariants({ variant: 'link' })} to="/account/login">Login →</Link>
      </CardFooter>
    </Card>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customerrecover
const CUSTOMER_RECOVER_MUTATION = `#graphql
  mutation customerRecover(
    $email: String!,
    $country: CountryCode,
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerRecover(email: $email) {
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;
