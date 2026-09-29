/** A dependency-free UTF-8 ZIP writer and reader for dialogue bundles. */
const encoder = new TextEncoder(), decoder = new TextDecoder();
const table = Uint32Array.from({ length:256 }, (_, i) => { let crc=i; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); return crc>>>0; });
function crc32(data) { let crc=0xffffffff; for(const byte of data) crc=(crc>>>8)^table[(crc^byte)&255]; return (crc^0xffffffff)>>>0; }
const bytes = (size, fn) => { const data = new Uint8Array(size); fn(new DataView(data.buffer)); return data; };
const encode = value => typeof value === 'string' ? encoder.encode(value) : value;

async function transform(data, stream) {
  return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer());
}

function assemble(entries) {
  const chunks=[], directory=[]; let offset=0;
  for (const { name, stored, crc, size, method } of entries) {
    const local=bytes(30,v=>{v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(8,method,true);v.setUint32(14,crc,true);v.setUint32(18,stored.length,true);v.setUint32(22,size,true);v.setUint16(26,name.length,true);});
    const central=bytes(46,v=>{v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(10,method,true);v.setUint32(16,crc,true);v.setUint32(20,stored.length,true);v.setUint32(24,size,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);});
    chunks.push(local,name,stored); directory.push(central,name); offset+=local.length+name.length+stored.length;
  }
  const size=directory.reduce((n,b)=>n+b.length,0), count=entries.length;
  const end=bytes(22,v=>{v.setUint32(0,0x06054b50,true);v.setUint16(8,count,true);v.setUint16(10,count,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);});
  return new Blob([...chunks,...directory,end],{type:'application/zip'});
}

/** Uncompressed archive; synchronous so small exports and tests need no stream support. */
export function zip(files) {
  return assemble(Object.entries(files).map(([path, text]) => {
    const data = encode(text);
    return { name: encoder.encode(path), stored: data, crc: crc32(data), size: data.length, method: 0 };
  }));
}

/** Deflated archive where the browser supports it; falls back to storing each file. */
export async function zipCompressed(files) {
  const deflate = typeof CompressionStream === 'function';
  const entries = [];
  for (const [path, text] of Object.entries(files)) {
    const data = encode(text), packed = deflate && data.length > 256 ? await transform(data, new CompressionStream('deflate-raw')) : null;
    const smaller = packed && packed.length < data.length;
    entries.push({ name: encoder.encode(path), stored: smaller ? packed : data, crc: crc32(data), size: data.length, method: smaller ? 8 : 0 });
  }
  return assemble(entries);
}

/** Reads stored and deflated entries. Returns `{ path: Uint8Array }`, skipping folders. */
export async function unzip(input, { maxEntries = 20000, maxBytes = 256 * 1024 * 1024 } = {}) {
  const buffer = input instanceof ArrayBuffer ? input : input instanceof Uint8Array ? input.slice().buffer : await input.arrayBuffer();
  const view = new DataView(buffer), data = new Uint8Array(buffer);
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw Error('Not a ZIP file.');
  const count = view.getUint16(end + 10, true), start = view.getUint32(end + 16, true);
  if (count === 0xffff || start === 0xffffffff) throw Error('ZIP64 archives are not supported.');
  if (count > maxEntries) throw Error(`A ZIP may contain at most ${maxEntries} files.`);
  const files = {};
  let pointer = start, total = 0;
  for (let n = 0; n < count; n++) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw Error('The ZIP directory is damaged.');
    const method = view.getUint16(pointer + 10, true), packedSize = view.getUint32(pointer + 20, true), size = view.getUint32(pointer + 24, true);
    const nameLength = view.getUint16(pointer + 28, true), extraLength = view.getUint16(pointer + 30, true), commentLength = view.getUint16(pointer + 32, true);
    const local = view.getUint32(pointer + 42, true);
    const name = decoder.decode(data.subarray(pointer + 46, pointer + 46 + nameLength)).replaceAll('\\', '/');
    pointer += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue;
    total += size;
    if (total > maxBytes) throw Error('The ZIP is too large to import.');
    const body = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const packed = data.subarray(body, body + packedSize);
    if (method === 0) files[name] = packed.slice();
    else if (method === 8) {
      if (typeof DecompressionStream !== 'function') throw Error('This browser cannot read compressed ZIP files.');
      files[name] = await transform(packed, new DecompressionStream('deflate-raw'));
    } else throw Error(`${name}: unsupported ZIP compression.`);
  }
  return files;
}

export const decodeText = value => decoder.decode(value);
