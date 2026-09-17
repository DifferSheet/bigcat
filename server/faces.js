// ตัวจับ/จับคู่ใบหน้า — 2 ผู้ให้บริการ สลับด้วย FACE_PROVIDER ใน .env
//   local        (ค่าเริ่มต้น) face-api (SSD MobileNet + FaceNet 128-d) รันในโปรเซสนี้ด้วย WASM · ไม่มีข้อมูลออกนอกเครื่อง · ~0.2 วิ/รูป
//   rekognition  AWS Rekognition collection เดียว (ใบหน้าจากอัลบั้ม + ใบหน้าสมาชิกที่ยินยอม) · ต้องตั้ง AWS_REGION + AWS_ACCESS_KEY_ID/SECRET (หรือ IAM role ของ EC2) + REKOGNITION_COLLECTION
//   none         ปิดการสแกน (อัลบั้มยังใช้ได้ แค่ไม่มี «รูปที่มีฉัน»)
// อินเทอร์เฟซเดียวกัน:
//   index(filePath, externalId) → { width, height, faces: [{ ref, box:{x,y,w,h} (0–1), score, descriptor|null }] }   ← ตรวจจับ + จำใบหน้า
//   similar(face, pool)        → [{ ref, similarity 0–1 }]   ← local เทียบกับ pool ที่ส่งมา (แถวจาก DB) · rekognition ถามจาก collection
//   forget(refs)               → ลบใบหน้าออกจากระบบ (rekognition: DeleteFaces · local: ไม่มีอะไรนอก DB)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import sharp from 'sharp';

export const faceProvider = (process.env.FACE_PROVIDER || 'local').toLowerCase();
export const MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || (faceProvider === 'rekognition' ? 0.9 : 0.55));   // local: 1 - ระยะ (0.55 ≈ ระยะ 0.45)
const MIN_FACE_FRAC = 0.05;    // หน้าต้องกว้าง ≥ 5% ของภาพ (หน้าจิ๋วในรูปหมู่จับคู่ไม่แม่น ไม่ส่ง)
const MIN_SCORE = 0.7;

const require = createRequire(import.meta.url);

/* ---------- local: face-api + tfjs wasm ---------- */
let localReady = null;
async function local() {
  if (localReady) return localReady;
  localReady = (async () => {
    const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    const tf = require('@tensorflow/tfjs');
    const wasm = require('@tensorflow/tfjs-backend-wasm');
    wasm.setWasmPaths(path.join(process.cwd(), 'node_modules/@tensorflow/tfjs-backend-wasm/dist/'));
    await tf.setBackend('wasm'); await tf.ready();
    const M = path.join(process.cwd(), 'node_modules/@vladmandic/face-api/model');
    await Promise.all([faceapi.nets.ssdMobilenetv1.loadFromDisk(M), faceapi.nets.faceLandmark68Net.loadFromDisk(M), faceapi.nets.faceRecognitionNet.loadFromDisk(M)]);
    return { faceapi, tf };
  })();
  return localReady;
}

async function localIndex(filePath) {
  const { faceapi, tf } = await local();
  const { data, info } = await sharp(filePath).rotate().resize({ width: 900, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
  let res;
  try { res = await faceapi.detectAllFaces(t, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptors(); }
  finally { t.dispose(); }
  const faces = res.map(r => ({
    ref: crypto.randomUUID(),
    box: { x: r.detection.box.x / info.width, y: r.detection.box.y / info.height, w: r.detection.box.width / info.width, h: r.detection.box.height / info.height },
    score: r.detection.score, descriptor: Array.from(r.descriptor),
  }));
  return { width: info.width, height: info.height, faces };
}

const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
// pool = [{ ref, descriptor }] → คืนเฉพาะที่ใกล้พอ เรียงจากใกล้สุด
function localSimilar(face, pool) {
  if (!face.descriptor) return [];
  return pool.filter(p => p.descriptor).map(p => ({ ref: p.ref, similarity: 1 - dist(face.descriptor, p.descriptor) })).filter(m => m.similarity >= MATCH_THRESHOLD).sort((a, b) => b.similarity - a.similarity);
}

/* ---------- AWS Rekognition ---------- */
let rek = null;
const collection = process.env.REKOGNITION_COLLECTION || 'bigcat-faces';
async function rekClient() {
  if (rek) return rek;
  const { RekognitionClient, CreateCollectionCommand, ListCollectionsCommand } = await import('@aws-sdk/client-rekognition');
  rek = new RekognitionClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
  const list = await rek.send(new ListCollectionsCommand({}));
  if (!(list.CollectionIds || []).includes(collection)) await rek.send(new CreateCollectionCommand({ CollectionId: collection }));
  return rek;
}
async function rekIndex(filePath, externalId) {
  const { IndexFacesCommand } = await import('@aws-sdk/client-rekognition');
  const client = await rekClient();
  const { data, info } = await sharp(filePath).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const out = await client.send(new IndexFacesCommand({ CollectionId: collection, Image: { Bytes: data }, ExternalImageId: String(externalId).replace(/[^a-zA-Z0-9_.\-:]/g, '_'), DetectionAttributes: [], MaxFaces: 6, QualityFilter: 'AUTO' }));
  const faces = (out.FaceRecords || []).map(f => ({ ref: f.Face.FaceId, box: { x: f.Face.BoundingBox.Left, y: f.Face.BoundingBox.Top, w: f.Face.BoundingBox.Width, h: f.Face.BoundingBox.Height }, score: (f.Face.Confidence || 0) / 100, descriptor: null }));
  return { width: info.width, height: info.height, faces };
}
async function rekSimilar(face) {
  const { SearchFacesCommand } = await import('@aws-sdk/client-rekognition');
  const client = await rekClient();
  const out = await client.send(new SearchFacesCommand({ CollectionId: collection, FaceId: face.ref, FaceMatchThreshold: MATCH_THRESHOLD * 100, MaxFaces: 50 }));
  return (out.FaceMatches || []).map(m => ({ ref: m.Face.FaceId, similarity: (m.Similarity || 0) / 100 }));
}
async function rekForget(refs) {
  if (!refs.length) return;
  const { DeleteFacesCommand } = await import('@aws-sdk/client-rekognition');
  await (await rekClient()).send(new DeleteFacesCommand({ CollectionId: collection, FaceIds: refs }));
}

/* ---------- interface ---------- */
export const facesEnabled = faceProvider !== 'none';
export const usable = (f) => f.score >= MIN_SCORE && f.box.w >= MIN_FACE_FRAC;   // หน้าใหญ่/ชัดพอจะจับคู่ (หน้าจิ๋วในรูปหมู่ไม่ผ่าน)
const keep = (out) => { out.faces = out.faces.filter(usable); return out; };
// ขั้นคัดรูป: นับหน้า «ทุกขนาด» บนเครื่องเราเสมอ (ไม่มีค่าใช้จ่าย ไม่มีข้อมูลออกนอกเครื่อง) — ใช้ตัดสินว่ารูปเป็นเดี่ยว/คู่ (นับทุกหน้า) ก่อนส่งจับคู่เฉพาะหน้าที่ใช้ได้
export async function detect(filePath) { return localIndex(filePath); }
// ขั้นจำใบหน้า: เฉพาะรูปที่ผ่านการคัดแล้ว · local ใช้ผลจาก detect ได้เลย (มี descriptor แล้ว) · rekognition ส่งขึ้น collection
export async function index(filePath, externalId, detected = null) {
  if (faceProvider === 'rekognition') return keep(await rekIndex(filePath, externalId));
  return keep(detected || await localIndex(filePath));
}
export async function similar(face, pool = []) { return faceProvider === 'rekognition' ? rekSimilar(face) : localSimilar(face, pool); }
export async function forget(refs) { if (faceProvider === 'rekognition') await rekForget(refs); }
