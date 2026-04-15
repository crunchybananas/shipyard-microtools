/**
 * Minimal ZIP file generator using raw ArrayBuffer manipulation.
 * Produces valid ZIP archives without any external dependencies.
 *
 * Supports:
 * - Multiple files with directory structure
 * - Store method (no compression) — keeps it simple and dependency-free
 * - UTF-8 file names
 */

interface ZipEntry {
  path: string;
  data: Uint8Array;
  offset: number;
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Write a 16-bit little-endian value into a DataView.
 */
function write16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

/**
 * Write a 32-bit little-endian value into a DataView.
 */
function write32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

/**
 * CRC-32 computation (standard ZIP CRC).
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a local file header (30 bytes + filename).
 */
function buildLocalHeader(nameBytes: Uint8Array, data: Uint8Array, crc: number): Uint8Array {
  const header = new ArrayBuffer(30 + nameBytes.length);
  const view = new DataView(header);

  write32(view, 0, 0x04034b50);     // Local file header signature
  write16(view, 4, 20);             // Version needed (2.0)
  write16(view, 6, 0x0800);         // General purpose bit flag (UTF-8)
  write16(view, 8, 0);              // Compression method: store
  write16(view, 10, 0);             // Last mod time
  write16(view, 12, 0);             // Last mod date
  write32(view, 14, crc);           // CRC-32
  write32(view, 18, data.length);   // Compressed size
  write32(view, 22, data.length);   // Uncompressed size
  write16(view, 26, nameBytes.length); // Filename length
  write16(view, 28, 0);             // Extra field length

  new Uint8Array(header).set(nameBytes, 30);

  return new Uint8Array(header);
}

/**
 * Build a central directory entry (46 bytes + filename).
 */
function buildCentralEntry(nameBytes: Uint8Array, data: Uint8Array, crc: number, localOffset: number): Uint8Array {
  const entry = new ArrayBuffer(46 + nameBytes.length);
  const view = new DataView(entry);

  write32(view, 0, 0x02014b50);     // Central directory signature
  write16(view, 4, 20);             // Version made by
  write16(view, 6, 20);             // Version needed
  write16(view, 8, 0x0800);         // General purpose bit flag (UTF-8)
  write16(view, 10, 0);             // Compression method: store
  write16(view, 12, 0);             // Last mod time
  write16(view, 14, 0);             // Last mod date
  write32(view, 16, crc);           // CRC-32
  write32(view, 20, data.length);   // Compressed size
  write32(view, 24, data.length);   // Uncompressed size
  write16(view, 28, nameBytes.length); // Filename length
  write16(view, 30, 0);             // Extra field length
  write16(view, 32, 0);             // File comment length
  write16(view, 34, 0);             // Disk number start
  write16(view, 36, 0);             // Internal file attributes
  write32(view, 38, 0);             // External file attributes
  write32(view, 42, localOffset);   // Relative offset of local header

  new Uint8Array(entry).set(nameBytes, 46);

  return new Uint8Array(entry);
}

/**
 * Build end of central directory record (22 bytes).
 */
function buildEndRecord(entryCount: number, centralDirSize: number, centralDirOffset: number): Uint8Array {
  const record = new ArrayBuffer(22);
  const view = new DataView(record);

  write32(view, 0, 0x06054b50);       // End of central directory signature
  write16(view, 4, 0);                // Disk number
  write16(view, 6, 0);                // Disk with central directory
  write16(view, 8, entryCount);       // Entries on this disk
  write16(view, 10, entryCount);      // Total entries
  write32(view, 12, centralDirSize);  // Size of central directory
  write32(view, 16, centralDirOffset); // Offset of central directory
  write16(view, 20, 0);               // Comment length

  return new Uint8Array(record);
}

/**
 * Generate a ZIP file as an ArrayBuffer from a map of file paths to string contents.
 */
export function generateZip(files: Record<string, string>): ArrayBuffer {
  const entries: ZipEntry[] = [];
  const localParts: Uint8Array[] = [];
  let offset = 0;

  // Build local file headers + data
  for (const [path, content] of Object.entries(files)) {
    const data = textToBytes(content);
    const nameBytes = stringToBytes(path);
    const crc = crc32(data);
    const localHeader = buildLocalHeader(nameBytes, data, crc);

    entries.push({ path, data, offset });
    localParts.push(localHeader);
    localParts.push(data);

    offset += localHeader.length + data.length;
  }

  // Build central directory
  const centralDirOffset = offset;
  const centralParts: Uint8Array[] = [];

  for (const entry of entries) {
    const nameBytes = stringToBytes(entry.path);
    const crc = crc32(entry.data);
    const centralEntry = buildCentralEntry(nameBytes, entry.data, crc, entry.offset);
    centralParts.push(centralEntry);
  }

  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = buildEndRecord(entries.length, centralDirSize, centralDirOffset);

  // Concatenate everything
  const totalSize = offset + centralDirSize + endRecord.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;

  for (const part of localParts) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(endRecord, pos);

  return result.buffer;
}
