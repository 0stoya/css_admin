import { Buffer } from "node:buffer";
import { deflateRawSync } from "node:zlib";

export type SnapshotCell = string | number | boolean | null | undefined;
export type SnapshotRowStyle = "normal" | "title" | "section" | "heading" | "note";
export type SnapshotRow = { values: SnapshotCell[]; style?: SnapshotRowStyle };
export type SnapshotSheet = { name: string; rows: SnapshotRow[]; freezeRows?: number; mergeTitle?: boolean };

const MAX_ROWS = 1_048_576;
const MAX_CELL_LENGTH = 32_767;
const MAX_SHEETS = 100;
// The snapshot is generated in memory. Bound it so a giant SKU list cannot
// exhaust the Next.js Admin process; refuse instead of returning partial data.
const MAX_TOTAL_ROWS = 250_000;
const rowStyles: Record<SnapshotRowStyle, number> = { normal: 0, title: 1, section: 2, heading: 3, note: 4 };
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let n = 0; n < 8; n++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ path: string; content: string }>) {
  const local: Buffer[] = [], directory: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const uncompressed = Buffer.from(file.content, "utf8");
    const compressed = deflateRawSync(uncompressed, { level: 6 });
    if ([uncompressed.length, compressed.length, offset].some(n => n >= 0xffffffff)) {
      throw new Error("Snapshot workbook exceeds ZIP format limits.");
    }
    const crc = crc32(uncompressed);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0x0021, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(uncompressed.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0x0021, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(uncompressed.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    directory.push(entry, name);
    offset += header.length + name.length + compressed.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  if (offset + size >= 0xffffffff) throw new Error("Snapshot workbook is too large.");
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...directory, end]);
}

function escapeXml(value: string) {
  // Inline strings make formula-looking emails, names and SKUs inert Excel text.
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(col: number) {
  let result = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  }
  return result;
}

function cellXml(value: SnapshotCell, row: number, col: number, style: number) {
  if (value === undefined || value === null || value === "") return "";
  const ref = columnName(col) + row;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Snapshot contains a non-finite number.");
    return '<c r="' + ref + '" s="' + style + '"><v>' + value + '</v></c>';
  }
  if (typeof value === "boolean") {
    return '<c r="' + ref + '" s="' + style + '" t="b"><v>' + (value ? 1 : 0) + '</v></c>';
  }
  if (value.length > MAX_CELL_LENGTH) throw new Error("Snapshot text exceeds the Excel cell limit.");
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' +
    escapeXml(value) + '</t></is></c>';
}

function worksheetXml(sheet: SnapshotSheet) {
  if (sheet.rows.length > MAX_ROWS) throw new Error("Snapshot sheet exceeds Excel's row limit.");
  const rows = sheet.rows.map((item, i) => {
    const n = i + 1, style = rowStyles[item.style || "normal"];
    const body = item.values.map((value, col) => cellXml(value, n, col + 1, style)).join("");
    const height = item.style === "title" ? ' ht="32" customHeight="1"' :
      item.style === "section" ? ' ht="26" customHeight="1"' :
      item.style === "heading" ? ' ht="24" customHeight="1"' : "";
    return '<row r="' + n + '"' + height + '>' + body + '</row>';
  }).join("");
  const freeze = sheet.freezeRows && sheet.freezeRows > 0 ?
    '<pane ySplit="' + sheet.freezeRows + '" topLeftCell="A' + (sheet.freezeRows + 1) +
    '" activePane="bottomLeft" state="frozen"/>' : "";
  const merge = sheet.mergeTitle ? '<mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells>' : "";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0">' + freeze + '</sheetView></sheetViews>' +
    '<cols><col min="1" max="1" width="19" customWidth="1"/>' +
    '<col min="2" max="2" width="30" customWidth="1"/>' +
    '<col min="3" max="3" width="22" customWidth="1"/>' +
    '<col min="4" max="4" width="43" customWidth="1"/>' +
    '<col min="5" max="5" width="23" customWidth="1"/>' +
    '<col min="6" max="6" width="25" customWidth="1"/>' +
    '<col min="7" max="7" width="22" customWidth="1"/>' +
    '<col min="8" max="8" width="24" customWidth="1"/>' +
    '<col min="9" max="9" width="23" customWidth="1"/>' +
    '<col min="10" max="10" width="23" customWidth="1"/></cols>' +
    '<sheetData>' + rows + '</sheetData>' + merge + '</worksheet>';
}

function uniqueSheetNames(sheets: SnapshotSheet[]) {
  const seen = new Set<string>();
  return sheets.map(sheet => {
    const cleaned = sheet.name.replace(/[\\/\[\]:?*]/g, "-")
      .replace(/^'+|'+$/g, "").trim().slice(0, 31) || "Company";
    let name = cleaned;
    for (let n = 2; seen.has(name.toLocaleLowerCase("en")); n++) {
      name = cleaned.slice(0, 31 - String(n).length - 1) + "-" + n;
    }
    seen.add(name.toLocaleLowerCase("en"));
    return { ...sheet, name };
  });
}

const stylesXml = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<fonts count="4"><font><sz val="10"/><name val="Aptos"/><color rgb="FF163B5D"/></font>',
  '<font><b/><sz val="16"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font>',
  '<font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font>',
  '<font><b/><sz val="10"/><name val="Aptos"/><color rgb="FF163B5D"/></font></fonts>',
  '<fills count="5"><fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF003B70"/><bgColor indexed="64"/></patternFill></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF0964A2"/><bgColor indexed="64"/></patternFill></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF3FB"/><bgColor indexed="64"/></patternFill></fill></fills>',
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
  '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
  '<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
  '<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>',
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/>',
  '</cellStyles></styleSheet>'
].join("");

export function createSnapshotXlsx(inputSheets: SnapshotSheet[]) {
  if (inputSheets.length < 1 || inputSheets.length > MAX_SHEETS) {
    throw new Error("Snapshot must contain between 1 and " + MAX_SHEETS + " sheets.");
  }
  const totalRows = inputSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
  if (totalRows > MAX_TOTAL_ROWS) {
    throw new Error("Snapshot exceeds the " + MAX_TOTAL_ROWS + " row safety limit.");
  }
  const sheets = uniqueSheetNames(inputSheets);
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
      '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
    '</Types>';
  const workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((sheet, i) => '<sheet name="' + escapeXml(sheet.name) + '" sheetId="' + (i + 1) +
      '" r:id="rId' + (i + 1) + '"/>').join("") + '</sheets></workbook>';
  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
      (i + 1) + '.xml"/>').join("") +
    '<Relationship Id="rId' + (sheets.length + 1) +
    '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';
  return zip([
    { path: "[Content_Types].xml", content: contentTypes },
    { path: "_rels/.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { path: "xl/workbook.xml", content: workbookXml },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRels },
    { path: "xl/styles.xml", content: stylesXml },
    ...sheets.map((sheet, i) => ({ path: "xl/worksheets/sheet" + (i + 1) + ".xml", content: worksheetXml(sheet) })),
  ]);
}
