// Geometry construction helpers.
//
// The desk alone would otherwise be dozens of meshes, so most static detail
// is merged into a handful of BufferGeometries.  These helpers build raw
// THREE geometry and combine it without pulling in any network-hosted addon.

import { THREE } from "../core/three-import.js";

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();

export function transformMatrix(transform = {}) {
  const p = transform.position || [0, 0, 0];
  const r = transform.rotation || [0, 0, 0];
  const s = transform.scale ?? 1;
  _euler.set(r[0], r[1], r[2]);
  _quat.setFromEuler(_euler);
  _pos.set(p[0], p[1], p[2]);
  if (typeof s === "number") _scale.set(s, s, s);
  else _scale.set(s[0], s[1], s[2]);
  return new THREE.Matrix4().compose(_pos, _quat, _scale);
}

/** Wrap a geometry + placement for later merging. */
export function part(geometry, transform = {}) {
  return { geometry, transform };
}

function ensureAttribute(geometry, name, size) {
  if (geometry.getAttribute(name)) return;
  const count = geometry.getAttribute("position").count;
  const array = new Float32Array(count * size);
  geometry.setAttribute(name, new THREE.BufferAttribute(array, size));
}

/**
 * Merge a list of parts into one BufferGeometry (non-indexed).  Returns null
 * for an empty list so callers can skip creating a mesh.
 */
export function mergeParts(parts) {
  if (!parts.length) return null;
  const positions = [];
  const normals = [];
  const uvs = [];

  for (const { geometry, transform } of parts) {
    let g = geometry.clone();
    if (g.index) g = g.toNonIndexed();
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    ensureAttribute(g, "uv", 2);
    if (transform) g.applyMatrix4(transformMatrix(transform));

    const pos = g.getAttribute("position").array;
    const nor = g.getAttribute("normal").array;
    const uv = g.getAttribute("uv").array;
    for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
    for (let i = 0; i < nor.length; i++) normals.push(nor[i]);
    for (let i = 0; i < uv.length; i++) uvs.push(uv[i]);
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.computeBoundingSphere();
  return merged;
}

export function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

export function cylinder(rTop, rBottom, height, radial = 16, open = false) {
  return new THREE.CylinderGeometry(rTop, rBottom, height, radial, 1, open);
}

export function torus(radius, tube, radialSeg = 10, tubularSeg = 28) {
  return new THREE.TorusGeometry(radius, tube, radialSeg, tubularSeg);
}

export function cone(radius, height, radial = 16) {
  return new THREE.ConeGeometry(radius, height, radial);
}

export function sphere(radius, widthSeg = 20, heightSeg = 14) {
  return new THREE.SphereGeometry(radius, widthSeg, heightSeg);
}

export function plane(w, h) {
  return new THREE.PlaneGeometry(w, h);
}

/** Lathe a 2D profile ([x,y] pairs) around the Y axis. */
export function lathe(profile, segments = 20) {
  const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(points, segments);
}

/**
 * A thin ribbon/leaf surface from a grid of points.  `rows` is an array of
 * equal-length arrays of [x,y,z].  Normals are computed afterwards.
 */
export function ribbon(rows) {
  const rowCount = rows.length;
  const colCount = rows[0].length;
  const positions = [];
  const uvs = [];
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const [x, y, z] = rows[r][c];
      positions.push(x, y, z);
      uvs.push(c / (colCount - 1), r / (rowCount - 1));
    }
  }
  const indices = [];
  for (let r = 0; r < rowCount - 1; r++) {
    for (let c = 0; c < colCount - 1; c++) {
      const a = r * colCount + c;
      const b = a + 1;
      const d = a + colCount;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** A stylised leaf: a slightly folded blade with a short stem. */
export function leafGeometry(length = 1, width = 0.42, curl = 0.18) {
  const cols = 7;
  const rows = 5;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1);
    const row = [];
    const widthProfile = Math.sin(Math.PI * Math.min(1, v * 1.08)) ** 0.8;
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1) - 0.5;
      const x = u * width * widthProfile;
      const y = v * length;
      const z = curl * (u * u) + Math.sin(v * Math.PI) * 0.04;
      row.push([x, y, z]);
    }
    grid.push(row);
  }
  return ribbon(grid);
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        for (const key of Object.keys(m)) {
          const value = m[key];
          if (value && value.isTexture) value.dispose();
        }
        m.dispose();
      }
    }
  });
}
