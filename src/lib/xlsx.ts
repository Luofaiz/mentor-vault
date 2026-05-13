const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

interface ZipEntry {
  filename: string;
  data: Uint8Array;
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}

function buildZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder();
  const localFiles: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;
  const { time, date } = dosDateTime();

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.filename);
    const data = entry.data;
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, time);
    writeUint16(localHeader, 12, date);
    writeUint32(localHeader, 14, checksum);
    writeUint32(localHeader, 18, data.length);
    writeUint32(localHeader, 22, data.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    localFiles.push(localHeader, data);

    const directoryHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(directoryHeader, 0, 0x02014b50);
    writeUint16(directoryHeader, 4, 20);
    writeUint16(directoryHeader, 6, 20);
    writeUint16(directoryHeader, 8, 0);
    writeUint16(directoryHeader, 10, 0);
    writeUint16(directoryHeader, 12, time);
    writeUint16(directoryHeader, 14, date);
    writeUint32(directoryHeader, 16, checksum);
    writeUint32(directoryHeader, 20, data.length);
    writeUint32(directoryHeader, 24, data.length);
    writeUint16(directoryHeader, 28, nameBytes.length);
    writeUint16(directoryHeader, 30, 0);
    writeUint16(directoryHeader, 32, 0);
    writeUint16(directoryHeader, 34, 0);
    writeUint16(directoryHeader, 36, 0);
    writeUint32(directoryHeader, 38, 0);
    writeUint32(directoryHeader, 42, offset);
    directoryHeader.set(nameBytes, 46);
    centralDirectory.push(directoryHeader);

    offset += localHeader.length + data.length;
  });

  const centralSize = centralDirectory.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  writeUint32(endHeader, 0, 0x06054b50);
  writeUint16(endHeader, 4, 0);
  writeUint16(endHeader, 6, 0);
  writeUint16(endHeader, 8, entries.length);
  writeUint16(endHeader, 10, entries.length);
  writeUint32(endHeader, 12, centralSize);
  writeUint32(endHeader, 16, offset);
  writeUint16(endHeader, 20, 0);

  return new Blob([...localFiles, ...centralDirectory, endHeader], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function columnName(index: number) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function buildSheetXml(rows: string[][]) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function parseXmlDocument(text: string, mimeType: DOMParserSupportedType) {
  const documentNode = new DOMParser().parseFromString(text, mimeType);
  if (documentNode.querySelector('parsererror')) {
    throw new Error('Invalid XML content.');
  }
  return documentNode;
}

function decodeZipName(bytes: Uint8Array, utf8: boolean) {
  if (utf8) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  let result = '';
  for (const byte of bytes) {
    result += String.fromCharCode(byte);
  }
  return result;
}

async function inflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is not available in this runtime.');
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function unzipEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let endOffset = -1;

  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }

  if (endOffset < 0) {
    throw new Error('Invalid XLSX file: missing ZIP central directory.');
  }

  const entryCount = readUint16(view, endOffset + 10);
  const centralDirectoryOffset = readUint32(view, endOffset + 16);
  const files = new Map<string, Uint8Array>();
  let cursor = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (readUint32(view, cursor) !== 0x02014b50) {
      throw new Error('Invalid XLSX file: malformed ZIP entry.');
    }

    const flags = readUint16(view, cursor + 8);
    const compressionMethod = readUint16(view, cursor + 10);
    const compressedSize = readUint32(view, cursor + 20);
    const fileNameLength = readUint16(view, cursor + 28);
    const extraFieldLength = readUint16(view, cursor + 30);
    const commentLength = readUint16(view, cursor + 32);
    const localHeaderOffset = readUint32(view, cursor + 42);
    const fileNameBytes = bytes.slice(cursor + 46, cursor + 46 + fileNameLength);
    const filename = decodeZipName(fileNameBytes, (flags & 0x0800) !== 0);

    const localFileNameLength = readUint16(view, localHeaderOffset + 26);
    const localExtraLength = readUint16(view, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);

    let data: Uint8Array;
    if (compressionMethod === 0) {
      data = compressedData;
    } else if (compressionMethod === 8) {
      data = await inflateRaw(compressedData);
    } else {
      throw new Error(`Unsupported XLSX compression method: ${compressionMethod}`);
    }

    files.set(filename, data);
    cursor += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return files;
}

function resolveZipPath(basePath: string, target: string) {
  const normalizedBase = basePath.replace(/\\/g, '/');
  const baseSegments = normalizedBase.split('/').slice(0, -1);

  target.replace(/\\/g, '/').split('/').forEach((segment) => {
    if (!segment || segment === '.') {
      return;
    }
    if (segment === '..') {
      baseSegments.pop();
      return;
    }
    baseSegments.push(segment);
  });

  return baseSegments.join('/');
}

function getRelationshipTarget(files: Map<string, Uint8Array>, workbookPath: string, relationshipId: string) {
  const relsPath = resolveZipPath(workbookPath, '_rels/workbook.xml.rels');
  const relsBuffer = files.get(relsPath);
  if (!relsBuffer) {
    throw new Error('Invalid XLSX file: workbook relationships missing.');
  }

  const relsText = new TextDecoder('utf-8').decode(relsBuffer);
  const relsXml = parseXmlDocument(relsText, 'application/xml');
  const relation = Array.from(relsXml.getElementsByTagNameNS('*', 'Relationship')).find(
    (node) => node.getAttribute('Id') === relationshipId,
  );

  if (!relation) {
    throw new Error('Invalid XLSX file: worksheet relationship not found.');
  }

  return resolveZipPath(workbookPath, relation.getAttribute('Target') ?? '');
}

function getCellText(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute('t') ?? '';
  if (type === 'inlineStr') {
    return Array.from(cell.getElementsByTagNameNS('*', 't'))
      .map((node) => node.textContent ?? '')
      .join('');
  }

  const valueNode = cell.getElementsByTagNameNS('*', 'v')[0];
  const rawValue = valueNode?.textContent ?? '';
  if (type === 's') {
    return sharedStrings[Number(rawValue) || 0] ?? '';
  }
  if (type === 'b') {
    return rawValue === '1' ? 'TRUE' : 'FALSE';
  }
  return rawValue;
}

function columnIndexFromRef(reference: string) {
  const letters = reference.match(/[A-Z]+/i)?.[0] ?? 'A';
  let index = 0;
  for (const letter of letters.toUpperCase()) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function parseSharedStrings(files: Map<string, Uint8Array>) {
  const sharedStringsBuffer = files.get('xl/sharedStrings.xml');
  if (!sharedStringsBuffer) {
    return [];
  }

  const text = new TextDecoder('utf-8').decode(sharedStringsBuffer);
  const xml = parseXmlDocument(text, 'application/xml');
  return Array.from(xml.getElementsByTagNameNS('*', 'si')).map((node) =>
    Array.from(node.getElementsByTagNameNS('*', 't'))
      .map((item) => item.textContent ?? '')
      .join(''),
  );
}

function parseWorksheetRows(sheetXml: Document, sharedStrings: string[]) {
  return Array.from(sheetXml.getElementsByTagNameNS('*', 'row')).map((row) => {
    const values: string[] = [];

    Array.from(row.getElementsByTagNameNS('*', 'c')).forEach((cell) => {
      const index = columnIndexFromRef(cell.getAttribute('r') ?? 'A1');
      while (values.length < index) {
        values.push('');
      }
      values[index] = getCellText(cell, sharedStrings);
    });

    return values;
  });
}

export async function parseWorkbookRows(input: Blob | ArrayBuffer) {
  const buffer = input instanceof Blob ? await input.arrayBuffer() : input;
  const files = await unzipEntries(buffer);
  const workbookPath = 'xl/workbook.xml';
  const workbookBuffer = files.get(workbookPath);
  if (!workbookBuffer) {
    throw new Error('Invalid XLSX file: workbook.xml missing.');
  }

  const workbookText = new TextDecoder('utf-8').decode(workbookBuffer);
  const workbookXml = parseXmlDocument(workbookText, 'application/xml');
  const firstSheet = workbookXml.getElementsByTagNameNS('*', 'sheet')[0];
  if (!firstSheet) {
    return [];
  }

  const relationshipId =
    firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
    firstSheet.getAttribute('r:id') ??
    '';
  const worksheetPath = getRelationshipTarget(files, workbookPath, relationshipId);
  const worksheetBuffer = files.get(worksheetPath);
  if (!worksheetBuffer) {
    throw new Error('Invalid XLSX file: worksheet missing.');
  }

  const worksheetText = new TextDecoder('utf-8').decode(worksheetBuffer);
  const worksheetXml = parseXmlDocument(worksheetText, 'application/xml');
  const sharedStrings = parseSharedStrings(files);
  return parseWorksheetRows(worksheetXml, sharedStrings);
}

export function createWorkbookBlob(rows: string[][]) {
  const encoder = new TextEncoder();
  const files: ZipEntry[] = [
    {
      filename: '[Content_Types].xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    },
    {
      filename: '_rels/.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      filename: 'xl/workbook.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Professors" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`),
    },
    {
      filename: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    },
    {
      filename: 'xl/styles.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
    },
    {
      filename: 'xl/worksheets/sheet1.xml',
      data: encoder.encode(buildSheetXml(rows)),
    },
  ];

  return buildZip(files);
}
