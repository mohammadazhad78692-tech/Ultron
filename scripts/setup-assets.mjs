// Copies MediaPipe WASM from node_modules and downloads the hand model ONCE
// into public/mediapipe so the app never needs to fetch anything at runtime.
import { cpSync, mkdirSync, existsSync, writeFileSync } from "node:fs";

const out = "public/mediapipe";
mkdirSync(out, { recursive: true });

const wasmSrc = "node_modules/@mediapipe/tasks-vision/wasm";
if (!existsSync(wasmSrc)) {
  console.error("Run `npm install` first.");
  process.exit(1);
}
cpSync(wasmSrc, `${out}/wasm`, { recursive: true });

const modelPath = `${out}/hand_landmarker.task`;
if (!existsSync(modelPath)) {
  const url =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
  console.log("Downloading hand model (one time)…");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
}
console.log("MediaPipe assets ready.");
