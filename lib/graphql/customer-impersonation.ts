import { graphqlRequest } from "@/lib/graphql/client";

type GenerateCustomerTokenAsAdminData = {
  generateCustomerTokenAsAdmin: {
    customer_token: string;
  };
};

const GENERATE_CUSTOMER_TOKEN_AS_ADMIN = /* GraphQL */ `
  mutation AdminGenerateCustomerToken($email: String!) {
    generateCustomerTokenAsAdmin(input: { customer_email: $email }) {
      customer_token
    }
  }
`;

export async function generateCustomerTokenAsAdmin(email: string) {
  const customerEmail = email.trim();
  if (!customerEmail) throw new Error("Customer email is required.");

  const data = await graphqlRequest<
    GenerateCustomerTokenAsAdminData,
    { email: string }
  >(GENERATE_CUSTOMER_TOKEN_AS_ADMIN, { email: customerEmail });

  const token = data.generateCustomerTokenAsAdmin?.customer_token?.trim();
  if (!token) throw new Error("Magento did not return a customer support token.");
  return token;
}
