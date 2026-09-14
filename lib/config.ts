function required(name: "MAGENTO_BASE_URL" | "MAGENTO_STORE_CODE") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function requiredOrigin(name: "CSS_STORE_URL") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);

  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol)
    || url.username
    || url.password
    || (url.pathname !== "/" && url.pathname !== "")
    || url.search
    || url.hash
  ) {
    throw new Error(`${name} must be a clean absolute origin.`);
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  url.pathname = "/";
  return withoutTrailingSlash(url.toString());
}

export function getMagentoConfig() {
  const baseUrl = withoutTrailingSlash(required("MAGENTO_BASE_URL"));
  const storeCode = required("MAGENTO_STORE_CODE");

  return {
    baseUrl,
    storeCode,
    graphqlUrl: process.env.MAGENTO_GRAPHQL_URL?.trim() || `${baseUrl}/graphql`,
    adminTokenUrl: process.env.MAGENTO_ADMIN_TOKEN_URL?.trim() || `${baseUrl}/rest/V1/integration/admin/token`,
    customerTokenUrl: process.env.MAGENTO_CUSTOMER_TOKEN_URL?.trim() || `${baseUrl}/rest/V1/integration/customer/token`,
  };
}

export function getStorefrontUrl() {
  return requiredOrigin("CSS_STORE_URL");
}
