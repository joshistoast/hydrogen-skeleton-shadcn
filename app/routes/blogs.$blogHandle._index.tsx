import {json, type LoaderArgs} from '@shopify/remix-oxygen';
import { Link, useLoaderData, type V2_MetaFunction } from '@remix-run/react';
import {Image, Pagination, getPaginationVariables} from '@shopify/hydrogen';
import type {ArticleItemFragment} from 'storefrontapi.generated';
import { Card, CardContent, CardFooter } from '~/components/ui/card';
import { buttonVariants } from '~/components/ui/button';
import { Icon } from '@iconify/react';

export const meta: V2_MetaFunction = ({data}) => {
  return [{title: `Hydrogen | ${data.blog.title} blog`}];
};

export const loader = async ({
  request,
  params,
  context: {storefront},
}: LoaderArgs) => {
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 4,
  });

  if (!params.blogHandle) {
    throw new Response(`blog not found`, {status: 404});
  }

  const {blog} = await storefront.query(BLOGS_QUERY, {
    variables: {
      blogHandle: params.blogHandle,
      ...paginationVariables,
    },
  });

  if (!blog?.articles) {
    throw new Response('Not found', {status: 404});
  }

  return json({blog});
};

export default function Blog() {
  const {blog} = useLoaderData<typeof loader>();
  const {articles} = blog;

  return (
    <div className="container p-4 mx-auto">
      <div className="flex flex-col gap-4">
        <h1>{blog.title}</h1>
        <Pagination connection={articles}>
          {({nodes, isLoading, PreviousLink, NextLink}) => {
            return (
              <>
                <div className="flex justify-center w-full">
                  <PreviousLink className={buttonVariants({ variant: 'default' })} aria-disabled={isLoading}>
                    {isLoading
                      ? (<>
                        <Icon icon="lucide:loader-2" className="w-4 h-4 mr-2 animate-spin" />
                        <span>Loading previous...</span>
                      </>)
                      : (<>
                        <Icon icon="lucide:arrow-up" className="w-4 h-4 mr-2" />
                        <span>Load previous</span>
                      </>)
                    }
                  </PreviousLink>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {nodes.map((article, index) => {
                    return (
                      <ArticleItem
                        article={article}
                        key={article.id}
                        loading={index < 2 ? 'eager' : 'lazy'}
                      />
                    );
                  })}
                </div>

                <div className="flex justify-center w-full">
                  <NextLink className={buttonVariants({ variant: 'default' })} aria-disabled={isLoading}>
                    {isLoading
                      ? (<>
                        <Icon icon="lucide:loader-2" className="w-4 h-4 mr-2 animate-spin" />
                        <span>Loading more...</span>
                      </>)
                      : (<>
                        <Icon icon="lucide:arrow-down" className="w-4 h-4 mr-2" />
                        <span>Load more</span>
                      </>)
                    }
                  </NextLink>
                </div>
              </>
            );
          }}
        </Pagination>
      </div>
    </div>
  );
}

function ArticleItem({
  article,
  loading,
}: {
  article: ArticleItemFragment;
  loading?: HTMLImageElement['loading'];
}) {
  const publishedAt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(article.publishedAt!));
  return (
    <Card key={article.id} className="flex flex-col">
      <CardContent className="flex-1 p-6">
        {article.image && (
          <div className="w-full mb-4">
            <Image
              alt={article.image.altText || article.title}
              aspectRatio="3/2"
              data={article.image}
              loading={loading}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover w-full h-full aspect-[3/2]"
            />
          </div>
        )}
        <h3>{article.title}</h3>
        <small className="text-muted-foreground">{publishedAt}</small>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Link className={buttonVariants({ variant: 'link' })} to={`/blogs/${article.blog.handle}/${article.handle}`}>
          <span>Read More</span>
          <Icon icon="lucide:arrow-right" className="w-4 h-4 ml-2" />
        </Link>
      </CardFooter>
    </Card>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog
const BLOGS_QUERY = `#graphql
  query Blog(
    $language: LanguageCode
    $blogHandle: String!
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(language: $language) {
    blog(handle: $blogHandle) {
      title
      seo {
        title
        description
      }
      articles(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
        reverse: true
      ) {
        nodes {
          ...ArticleItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          hasNextPage
          startCursor
          endCursor
        }
      }
    }
  }
  fragment ArticleItem on Article {
    author: authorV2 {
      name
    }
    contentHtml
    handle
    id
    image {
      id
      altText
      url
      width
      height
    }
    publishedAt
    title
    blog {
      handle
    }
  }
` as const;
