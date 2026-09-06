# CSS Commerce UI / UX foundation

## Brand source

The management UI follows the existing CSS Commerce website identity rather than introducing a separate admin brand.

### Canonical logo

- repository asset: `public/css-logo.png`
- application URL: `/css-logo.png`
- preserve the original aspect ratio; do not stretch or recolour the source image

### Core colour tokens

| Token | Value | Use |
| --- | --- | --- |
| Primary | `#0057A8` | primary actions, links, navigation, focus context |
| Secondary | `#FFDD00` | active/accent marker and high-visibility brand detail |
| Text | `#002348` | primary text and headings |
| Accent | `#F4F4F4` | application/page background |

The UI may use derived tints/shades for hover, borders and status surfaces, while keeping the four source colours authoritative.

### Typography

The CSS Commerce website uses:

- primary UI/body: Roboto, 400/500/600
- secondary/display: Roboto Slab, 400

The application CSS uses those family names with safe local/system fallbacks and does not add a remote font dependency to the production build. If exact self-hosted font files are added to the repository later, they can replace the fallback without changing component semantics.

## Foundation principles

1. Keep Fluid/Magento authorization and validation backend-authoritative.
2. Reuse one CSS Commerce shell for Staff and Company Portal; distinguish product context with a small label and capability-driven navigation.
3. Use the yellow brand colour as an accent, not as large body copy or primary button fill.
4. Keep destructive actions visually and structurally distinct.
5. Preserve readable data density for operational screens; visual refinement must not turn management tables into oversized marketing cards.
6. Every interactive element must have a visible keyboard focus state.
7. Responsive behaviour should preserve access to every authorized navigation/action without relying on hover.

## UI refinement sequence

### 1. Brand foundation

- branded login
- reusable Staff / Company Portal header
- colour and typography tokens
- base buttons, fields, cards, tables, badges, notices and focus states
- wider responsive content container for operational data

### 2. Company navigation and overview

- company list/search/pagination
- company detail information hierarchy
- management-area navigation
- scoped/restricted states

### 3. Company management

- users and roles
- permission/resource tree
- catalogue visibility and SKU selectors
- purchase-control templates and assignments

### 4. Data portability and commercial surfaces

- import/export upload and preview flow
- payment, credit and pricing presentation
- credit-order queue/detail and lifecycle history
- OGL administration and rep selectors

### 5. Final accessibility/responsive pass

- keyboard and focus order
- mobile/tablet layouts
- empty/loading/error consistency
- dialog/confirmation patterns
- table overflow and long-record usability
