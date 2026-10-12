/**
 * Contrats IA (ADR-0015, ADR-0017) — AUCUNE reconnaissance n'est implémentée ici : seulement des types, des ports et une porte de validation.
 * Principes : (1) le moteur ne dépend pas de l'IA ; (2) une proposition n'entre JAMAIS dans le modèle validé automatiquement ;
 * (3) les contrats de perception ne contiennent aucune donnée économique ou réglementaire locale ; (4) l'IA peut être locale ou cloud
 * derrière les mêmes ports, le cloud exigeant un consentement explicite par projet (vérifié par l'hôte, pas par ce module).
 */
import { sha256Bytes } from '../trace/sha256.js';

export type MediaType = 'application/pdf' | 'image/png' | 'image/jpeg';

/** Document source importé (plan). Les octets restent dans le fichier projet (`sources/<id>`), jamais dans le modèle. */
export interface SourceDocument {
  id: string;                       // sha256:<hex> des octets
  mediaType: MediaType; originalName: string; bytes: number;
  /** dimensions en pixels pour une image ; null pour un PDF (les pages ne sont pas analysées par le noyau) */
  widthPx: number | null; heightPx: number | null;
  pages: number | null;             // null = inconnu (non analysé)
}

const hex = (b: Uint8Array): string => Array.from(sha256Bytes(b), (x) => x.toString(16).padStart(2, '0')).join('');

export function registerSource(data: Uint8Array, originalName: string): { ok: true; source: SourceDocument } | { ok: false; reason: string } {
  if (data.length < 12) return { ok: false, reason: 'fichier trop court' };
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const id = 'sha256:' + hex(data);
  if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d) {
    return { ok: true, source: { id, mediaType: 'application/pdf', originalName, bytes: data.length, widthPx: null, heightPx: null, pages: null } };
  }
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) {
    if (data.length < 24 || dv.getUint32(12, false) !== 0x49484452) return { ok: false, reason: 'PNG sans en-tête IHDR' };
    const w = dv.getUint32(16, false), h = dv.getUint32(20, false);
    if (w === 0 || h === 0) return { ok: false, reason: 'dimensions PNG nulles' };
    return { ok: true, source: { id, mediaType: 'image/png', originalName, bytes: data.length, widthPx: w, heightPx: h, pages: 1 } };
  }
  if (data[0] === 0xff && data[1] === 0xd8) {
    let p = 2;
    while (p + 9 < data.length) {
      if (data[p] !== 0xff) { p++; continue; }
      const m = data[p + 1]!;
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { p += 2; continue; }
      const len = dv.getUint16(p + 2, false);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const h = dv.getUint16(p + 5, false), w = dv.getUint16(p + 7, false);
        if (w === 0 || h === 0) return { ok: false, reason: 'dimensions JPEG nulles' };
        return { ok: true, source: { id, mediaType: 'image/jpeg', originalName, bytes: data.length, widthPx: w, heightPx: h, pages: 1 } };
      }
      p += 2 + len;
    }
    return { ok: false, reason: 'JPEG sans segment SOF' };
  }
  return { ok: false, reason: 'format non pris en charge (PDF, PNG, JPEG)' };
}

/** Coordonnées d'image en CENTIÈMES de pixel (entiers) : pas de flottants dans le noyau. */
export interface PxPoint { x: number; y: number }

/**
 * Calibration d'échelle : l'utilisateur désigne deux points de la source et une longueur réelle (m, décimal en chaîne).
 * Elle est TOUJOURS saisie/confirmée par un humain (origine user_entered) : aucune échelle déduite n'est appliquée sans confirmation.
 */
export interface ScaleCalibration {
  sourceId: string; page: number; a: PxPoint; b: PxPoint; realLengthM: string; author: string; date: string;
}

/** Conversion pixel→unités du modèle (0,1 mm), arrondie à l'entier, en arithmétique exacte BigInt. */
export function pxToModel(cal: ScaleCalibration): (p: PxPoint) => { x: number; y: number } {
  const dx = BigInt(cal.b.x - cal.a.x), dy = BigInt(cal.b.y - cal.a.y);
  const d2 = dx * dx + dy * dy; if (d2 === 0n) throw new Error('Calibration : deux points identiques');
  let lo = 0n, hi = d2; while (lo < hi) { const mid = (lo + hi + 1n) / 2n; if (mid * mid <= d2) lo = mid; else hi = mid - 1n; }
  const dist = lo === 0n ? 1n : lo;  // longueur en centièmes de pixel (partie entière)
  const m = /^(\d+)(?:\.(\d+))?$/.exec(cal.realLengthM); if (!m) throw new Error('Calibration : longueur réelle invalide');
  const frac = (m[2] ?? ''); if (frac.length > 4) throw new Error('Calibration : au plus 4 décimales (0,1 mm)');
  const units = BigInt(m[1]! + frac.padEnd(4, '0')); if (units === 0n) throw new Error('Calibration : longueur nulle');
  const conv = (v: bigint): number => { const num = v * units; const neg = num < 0n; const a = neg ? -num : num; const q = (2n * a + dist) / (2n * dist); return Number(neg ? -q : q); };
  return (p) => ({ x: conv(BigInt(p.x - cal.a.x)), y: conv(BigInt(p.y - cal.a.y)) });
}

// ───────────────────────── Ports de perception (interfaces ; aucune implémentation fournie) ─────────────────────────
export interface OcrBlock { text: string; bbox: [number, number, number, number]; confidence: string | null }
export interface OcrPort { readonly id: string; readonly modelHash: string; recognize(source: SourceDocument, bytes: Uint8Array, page: number): Promise<OcrBlock[]> }
export interface DetectorPort { readonly id: string; readonly modelHash: string; detect(source: SourceDocument, bytes: Uint8Array, page: number): Promise<AiProposal[]> }

// ───────────────────────── Propositions ─────────────────────────
export interface Evidence { sourceId: string; page: number; bbox?: [number, number, number, number]; detectorId: string; modelHash: string }
export type ProposalPayload =
  | { kind: 'wall'; a: PxPoint; b: PxPoint; role: 'exterior' | 'interior'; thicknessM?: string; heightM?: string }
  | { kind: 'opening'; hostProposalId: string; class: string; widthM?: string; heightM?: string }
  | { kind: 'text'; text: string };
export type ProposalState = 'proposed' | 'accepted' | 'edited' | 'rejected';
export interface AiProposal { id: string; payload: ProposalPayload; evidence: Evidence; confidence: string | null; state: ProposalState }
