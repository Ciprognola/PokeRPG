/**
 * The Slicer pipeline, as required by docs/ASSET_SPEC.md §6 (the required result, not the method).
 * M1 fills in each stage; the order and the ids are fixed by the spec.
 */

export type StageId =
  'remove-background' | 'defringe' | 'scale' | 'align' | 'pack' | 'validate' | 'report';

export interface Stage {
  id: StageId;
  title: string;
  /** Where the requirement lives in docs/ASSET_SPEC.md. */
  spec: string;
}

export const PIPELINE: readonly Stage[] = [
  { id: 'remove-background', title: 'Remove the background', spec: '§6.1' },
  { id: 'defringe', title: 'Defringe edges', spec: '§6.1' },
  {
    id: 'scale',
    title: 'Scale once per character (body = 96 px in walk_down_00)',
    spec: '§6.2',
  },
  {
    id: 'align',
    title: 'Align to the ground line and torso centreline, same offset for every layer',
    spec: '§6.3',
  },
  { id: 'pack', title: 'Pack layer sheets (768 × 512) and write atlases', spec: '§6.4' },
  { id: 'validate', title: 'Validate against the Asset Spec', spec: '§6.5, §7' },
  { id: 'report', title: 'Write report.json', spec: '§6.5' },
] as const;
