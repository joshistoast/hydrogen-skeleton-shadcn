import type { SyntheticEvent } from 'react';
import { useMemo, useState } from 'react';
import type { Location } from '@remix-run/react';
import {
  Link,
  useLocation,
  useSearchParams,
  useNavigate,
} from '@remix-run/react';
import { useDebounce } from 'react-use';
import type { FilterType, Filter } from '@shopify/hydrogen/storefront-api-types';
import { Icon } from '@iconify/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { Button, buttonVariants } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Badge } from './ui/badge';

export type AppliedFilter = {
  label: string;
  urlParam: {
    key: string;
    value: string;
  };
};

export type SortParam =
  | 'price-low-high'
  | 'price-high-low'
  | 'best-selling'
  | 'newest'
  | 'featured';

type Props = {
  filters: Filter[];
  appliedFilters?: AppliedFilter[];
  children: React.ReactNode;
  collections?: Array<{ handle: string; title: string }>;
};

export function SortFilter({
  filters,
  appliedFilters = [],
  children,
  collections = [],
}: Props) {
  const name = 'Filter'
  return (
    <>
      <div className="flex justify-end w-full">
        {/* Filters Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <Icon icon="lucide:filter" className="w-6 h-6 mr-2" />
              {name}
            </Button>
          </SheetTrigger>

          <SheetContent>
            <SheetHeader>
              <SheetTitle>{name}</SheetTitle>
            </SheetHeader>

            <FiltersDrawer
              collections={collections}
              filters={filters}
              appliedFilters={appliedFilters}
            />

          </SheetContent>
        </Sheet>
      </div>

      {/* Product Grid */}
      <div className="flex-1">
        {children}
      </div>
    </>
  );
}

export function FiltersDrawer({
  filters = [],
  appliedFilters = [],
}: Omit<Props, 'children'>) {
  const [params] = useSearchParams();
  const location = useLocation();

  const filterMarkup = (filter: Filter, option: Filter['values'][0]) => {
    const isActive = isFilterActive(filter, option.input as string, params);
    switch (filter.type) {
      case 'PRICE_RANGE':
        const min =
          params.has('minPrice') && !isNaN(Number(params.get('minPrice')))
            ? Number(params.get('minPrice'))
            : undefined;

        const max =
          params.has('maxPrice') && !isNaN(Number(params.get('maxPrice')))
            ? Number(params.get('maxPrice'))
            : undefined;

        return <PriceRangeFilter min={min} max={max} />;

      default:
        const to = getFilterLink(
          filter,
          option.input as string,
          params,
          location,
        );
        return (
          <Link
            className={`
              ${buttonVariants({ variant: isActive ? 'default' : 'ghost' })}
              !justify-start w-full
            `}
            prefetch="intent"
            to={to}
          >
            {option.label}
          </Link>
        );
    }
  };

  return (
    <Accordion type="multiple">
      {appliedFilters.length > 0 && (
        <AppliedFilters filters={appliedFilters} />
      )}
      <SortMenu />
      {filters.map(
        (filter: Filter) =>
          filter.values.length > 1 && (
            <AccordionItem value={filter.id} key={filter.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span>{filter.label}</span>
                  <Badge variant="secondary">{filter.values.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-1" key={filter.id}>
                  {filter.values?.map((option) => (
                    <div key={option.id}>
                      {filterMarkup(filter, option)}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ),
      )}
    </Accordion>
  );
}

function AppliedFilters({ filters = [] }: { filters: AppliedFilter[] }) {
  const [params] = useSearchParams();
  const location = useLocation();
  return (
    <>
      <AccordionItem value="applied-filters">
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            <span>Applied Filters</span>
            <Badge variant="secondary">{filters.length}</Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter: AppliedFilter) => {
              return (
                <Link
                  to={getAppliedFilterLink(filter, params, location)}
                  className={`
                    ${buttonVariants({ variant: 'outline', size: 'sm' })}
                    text-red-300 hover:text-red-400
                  `}
                  key={`${filter.label}-${filter.urlParam}`}
                >
                  <Icon icon="lucide:trash" className="w-5 h-5 mr-2" />
                  <span>{filter.label}</span>
                </Link>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}

function getAppliedFilterLink(
  filter: AppliedFilter,
  params: URLSearchParams,
  location: Location,
) {
  const paramsClone = new URLSearchParams(params);
  if (filter.urlParam.key === 'variantOption') {
    const variantOptions = paramsClone.getAll('variantOption');
    const filteredVariantOptions = variantOptions.filter(
      (options) => !options.includes(filter.urlParam.value),
    );
    paramsClone.delete(filter.urlParam.key);
    for (const filteredVariantOption of filteredVariantOptions) {
      paramsClone.append(filter.urlParam.key, filteredVariantOption);
    }
  } else {
    paramsClone.delete(filter.urlParam.key);
  }
  return `${location.pathname}?${paramsClone.toString()}`;
}

function getSortLink(
  sort: SortParam,
  params: URLSearchParams,
  location: Location,
) {
  params.set('sort', sort);
  return `${location.pathname}?${params.toString()}`;
}

function getFilterLink(
  filter: Filter,
  rawInput: string | Record<string, any>,
  params: URLSearchParams,
  location: ReturnType<typeof useLocation>,
) {
  const paramsClone = new URLSearchParams(params);
  const newParams = filterInputToParams(filter.type, rawInput, paramsClone);
  return `${location.pathname}?${newParams.toString()}`;
}

function isFilterActive(
  filter: Filter,
  rawInput: string | Record<string, any>,
  params: URLSearchParams,
): boolean {
  const input = (
    typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput
  ) as Record<string, any>;

  switch (filter.type) {
    case 'LIST':
      return Object.entries(input).some(([key, value]) => {
        if (typeof value === 'string') {
          return params.get(key) === value;
        } else if (typeof value === 'boolean') {
          return params.get(key) === value.toString();
        } else {
          const { name, value: val } = value as { name: string; value: string };
          const variantValue = `${name}:${val}`;
          return params.getAll('variantOption').includes(variantValue);
        }
      });

    case 'PRICE_RANGE':
      // You can add similar logic for PRICE_RANGE here if needed.
      return false;

    default:
      return false;
  }
}

const PRICE_RANGE_FILTER_DEBOUNCE = 500;

function PriceRangeFilter({ max, min }: { max?: number; min?: number }) {
  const location = useLocation();
  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const navigate = useNavigate();

  const [minPrice, setMinPrice] = useState(min ? String(min) : '');
  const [maxPrice, setMaxPrice] = useState(max ? String(max) : '');

  useDebounce(
    () => {
      if (
        (minPrice === '' || minPrice === String(min)) &&
        (maxPrice === '' || maxPrice === String(max))
      )
        return;

      const price: { min?: string; max?: string } = {};
      if (minPrice !== '') price.min = minPrice;
      if (maxPrice !== '') price.max = maxPrice;

      const newParams = filterInputToParams('PRICE_RANGE', { price }, params);
      navigate(`${location.pathname}?${newParams.toString()}`);
    },
    PRICE_RANGE_FILTER_DEBOUNCE,
    [minPrice, maxPrice],
  );

  const onChangeMax = (event: SyntheticEvent) => {
    const newMaxPrice = (event.target as HTMLInputElement).value;
    setMaxPrice(newMaxPrice);
  };

  const onChangeMin = (event: SyntheticEvent) => {
    const newMinPrice = (event.target as HTMLInputElement).value;
    setMinPrice(newMinPrice);
  };

  return (
    <div className="flex flex-col">
      <label className="mb-4">
        <span>from</span>
        <input
          name="maxPrice"
          className="text-black"
          type="text"
          defaultValue={min}
          placeholder={'$'}
          onChange={onChangeMin}
        />
      </label>
      <label>
        <span>to</span>
        <input
          name="minPrice"
          className="text-black"
          type="number"
          defaultValue={max}
          placeholder={'$'}
          onChange={onChangeMax}
        />
      </label>
    </div>
  );
}

function filterInputToParams(
  type: FilterType,
  rawInput: string | Record<string, any>,
  params: URLSearchParams,
) {
  const input = (
    typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput
  ) as Record<string, any>;
  switch (type) {
    case 'PRICE_RANGE':
      if (input.price.min) params.set('minPrice', input.price.min);
      if (input.price.max) params.set('maxPrice', input.price.max);
      break;
    case 'LIST':
      Object.entries(input).forEach(([key, value]) => {
        if (typeof value === 'string') {
          params.set(key, value);
        } else if (typeof value === 'boolean') {
          params.set(key, value.toString());
        } else {
          const { name, value: val } = value as { name: string; value: string };
          const allVariants = params.getAll(`variantOption`);
          const newVariant = `${name}:${val}`;
          if (!allVariants.includes(newVariant)) {
            params.append('variantOption', newVariant);
          }
        }
      });
      break;
  }

  return params;
}

export default function SortMenu() {
  const items: { label: string; key: SortParam }[] = [
    { label: 'Featured', key: 'featured' },
    {
      label: 'Price: Low - High',
      key: 'price-low-high',
    },
    {
      label: 'Price: High - Low',
      key: 'price-high-low',
    },
    {
      label: 'Best Selling',
      key: 'best-selling',
    },
    {
      label: 'Newest',
      key: 'newest',
    },
  ];
  const [params] = useSearchParams();
  const location = useLocation();
  const activeItem = items.find((item) => item.key === params.get('sort'));

  return (
    <AccordionItem value="sorting">
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <span>Sort By</span>
          <Badge variant="secondary">
            {(activeItem || items[0]).label}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <Button asChild key={item.label} variant={(activeItem?.key || items[0]?.key) === item.key ? 'default' : 'ghost'} className="justify-start w-full">
              <Link to={getSortLink(item.key, params, location)}>
                {item.label}
              </Link>
            </Button>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
