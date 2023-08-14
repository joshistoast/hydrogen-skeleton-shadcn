import type {MailingAddressInput} from '@shopify/hydrogen/storefront-api-types';
import type {AddressFragment, CustomerFragment} from 'storefrontapi.generated';
import {
  json,
  redirect,
  type ActionArgs,
  type LoaderArgs,
  type V2_MetaFunction,
} from '@shopify/remix-oxygen';
import {
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from '@remix-run/react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Icon } from '@iconify/react';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Checkbox } from '~/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';

export type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null;
  deletedAddress?: string | null;
  error: Record<AddressFragment['id'], string> | null;
  updatedAddress?: AddressFragment;
};

export const meta: V2_MetaFunction = () => {
  return [{title: 'Addresses'}];
};

export async function loader({context}: LoaderArgs) {
  const {session} = context;
  const customerAccessToken = await session.get('customerAccessToken');
  if (!customerAccessToken) {
    return redirect('/account/login');
  }
  return json({});
}

export async function action({request, context}: ActionArgs) {
  const {storefront, session} = context;

  try {
    const form = await request.formData();

    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }

    const customerAccessToken = await session.get('customerAccessToken');
    if (!customerAccessToken) {
      return json({error: {[addressId]: 'Unauthorized'}}, {status: 401});
    }
    const {accessToken} = customerAccessToken;

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : null;
    const address: MailingAddressInput = {};
    const keys: (keyof MailingAddressInput)[] = [
      'address1',
      'address2',
      'city',
      'company',
      'country',
      'firstName',
      'lastName',
      'phone',
      'province',
      'zip',
    ];

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {customerAddressCreate} = await storefront.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {customerAccessToken: accessToken, address},
            },
          );

          if (customerAddressCreate?.customerUserErrors?.length) {
            const error = customerAddressCreate.customerUserErrors[0];
            throw new Error(error.message);
          }

          const createdAddress = customerAddressCreate?.customerAddress;
          if (!createdAddress?.id) {
            throw new Error(
              'Expected customer address to be created, but the id is missing',
            );
          }

          if (defaultAddress) {
            const createdAddressId = decodeURIComponent(createdAddress.id);
            const {customerDefaultAddressUpdate} = await storefront.mutate(
              UPDATE_DEFAULT_ADDRESS_MUTATION,
              {
                variables: {
                  customerAccessToken: accessToken,
                  addressId: createdAddressId,
                },
              },
            );

            if (customerDefaultAddressUpdate?.customerUserErrors?.length) {
              const error = customerDefaultAddressUpdate.customerUserErrors[0];
              throw new Error(error.message);
            }
          }

          return json({error: null, createdAddress, defaultAddress});
        } catch (error: unknown) {
          if (error instanceof Error) {
            return json({error: {[addressId]: error.message}}, {status: 400});
          }
          return json({error: {[addressId]: error}}, {status: 400});
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {customerAddressUpdate} = await storefront.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                customerAccessToken: accessToken,
                id: decodeURIComponent(addressId),
              },
            },
          );

          const updatedAddress = customerAddressUpdate?.customerAddress;

          if (customerAddressUpdate?.customerUserErrors?.length) {
            const error = customerAddressUpdate.customerUserErrors[0];
            throw new Error(error.message);
          }

          if (defaultAddress) {
            const {customerDefaultAddressUpdate} = await storefront.mutate(
              UPDATE_DEFAULT_ADDRESS_MUTATION,
              {
                variables: {
                  customerAccessToken: accessToken,
                  addressId: decodeURIComponent(addressId),
                },
              },
            );

            if (customerDefaultAddressUpdate?.customerUserErrors?.length) {
              const error = customerDefaultAddressUpdate.customerUserErrors[0];
              throw new Error(error.message);
            }
          }

          return json({error: null, updatedAddress, defaultAddress});
        } catch (error: unknown) {
          if (error instanceof Error) {
            return json({error: {[addressId]: error.message}}, {status: 400});
          }
          return json({error: {[addressId]: error}}, {status: 400});
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {customerAddressDelete} = await storefront.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {customerAccessToken: accessToken, id: addressId},
            },
          );

          if (customerAddressDelete?.customerUserErrors?.length) {
            const error = customerAddressDelete.customerUserErrors[0];
            throw new Error(error.message);
          }
          return json({error: null, deletedAddress: addressId});
        } catch (error: unknown) {
          if (error instanceof Error) {
            return json({error: {[addressId]: error.message}}, {status: 400});
          }
          return json({error: {[addressId]: error}}, {status: 400});
        }
      }

      default: {
        return json(
          {error: {[addressId]: 'Method not allowed'}},
          {status: 405},
        );
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return json({error: error.message}, {status: 400});
    }
    return json({error}, {status: 400});
  }
}

export default function Addresses() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {defaultAddress, addresses} = customer;

  return (
    <div className="account-addresses">
      <h2>Addresses</h2>
      {!addresses.nodes.length ? (
        <p>You have no addresses saved.</p>
      ) : (
        <div className="flex flex-col items-start gap-4 my-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Icon icon="lucide:plus" className="w-4 h-4 mr-2" />
                Create Address
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Address</DialogTitle>
              </DialogHeader>
              <NewAddressForm />
            </DialogContent>
          </Dialog>

          <ExistingAddresses
            addresses={addresses}
            defaultAddress={defaultAddress}
          />
        </div>
      )}
    </div>
  );
}

function NewAddressForm() {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    country: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phone: '',
    province: '',
    zip: '',
  } as AddressFragment;

  return (
    <AddressForm address={newAddress} defaultAddress={null}>
      {({stateForMethod}) => (
        <div className="mt-4">
          <Button
            disabled={stateForMethod('POST') !== 'idle'}
            formMethod="POST"
            type="submit"
          >
            <Icon icon={stateForMethod('POST') !== 'idle' ? 'lucide:loader-2' : 'lucide:check'} className={`${stateForMethod('POST') !== 'idle' ? 'animate-spin' : ''} mr-2 w-4 h-4`} />
            {stateForMethod('POST') !== 'idle' ? 'Creating' : 'Create'}
          </Button>
        </div>
      )}
    </AddressForm>
  );
}

function ExistingAddresses({
  addresses,
  defaultAddress,
}: Pick<CustomerFragment, 'addresses' | 'defaultAddress'>) {
  return (
    <div className="w-full">
      <h3>Existing addresses</h3>
      <div className="grid gap-2 my-2 lg:grid-cols-2">
        {addresses.nodes.map((address) => (
          <ExistingAddressCard
            key={address.id}
            address={address}
            defaultAddress={defaultAddress}
          />
        ))}
      </div>
    </div>
  );
}

export function ExistingAddressCard({
  address,
  defaultAddress,
}: {
  address: AddressFragment;
  defaultAddress: CustomerFragment['defaultAddress'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{address.firstName} {address.lastName}</CardTitle>
      </CardHeader>
      <CardContent>
        <address>
          {address.firstName} {address.lastName}
          <br />
          {address.company}
          <br />
          {address.address1}
          <br />
          {address.address2}
          <br />
          {address.city}, {address.province} {address.zip}
          <br />
          {address.country}
          <br />
          {address.phone}
        </address>
      </CardContent>
      <CardFooter>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Icon icon="lucide:edit" className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Address</DialogTitle>
            </DialogHeader>
            <AddressForm
              key={address.id}
              address={address}
              defaultAddress={defaultAddress}
            >
              {({ stateForMethod }) => (
                <div className="flex gap-2 mt-4">
                  <Button
                    disabled={stateForMethod('PUT') !== 'idle'}
                    formMethod="PUT"
                    type="submit"
                  >
                    <Icon icon={stateForMethod('PUT') !== 'idle' ? 'lucide:loader-2' : 'lucide:save'} className={`${stateForMethod('PUT') !== 'idle' ? 'animate-spin' : ''} mr-2 w-4 h-4`} />
                    {stateForMethod('PUT') !== 'idle' ? 'Saving' : 'Save'}
                  </Button>
                  <Button
                    disabled={stateForMethod('DELETE') !== 'idle'}
                    formMethod="DELETE"
                    type="submit"
                    variant="destructive"
                  >
                    <Icon icon={stateForMethod('DELETE') !== 'idle' ? 'lucide:loader-2' : 'lucide:trash'} className={`${stateForMethod('DELETE') !== 'idle' ? 'animate-spin' : ''} mr-2 w-4 h-4`} />
                    {stateForMethod('DELETE') !== 'idle' ? 'Deleting' : 'Delete'}
                  </Button>
                </div>
              )}
            </AddressForm>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}

export function AddressForm({
  address,
  defaultAddress,
  children,
}: {
  children: (props: {
    stateForMethod: (
      method: 'PUT' | 'POST' | 'DELETE',
    ) => ReturnType<typeof useNavigation>['state'];
  }) => React.ReactNode;
  defaultAddress: CustomerFragment['defaultAddress'];
  address: AddressFragment;
}) {
  const {state, formMethod} = useNavigation();
  const action = useActionData<ActionResponse>();
  const error = action?.error?.[address.id];
  const isDefaultAddress = defaultAddress?.id === address.id;
  return (
    <Form id={address.id} className="flex flex-col gap-2">
      <input type="hidden" name="addressId" defaultValue={address.id} />
      <div className="space-y-1">
        <Label htmlFor="firstName">First name*</Label>
        <Input
          aria-label="First name"
          autoComplete="given-name"
          defaultValue={address?.firstName ?? ''}
          id="firstName"
          name="firstName"
          placeholder="First name"
          required
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lastName">Last name*</Label>
        <Input
          aria-label="Last name"
          autoComplete="family-name"
          defaultValue={address?.lastName ?? ''}
          id="lastName"
          name="lastName"
          placeholder="Last name"
          required
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="company">Company</Label>
        <Input
          aria-label="Company"
          autoComplete="organization"
          defaultValue={address?.company ?? ''}
          id="company"
          name="company"
          placeholder="Company"
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="address1">Address line*</Label>
        <Input
          aria-label="Address line 1"
          autoComplete="address-line1"
          defaultValue={address?.address1 ?? ''}
          id="address1"
          name="address1"
          placeholder="Address line 1*"
          required
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="address2">Address line 2</Label>
        <Input
          aria-label="Address line 2"
          autoComplete="address-line2"
          defaultValue={address?.address2 ?? ''}
          id="address2"
          name="address2"
          placeholder="Address line 2"
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="city">City*</Label>
        <Input
          aria-label="City"
          autoComplete="address-level2"
          defaultValue={address?.city ?? ''}
          id="city"
          name="city"
          placeholder="City"
          required
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="province">State / Province*</Label>
        <Input
          aria-label="State"
          autoComplete="address-level1"
          defaultValue={address?.province ?? ''}
          id="province"
          name="province"
          placeholder="State / Province"
          required
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="zip">Zip / Postal Code*</Label>
        <Input
          aria-label="Zip"
          autoComplete="postal-code"
          defaultValue={address?.zip ?? ''}
          id="zip"
          name="zip"
          placeholder="Zip / Postal Code"
          required
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="country">Country*</Label>
        <Input
          aria-label="Country"
          autoComplete="country-name"
          defaultValue={address?.country ?? ''}
          id="country"
          name="country"
          placeholder="Country"
          required
          type="text"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone">Phone</Label>
        <Input
          aria-label="Phone"
          autoComplete="tel"
          defaultValue={address?.phone ?? ''}
          id="phone"
          name="phone"
          placeholder="+16135551111"
          type="tel"
        />
      </div>
      <div className="flex items-center gap-1 my-1">
        <Checkbox id="defaultAddress" defaultChecked={isDefaultAddress} />
        <Label htmlFor="defaultAddress">Set as default address</Label>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {children({
        stateForMethod: (method) => (formMethod === method ? state : 'idle'),
      })}
    </Form>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/2023-04/mutations/customeraddressupdate
const UPDATE_ADDRESS_MUTATION = `#graphql
  mutation customerAddressUpdate(
    $address: MailingAddressInput!
    $customerAccessToken: String!
    $id: ID!
    $country: CountryCode
    $language: LanguageCode
 ) @inContext(country: $country, language: $language) {
    customerAddressUpdate(
      address: $address
      customerAccessToken: $customerAccessToken
      id: $id
    ) {
      customerAddress {
        id
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customerAddressDelete
const DELETE_ADDRESS_MUTATION = `#graphql
  mutation customerAddressDelete(
    $customerAccessToken: String!,
    $id: ID!,
    $country: CountryCode,
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
      customerUserErrors {
        code
        field
        message
      }
      deletedCustomerAddressId
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customerdefaultaddressupdate
const UPDATE_DEFAULT_ADDRESS_MUTATION = `#graphql
  mutation customerDefaultAddressUpdate(
    $addressId: ID!
    $customerAccessToken: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerDefaultAddressUpdate(
      addressId: $addressId
      customerAccessToken: $customerAccessToken
    ) {
      customer {
        defaultAddress {
          id
        }
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customeraddresscreate
const CREATE_ADDRESS_MUTATION = `#graphql
  mutation customerAddressCreate(
    $address: MailingAddressInput!
    $customerAccessToken: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerAddressCreate(
      address: $address
      customerAccessToken: $customerAccessToken
    ) {
      customerAddress {
        id
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;
