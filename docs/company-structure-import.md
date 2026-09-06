# Company structure CSV import

The Unlimited Admin bulk-import surface supports a dedicated parent/child company relationship file.

## Format

The file has exactly two columns:

```csv
company_reference,parent_reference
```

Rules:

- `company_reference` identifies the company whose parent is being set.
- `parent_reference` identifies its parent company.
- leave `parent_reference` blank to make the company a root/standalone company.
- references are matched case-insensitively but must be unique in the visible Magento company scope.
- each `company_reference` may appear only once in a file.
- unknown companies/parents, self-parenting and hierarchy cycles are preview errors and block Apply.
- Apply changes only `parent_company_id`; the current company settings are re-read immediately before each write and all other Magento-local settings are preserved.

The current-structure export fails rather than representing a hidden/out-of-scope parent as a blank root. This prevents a scoped administrator from downloading and accidentally re-importing a structurally destructive file.

## MOR012 group example

For a structure where MOR012 is the group head and the listed companies are direct children:

```csv
company_reference,parent_reference
MOR012,
AMS005,MOR012
AMS006,MOR012
AMS007,MOR012
MEP001,MOR012
MOR013,MOR012
MOR014,MOR012
MOR015,MOR012
MOR016,MOR012
MOR017,MOR012
MOR018,MOR012
MOR020,MOR012
MOR021,MOR012
MOR022,MOR012
MOR023,MOR012
MOR024,MOR012
MOR025,MOR012
MOR026,MOR012
MOR027,MOR012
MOR028,MOR012
MOR029,MOR012
MOR030,MOR012
MOR031,MOR012
MOR032,MOR012
MOR033,MOR012
MOR034,MOR012
MOR035,MOR012
MOR036,MOR012
MOR037,MOR012
MOR038,MOR012
MOR039,MOR012
MOR040,MOR012
MOR041,MOR012
MOR042,MOR012
MOR043,MOR012
```

This deliberately omits MOR019 because it was not part of the supplied structure list.

## Re-parenting

A file may reorganize several branches at once. Preview validates the final proposed graph. During Apply, companies whose parent changes are detached first and then attached to the requested parents. This avoids transient cycles while moving branches.

Example:

```csv
company_reference,parent_reference
MOR014,MOR012
MOR020,MOR014
```

Here MOR014 is a child of MOR012 and MOR020 becomes a child of MOR014.

## Preview and apply

Always use **Preview CSV** first. The preview reports each row as `Updated`, `Skipped` or `Error`. Apply remains disabled when preview errors exist or when the file contains no actual changes.
