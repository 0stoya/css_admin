import { graphqlRequest } from "@/lib/graphql/client";
import { getCompanyCatalogPolicy } from "@/lib/graphql/catalog-policy";

export type CompanyCatalogProductSearchItem = {
  product_id: number;
  sku: string;
  name: string;
};

export type CompanyCatalogProductSearchResult = {
  total_count: number;
  items: CompanyCatalogProductSearchItem[];
  page_info: {
    page_size: number;
    current_page: number;
    total_pages: number;
  };
};

type MagentoProductsData = {
  products: {
    total_count: number;
    items: Array<{
      id: number;
      sku: string;
      name: string;
    }>;
    page_info: {
      page_size: number;
      current_page: number;
      total_pages: number;
    };
  };
};

const MAGENTO_PUBLIC_PRODUCTS_QUERY = /* GraphQL */ `
  query AdminPublicProducts(
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    products(
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
      filter: { price: { from: "0" } }
    ) {
      total_count
      items {
        id
        sku
        name
      }
      page_info {
        page_size
        current_page
        total_pages
      }
    }
  }
`;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function pagePolicyProducts(
  products: CompanyCatalogProductSearchItem[],
  currentPage: number,
  pageSize: number,
  search?: string,
): CompanyCatalogProductSearchResult {
  const query = normalized(search ?? "");
  const filtered = products
    .filter((product) => {
      if (!query) return true;
      return normalized(product.sku).includes(query) || normalized(product.name).includes(query);
    })
    .sort((left, right) => left.sku.localeCompare(right.sku, "en", { sensitivity: "base" }));

  const totalCount = filtered.length;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  const offset = Math.max(0, currentPage - 1) * pageSize;

  return {
    total_count: totalCount,
    items: filtered.slice(offset, offset + pageSize),
    page_info: {
      page_size: pageSize,
      current_page: currentPage,
      total_pages: totalPages,
    },
  };
}

async function getPublicProducts(
  currentPage: number,
  pageSize: number,
  search?: string,
): Promise<CompanyCatalogProductSearchResult> {
  const data = await graphqlRequest<
    MagentoProductsData,
    { currentPage: number; pageSize: number; search?: string }
  >(MAGENTO_PUBLIC_PRODUCTS_QUERY, {
    currentPage,
    pageSize,
    ...(search?.trim() ? { search: search.trim() } : {}),
  });

  return {
    total_count: data.products.total_count,
    items: data.products.items.map((product) => ({
      product_id: Number(product.id),
      sku: product.sku,
      name: product.name,
    })),
    page_info: data.products.page_info,
  };
}

export async function getCompanyCatalogProducts(
  companyId: number,
  currentPage = 1,
  pageSize = 50,
  search?: string,
): Promise<CompanyCatalogProductSearchResult> {
  const policy = await getCompanyCatalogPolicy(companyId);

  if (policy.product_restriction) {
    return pagePolicyProducts(policy.allowed_products, currentPage, pageSize, search);
  }

  return getPublicProducts(currentPage, pageSize, search);
}
