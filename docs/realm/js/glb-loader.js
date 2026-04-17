// ════════════════════════════════════════════════════════════
// Minimal GLB geometry extractor for vanilla WebGL2
// Returns raw {positions, normals, indices} arrays so callers
// can inline the geometry into an existing VBO at any transform.
// No GPU upload here — keeps the caller in control of VAOs.
// ════════════════════════════════════════════════════════════

const GLTF_FLOAT          = 5126;
const GLTF_UNSIGNED_SHORT = 5123;
const GLTF_UNSIGNED_INT   = 5125;
const COMPONENT_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const COMPONENT_BYTES = { [GLTF_FLOAT]: 4, [GLTF_UNSIGNED_SHORT]: 2, [GLTF_UNSIGNED_INT]: 4 };

// Returns { positions: Float32Array (x,y,z…), normals: Float32Array (nx,ny,nz…),
//           indices: Uint16Array|Uint32Array }
export async function loadGLBGeometry(url) {
  const buf  = await fetch(url).then(r => r.arrayBuffer());
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== 0x46546C67) throw new Error(`Not GLB: ${url}`);

  const jsonLen = view.getUint32(12, true);
  const gltf    = JSON.parse(new TextDecoder().decode(buf.slice(20, 20 + jsonLen)));

  const binBase = 20 + jsonLen + 8; // skip BIN chunk header
  const binData = buf;               // keep full buffer, use absolute offsets

  // Collect all primitives from first mesh
  const mesh = gltf.meshes?.[0];
  if (!mesh) throw new Error(`No meshes in GLB: ${url}`);

  // Merge all primitives into one geometry set
  const allPos = [], allNorm = [], allIdx = [];
  let vertexBase = 0;

  for (const prim of mesh.primitives) {
    const posAcc  = gltf.accessors[prim.attributes['POSITION']];
    const normAcc = prim.attributes['NORMAL'] !== undefined
      ? gltf.accessors[prim.attributes['NORMAL']] : null;

    const positions = readAccessor(gltf, binData, binBase, posAcc, 3);
    const normals   = normAcc
      ? readAccessor(gltf, binData, binBase, normAcc, 3)
      : defaultNormals(posAcc.count);

    allPos.push(...positions);
    allNorm.push(...normals);

    if (prim.indices !== undefined) {
      const idxAcc = gltf.accessors[prim.indices];
      const raw    = readAccessorRaw(gltf, binData, binBase, idxAcc);
      for (let i = 0; i < raw.length; i++) allIdx.push(raw[i] + vertexBase);
    } else {
      for (let i = 0; i < posAcc.count; i++) allIdx.push(i + vertexBase);
    }
    vertexBase += posAcc.count;
  }

  return {
    positions: new Float32Array(allPos),
    normals:   new Float32Array(allNorm),
    indices:   new Uint32Array(allIdx),
  };
}

function readAccessor(gltf, buf, binBase, acc, stride) {
  const bv       = gltf.bufferViews[acc.bufferView];
  const offset   = binBase + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const byteStride = bv.byteStride || (stride * 4);
  const view     = new DataView(buf);
  const out      = [];
  for (let i = 0; i < acc.count; i++) {
    const base = offset + i * byteStride;
    for (let j = 0; j < stride; j++) out.push(view.getFloat32(base + j * 4, true));
  }
  return out;
}

function readAccessorRaw(gltf, buf, binBase, acc) {
  const bv     = gltf.bufferViews[acc.bufferView];
  const offset = binBase + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  if (acc.componentType === GLTF_UNSIGNED_INT)
    return new Uint32Array(buf, offset, acc.count);
  if (acc.componentType === GLTF_UNSIGNED_SHORT)
    return new Uint16Array(buf, offset, acc.count);
  return new Uint8Array(buf, offset, acc.count);
}

function defaultNormals(count) {
  const out = new Array(count * 3);
  for (let i = 0; i < count; i++) { out[i*3]=0; out[i*3+1]=1; out[i*3+2]=0; }
  return out;
}
