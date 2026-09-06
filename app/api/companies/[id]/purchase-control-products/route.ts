import { NextResponse } from "next/server";
import { GraphQLRequestError } from "@/lib/graphql/client";
import { getCompanyCatalogProducts } from "@/lib/graphql/company-catalog-products";

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return NextResponse.json({ error: "Invalid company ID." }, { status: 400 });
  }

  const url = new URL(request.url);
  const currentPage = positiveInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(100, positiveInt(url.searchParams.get("pageSize"), 50));
  const search = url.searchParams.get("search")?.trim() || undefined;

  try {
    const products = await getCompanyCatalogProducts(companyId, currentPage, pageSize, search);
    return NextResponse.json(products, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof GraphQLRequestError && error.status === 401) {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Product search failed." },
      { status: 403 },
    );
  }
}
