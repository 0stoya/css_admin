import { getMagentoConfig } from "@/lib/config";

type MagentoErrorBody = {
  message?: string;
};

export async function requestMagentoCustomerToken(username: string, password: string) {
  const { customerTokenUrl } = getMagentoConfig();

  const response = await fetch(customerTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Magento rejected the customer credentials.";
    try {
      const body = (await response.json()) as MagentoErrorBody;
      if (body.message) message = body.message;
    } catch {
      // Keep the safe fallback message; never include credentials or raw response bodies.
    }
    throw new Error(message);
  }

  const token = (await response.json()) as unknown;
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Magento returned an invalid customer token response.");
  }

  return token;
}
