// Renders the knight and crown sprites for every art style and posts them to art/save-server.mjs.
// Open /art/studio.html on the Vite dev server with the save server running.
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import {
  KNIGHT_HEAD,
  KNIGHT_EYE,
  KNIGHT_NOSTRIL,
  CROWN_POINTS,
  CROWN_BAND,
  CROWN_BALLS,
  CROWN_GEMS
} from "./shapes.mjs";

const SIZE = 512;
const SAVE_URL = "http://127.0.0.1:4177/save";
const params = new URLSearchParams(location.search);
const onlyStyle = params.get("style");
const shouldSave = params.get("save") !== "0";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.setClearColor(0x000000, 0);
const pmrem = new THREE.PMREMGenerator(renderer);
const environments = {
  neutral: pmrem.fromScene(studioEnvironment("#ffffff", 0.35), 0.02).texture,
  // A warm reflector in front so flat gold faces read as gold rather than white or black.
  warm: pmrem.fromScene(studioEnvironment("#ffc875", 0.75), 0.02).texture
};

// Product-photo lighting for reflections: a dark room with a big overhead softbox,
// a warm key box on the left and a cool strip light behind on the right.
function studioEnvironment(frontColor, frontIntensity) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#141516");
  const box = (color, intensity, w, h, position) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    scene.add(panel);
  };
  box("#ffffff", 3.2, 14, 14, [0, 12, 2]);
  box("#ffe7c7", 2.6, 8, 12, [-12, 4, 8]);
  box("#d7e6ff", 2.2, 3, 14, [12, 3, -6]);
  box(frontColor, frontIntensity, 24, 18, [0, 1, 16]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: "#2a2724" }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -8;
  scene.add(floor);
  return scene;
}

// ---------- shapes ----------

function shapesFromPath(d) {
  return SVGLoader.createShapes(new SVGLoader().parse(`<svg><path d="${d}"/></svg>`).paths[0]);
}

// SVG space (y down, 0..100) to model space (y up), with the knight's collar centered on the base.
const HEAD_CENTER_X = 54.5;
const BASE_HEIGHT = 21;

function knightShapes() {
  return shapesFromPath(KNIGHT_HEAD).map((shape) => {
    const points = shape.getPoints(96).map((p) => new THREE.Vector2(p.x - HEAD_CENTER_X, 96 - p.y + BASE_HEIGHT));
    return new THREE.Shape(points);
  });
}

function crownShapes(d) {
  return shapesFromPath(d).map((shape) => new THREE.Shape(shape.getPoints(32).map((p) => new THREE.Vector2(p.x - 50, 50 - p.y))));
}

// Staunton-style turned base: (radius, height) from the floor up.
const BASE_PROFILE = [
  [0, 0], [38, 0], [39.5, 1.2], [39.5, 4.5], [38, 6.2], [34, 7.2], [34.6, 9], [34.6, 11.2],
  [32.5, 12.8], [28.5, 13.8], [29.6, 15.6], [29.6, 18], [27.5, 20], [24, BASE_HEIGHT + 0.5], [0, BASE_HEIGHT + 0.5]
];

// ---------- styles ----------

function grainTexture(base, line, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const y0 = rand() * 512;
    const amp = 3 + rand() * 10;
    const freq = 0.004 + rand() * 0.01;
    ctx.strokeStyle = line;
    ctx.globalAlpha = 0.08 + rand() * 0.22;
    ctx.lineWidth = 0.6 + rand() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const y = y0 + Math.sin(x * freq + i) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 60, 1 / 60);
  return texture;
}

function toonGradient() {
  const data = new Uint8Array([90, 170, 255]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const SIDE_COLORS = {
  red: "#a4161d",
  black: "#1c1d21",
  gray: "#6f7471"
};

const STYLES = {
  lacquer: {
    label: "Lacquered resin",
    gems: false, // Zach's pick: plain gold crown, no jewels on the band
    body: (side) =>
      new THREE.MeshPhysicalMaterial({
        color: SIDE_COLORS[side],
        roughness: 0.38,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1
      }),
    eye: () => new THREE.MeshPhysicalMaterial({ color: "#0b0b0c", roughness: 0.1, clearcoat: 1 }),
    crown: () => new THREE.MeshStandardMaterial({ color: "#d79a2b", metalness: 1, roughness: 0.3 }),
    gem: () => new THREE.MeshPhysicalMaterial({ color: "#9e0f1f", roughness: 0.05, clearcoat: 1 })
  },
  wood: {
    label: "Carved wood",
    body: (side) => {
      const tones = { red: ["#8e2f22", "#4a130c"], black: ["#2a211c", "#0c0806"], gray: ["#7d776f", "#48433d"] };
      const [base, line] = tones[side];
      return new THREE.MeshStandardMaterial({ map: grainTexture(base, line, side.length * 977), roughness: 0.55 });
    },
    eye: () => new THREE.MeshStandardMaterial({ color: "#120b07", roughness: 0.4 }),
    crown: () => new THREE.MeshStandardMaterial({ color: "#c08a35", metalness: 0.9, roughness: 0.45 }),
    gem: () => new THREE.MeshStandardMaterial({ color: "#3b2414", roughness: 0.5 })
  },
  toon: {
    label: "Cel-shaded",
    outline: true,
    body: (side) =>
      new THREE.MeshToonMaterial({
        color: { red: "#d8383c", black: "#34383f", gray: "#868b88" }[side],
        gradientMap: toonGradient()
      }),
    eye: () => new THREE.MeshBasicMaterial({ color: "#111" }),
    crown: () => new THREE.MeshToonMaterial({ color: "#f2c14e", gradientMap: toonGradient() }),
    gem: () => new THREE.MeshToonMaterial({ color: "#e44d4d", gradientMap: toonGradient() })
  },
  faceted: {
    label: "Faceted",
    faceted: true,
    body: (side) =>
      new THREE.MeshStandardMaterial({
        color: { red: "#b8352f", black: "#2c3036", gray: "#7b807d" }[side],
        roughness: 0.45,
        metalness: 0.05,
        flatShading: true
      }),
    eye: () => new THREE.MeshStandardMaterial({ color: "#0e0e10", flatShading: true }),
    crown: () => new THREE.MeshStandardMaterial({ color: "#d9a03a", metalness: 1, roughness: 0.28, flatShading: true }),
    gem: () => new THREE.MeshStandardMaterial({ color: "#1d2026", roughness: 0.2, flatShading: true })
  },
  metal: {
    label: "Cast metal",
    silverCrown: true,
    body: (side) =>
      new THREE.MeshStandardMaterial({
        color: { red: "#d23a3a", black: "#4a4e55", gray: "#8a8e8e" }[side],
        metalness: 0.85,
        roughness: 0.3
      }),
    eye: () => new THREE.MeshStandardMaterial({ color: "#0c0c0d", metalness: 0.5, roughness: 0.5 }),
    crown: () => new THREE.MeshStandardMaterial({ color: "#c9cdd1", metalness: 1, roughness: 0.26 }),
    gem: () => new THREE.MeshStandardMaterial({ color: "#c3302f", metalness: 0.3, roughness: 0.15 })
  }
};

// ---------- models ----------

function finishGeometry(geometry, style) {
  if (style.faceted) return geometry.toNonIndexed();
  return geometry;
}

function buildKnight(style, side) {
  const group = new THREE.Group();
  const body = style.body(side);
  const depth = 16;
  const bevel = style.faceted ? 7 : 10;
  const head = new THREE.ExtrudeGeometry(knightShapes(), {
    depth,
    curveSegments: style.faceted ? 3 : 48,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.55,
    bevelOffset: -bevel * 0.3,
    bevelSegments: style.faceted ? 2 : 14
  });
  head.translate(0, 0, -depth / 2);
  if (style.faceted) {
    // Re-sample the outline coarsely so the faces read as cut facets.
    head.dispose();
  }
  const headGeometry = style.faceted
    ? new THREE.ExtrudeGeometry(
        knightShapes().map((s) => new THREE.Shape(s.getPoints().filter((_, i) => i % 8 === 0))),
        { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelOffset: -bevel * 0.4, bevelSegments: 1 }
      ).translate(0, 0, -depth / 2)
    : head;
  group.add(new THREE.Mesh(finishGeometry(headGeometry, style), body));

  const base = new THREE.LatheGeometry(
    BASE_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    style.faceted ? 10 : 96
  );
  group.add(new THREE.Mesh(finishGeometry(base, style), body));

  // Eyes and nostrils sit just proud of both cheeks.
  const surface = depth / 2 + bevel * 0.9;
  const eyeMaterial = style.eye();
  for (const z of [surface, -surface]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), eyeMaterial);
    eye.scale.set(KNIGHT_EYE.rx * 1.35, KNIGHT_EYE.ry * 1.35, 1.6);
    eye.rotation.z = THREE.MathUtils.degToRad(-KNIGHT_EYE.rotate);
    eye.position.set(KNIGHT_EYE.cx - HEAD_CENTER_X, 96 - KNIGHT_EYE.cy + BASE_HEIGHT, z);
    group.add(eye);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(KNIGHT_NOSTRIL.r, 16, 12), eyeMaterial);
    nostril.scale.z = 0.6;
    nostril.position.set(KNIGHT_NOSTRIL.cx - HEAD_CENTER_X + 1.5, 96 - KNIGHT_NOSTRIL.cy + BASE_HEIGHT, z * 0.7);
    group.add(nostril);
  }

  // Raised mane ridge along the back of the neck.
  const maneCurve = new THREE.CatmullRomCurve3(
    [
      [44, 13], [56, 16], [66, 23], [73, 33], [78, 45], [80, 58], [80, 70], [79, 80]
    ].map(([x, y]) => new THREE.Vector3(x - HEAD_CENTER_X - 4.5, 96 - y + BASE_HEIGHT - 2, 0))
  );
  for (const z of [depth / 2 + bevel * 0.7, -(depth / 2 + bevel * 0.7)]) {
    const mane = new THREE.TubeGeometry(maneCurve, style.faceted ? 8 : 64, 2.1, style.faceted ? 4 : 12);
    const maneMesh = new THREE.Mesh(finishGeometry(mane, style), body);
    maneMesh.position.z = z;
    maneMesh.scale.z = 0.6;
    group.add(maneMesh);
  }

  return group;
}

// Wraps flat crown geometry around a vertical cylinder so it reads as a real crown band
// and its faces catch changing reflections.
const CROWN_RADIUS = 1e6; // effectively flat; raise curvature by lowering this
function bendPoint(x, z) {
  const angle = x / CROWN_RADIUS;
  return [(CROWN_RADIUS + z) * Math.sin(angle), (CROWN_RADIUS + z) * Math.cos(angle) - CROWN_RADIUS];
}
function bend(geometry) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const [x, z] = bendPoint(position.getX(i), position.getZ(i));
    position.setX(i, x);
    position.setZ(i, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildCrown(style) {
  const group = new THREE.Group();
  const gold = style.crown();
  const curve = style.faceted ? 4 : 32;
  const points = new THREE.ExtrudeGeometry(crownShapes(CROWN_POINTS), {
    depth: 4, curveSegments: curve, bevelEnabled: true, bevelThickness: 3.2, bevelSize: 2.6, bevelOffset: -1.2, bevelSegments: style.faceted ? 1 : 3
  });
  group.add(new THREE.Mesh(finishGeometry(points, style), gold));
  const band = new THREE.ExtrudeGeometry(crownShapes(CROWN_BAND), {
    depth: 7.5, curveSegments: curve, bevelEnabled: true, bevelThickness: 2.6, bevelSize: 1.8, bevelOffset: -0.6, bevelSegments: style.faceted ? 1 : 3
  });
  group.add(new THREE.Mesh(finishGeometry(band, style), gold));
  for (const ball of CROWN_BALLS) {
    const mesh = new THREE.Mesh(
      finishGeometry(new THREE.SphereGeometry(ball.r, style.faceted ? 6 : 32, style.faceted ? 4 : 20), style),
      gold
    );
    const [bx, bz] = bendPoint(ball.cx - 50, 4);
    mesh.position.set(bx, 50 - ball.cy, bz);
    group.add(mesh);
  }
  const gem = style.gem();
  for (const g of style.gems === false ? [] : CROWN_GEMS) {
    const mesh = new THREE.Mesh(
      finishGeometry(new THREE.SphereGeometry(g.r, style.faceted ? 6 : 32, style.faceted ? 4 : 20), style),
      gem
    );
    mesh.scale.z = 0.7;
    const [gx, gz] = bendPoint(g.cx - 50, 8.6);
    mesh.position.set(gx, 50 - g.cy, gz);
    mesh.rotation.y = (g.cx - 50) / CROWN_RADIUS;
    group.add(mesh);
  }
  return group;
}

// Inverted-hull outline: a back-face copy pushed out along its normals.
function addOutline(group, width) {
  const outline = new THREE.MeshBasicMaterial({ color: "#151515", side: THREE.BackSide });
  outline.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `vec3 transformed = position + normalize(normal) * ${width.toFixed(2)};`
    );
  };
  const meshes = [];
  group.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  for (const mesh of meshes) {
    const geometry = mergeVertices(mesh.geometry.clone().deleteAttribute("uv"));
    geometry.computeVertexNormals();
    const shell = new THREE.Mesh(geometry, outline);
    shell.position.copy(mesh.position);
    shell.rotation.copy(mesh.rotation);
    shell.scale.copy(mesh.scale);
    mesh.parent.add(shell);
  }
}

// ---------- rendering ----------

function lightScene(scene, env) {
  scene.environment = environments[env];
  scene.environmentIntensity = 1;
  const key = new THREE.DirectionalLight("#fff4e6", 2.6);
  key.position.set(-120, 220, 260);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#dfe9ff", 1.4);
  rim.position.set(200, 120, -200);
  scene.add(rim);
  scene.add(new THREE.AmbientLight("#ffffff", 0.25));
}

function render(object, { yaw = 0, pitch = 0, frame, env = "neutral", pixels = SIZE }) {
  renderer.setSize(pixels, pixels);
  const scene = new THREE.Scene();
  lightScene(scene, env);
  const pivot = new THREE.Group();
  pivot.add(object);
  pivot.rotation.set(pitch, yaw, 0);
  scene.add(pivot);

  const box = new THREE.Box3().setFromObject(pivot);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const half = (Math.max(size.x, size.y) / 2) * frame;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 1, 2000);
  camera.position.set(center.x, center.y, center.z + 600);
  camera.lookAt(center);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/png");
}

async function save(name, dataUrl) {
  const sheet = document.getElementById("sheet");
  const figure = document.createElement("figure");
  figure.innerHTML = `<img src="${dataUrl}" alt=""><figcaption>${name}</figcaption>`;
  sheet.append(figure);
  if (!shouldSave) return;
  const blob = await (await fetch(dataUrl)).blob();
  await fetch(`${SAVE_URL}?name=${name}.png`, { method: "POST", body: blob });
}

for (const [key, style] of Object.entries(STYLES)) {
  if (onlyStyle && onlyStyle !== key) continue;
  for (const side of ["red", "black", "gray"]) {
    const knight = buildKnight(style, side);
    if (style.outline) addOutline(knight, 1.6);
    await save(`${key}-knight-${side}`, render(knight, { yaw: -0.32, pitch: 0.1, frame: 1.08 }));
  }
  // High-resolution red knight for the app icon.
  const iconKnight = buildKnight(style, "red");
  if (style.outline) addOutline(iconKnight, 1.6);
  await save(`${key}-knight-icon`, render(iconKnight, { yaw: -0.32, pitch: 0.1, frame: 1.02, pixels: 1024 }));
  const crown = buildCrown(style);
  if (style.outline) addOutline(crown, 1.4);
  await save(`${key}-crown`, render(crown, { pitch: -0.18, frame: 1.1, env: style.silverCrown ? "neutral" : "warm" }));
}

document.getElementById("status").textContent = "done";
window.studioDone = true;
