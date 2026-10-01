// Single point through which the vendored, offline Three.js build is imported.
// Every first-party module imports THREE from here instead of reaching for a
// CDN, which keeps the "no external resources" guarantee easy to audit.
import * as THREE from "../../vendor/three/three.module.js";

export { THREE };
