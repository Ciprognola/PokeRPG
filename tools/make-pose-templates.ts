// Regenerates the pose-template download served by the Slicer (PKR-007).
// Usage: npm run templates   (output is deterministic; commit the result)
import { mkdirSync, writeFileSync } from 'node:fs';
import { POSE_TEMPLATE_ZIP_NAME, poseTemplateZip } from '@pokerpg/core/testing';

const dir = new URL('../packages/slicer/public/downloads/', import.meta.url);
mkdirSync(dir, { recursive: true });
const zip = poseTemplateZip();
writeFileSync(new URL(POSE_TEMPLATE_ZIP_NAME, dir), zip);
console.log(`${POSE_TEMPLATE_ZIP_NAME}: ${(zip.length / 1024).toFixed(0)} KB`);
