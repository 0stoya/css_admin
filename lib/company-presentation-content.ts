export type PresentationText = {
  raw: string | null;
  text: string | null;
  legacyPageBuilder: boolean;
};

const PAGE_BUILDER_MARKERS = [
  /data-content-type\s*=/i,
  /data-pb-style\s*=/i,
  /data-appearance\s*=/i,
  /class\s*=\s*["'][^"']*pagebuilder-/i,
  /\{\{\s*media\s+url\s*=/i,
];

const BLOCK_TAGS = /<\/?(?:address|article|aside|blockquote|br|div|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function readableText(value: string) {
  const decoded = decodeHtmlEntities(value);

  return decoded
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ")
    .replace(/\{\{[\s\S]*?\}\}/g, " ")
    .replace(BLOCK_TAGS, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isLegacyPageBuilderContent(value: string | null | undefined) {
  if (!value?.trim()) return false;
  return PAGE_BUILDER_MARKERS.some((marker) => marker.test(value));
}

export function presentationText(value: string | null | undefined): PresentationText {
  const raw = value?.trim() || null;
  if (!raw) {
    return {
      raw: null,
      text: null,
      legacyPageBuilder: false,
    };
  }

  const legacyPageBuilder = isLegacyPageBuilderContent(raw);
  const text = /<[^>]+>|\{\{[\s\S]*?\}\}|&(?:lt|gt|amp|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/i.test(raw)
    ? readableText(raw)
    : raw;

  return {
    raw,
    text: text || null,
    legacyPageBuilder,
  };
}
