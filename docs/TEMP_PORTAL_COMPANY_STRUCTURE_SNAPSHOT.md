# TEMPORARY: Portal company-structure snapshot bridge

> **Quick-and-dirty presentation patch. Remove after the Fluid customer-authorised hierarchy API is deployed.**

This bridge exists only because the live Fluid deployment cannot be changed during the presentation window.

It must **not** become the permanent company-structure data source.

## Why this exists

The Admin application already receives `parent_company_id` from the Magento Admin GraphQL company surface. The customer Portal does not currently receive hierarchy information from `css_company_context`.

Rather than expose Admin GraphQL credentials or weaken customer authorization, the Portal reads a short-lived server-only JSON snapshot and renders only the structure containing the authenticated company administrator's selected company.

The route remains read-only.

## Runtime file

Default path:

```text
/etc/css-admin/portal-company-structure.json
```

Optional override:

```text
CSS_ADMIN_PORTAL_STRUCTURE_SNAPSHOT=/etc/css-admin/portal-company-structure.json
```

The file is read by the Next.js server. Do not place it under `public/`, do not commit live customer data to this repository, and do not expose it from nginx.

Expected format:

```json
{
  "kind": "temporary-portal-company-structure-snapshot-v1",
  "generated_at": "2026-10-02T08:00:00Z",
  "expires_at": "2026-10-10T23:59:59Z",
  "group_finance_company_ids": [496],
  "portal_titles": {
    "496": "BioMarch Main",
    "5275": "BioMarch North"
  },
  "companies": [
    {
      "company_id": 496,
      "reference": "BI0002",
      "status": true,
      "name": "BioMarsh Environmental Ltd",
      "sales_representative_id": 8,
      "parent_company_id": null
    }
  ]
}
```

The reader fails closed when the file is missing, malformed, expired, or has a lifetime greater than 14 days.

`portal_titles` is presentation-only metadata used to label header switch destinations before the user changes company. It does not grant access; switch authorization still comes from the customer's Fluid company memberships.

`group_finance_company_ids` is an explicit presentation-only allowlist for group-head finance. An ID only enables aggregation when that selected company is the canonical root of a multi-company structure. Child companies never inherit group finance from the snapshot.

For the presentation bridge, the snapshot should contain **only the company structures deliberately approved for the presentation**, not the whole company database.

## Authorization boundary

The temporary route:

- is visible only when `css_company_admin.is_company_admin` is true;
- checks that the administration company matches the selected company;
- is read-only;
- never calls the Admin GraphQL API with the customer token;
- never stores an Admin token in Portal;
- never grants company switching or membership;
- only exposes group finance for a company-admin selected canonical group head that is explicitly listed in `group_finance_company_ids`;
- treats missing child finance snapshots as **missing**, never as zero spend.

The snapshot is presentation data only. It is not an authorization source. The company-admin check still comes from Fluid.

## One-off snapshot generation

A helper is included only for the presentation bridge. It requires a short-lived Magento Admin token at execution time and never stores that token in the snapshot:

```bash
cd /srv/css/css_admin
export CSS_ADMIN_SNAPSHOT_ADMIN_TOKEN='PASTE_SHORT_LIVED_ADMIN_TOKEN'

# Run this as the same Unix user that owns the PM2/Next.js process.
# Do not assume a dedicated css_admin Unix account exists on every host.
node scripts/portal-structure-snapshot.mjs \
  --company-ref BI0002 \
  --allow-group-finance \
  --expires 2026-10-09T23:00:00Z \
  --output /etc/css-admin/portal-company-structure.json

unset CSS_ADMIN_SNAPSHOT_ADMIN_TOKEN
```

Use `--allow-group-finance` only when `--company-ref` is the canonical group head. The script refuses to grant it to a child company. The runtime file is written mode `0600`.

## Removal condition

Delete this bridge as soon as Fluid exposes a customer-authorised hierarchy contract.

Permanent implementation should:

1. add a Fluid customer hierarchy query;
2. authorize the selected company and company administrator in Fluid;
3. return the permitted parent/child structure from Fluid;
4. switch `/portal/company-structure` to that API;
5. delete `lib/temporary-portal-company-structure.ts`;
6. remove `CSS_ADMIN_PORTAL_STRUCTURE_SNAPSHOT`;
7. delete this document and the runtime JSON file.

If this file is still here after the Fluid hierarchy deployment, it has overstayed its welcome.
