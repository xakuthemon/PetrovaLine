/*
 * Petrova Line — simplified radar backscatter model.
 *
 * One function drives the map scenes and the Physics Decoder, so the sliders
 * and the pixels obey the same rules. It is a teaching approximation (Fresnel
 * reflectivity + roughness power law + canopy volume + double-bounce), tuned
 * to typical L-band values:
 *   calm water ≈ −28 dB · dry salt crust ≈ −25 dB · rough wet soil ≈ −8 dB
 *   forest HV ≈ −13 dB · flooded forest HH ≈ −4 dB
 */

export type BandId = 'L' | 'S';
export interface Band {
  id: BandId;
  name: string;
  /** wavelength, cm */
  lambda: number;
  /** line-of-sight motion per interferometric fringe, cm */
  fringe: number;
  /** centre frequency, GHz */
  ghz: number;
  agency: string;
}

export const BANDS: Record<BandId, Band> = {
  L: { id: 'L', name: 'L-band', lambda: 23.8, fringe: 11.9, ghz: 1.25, agency: 'NASA' },
  S: { id: 'S', name: 'S-band', lambda: 9.4, fringe: 4.7, ghz: 3.2, agency: 'ISRO' },
};

/** ≈ −29 dB noise-equivalent sigma-zero */
export const NOISE_FLOOR = 0.0012;

/** Fresnel power reflectivity at normal incidence for relative permittivity e. */
export function fresnel(e: number): number {
  const q = Math.sqrt(e);
  const g = (q - 1) / (q + 1);
  return g * g;
}

/**
 * Backscatter for one resolution cell.
 * @param R roughness 0..1 (relative to the L-band wavelength)
 * @param E relative permittivity (dielectric constant) 1..80
 * @param V vegetation / volume-scatterer density 0..1
 * @param D vertical-structure strength (trunks, reeds, walls) 0..3
 * @param isS true for S-band (9.4 cm), false for L-band (23.8 cm)
 * @param out receives linear power [HH, HV, VV]
 */
export function sigma(R: number, E: number, V: number, D: number, isS: boolean, out: Float32Array): void {
  // A shorter wavelength makes the same surface look rougher.
  const Rm = isS ? Math.min(1, R * 1.55 + 0.04) : R;
  const G = fresnel(E);
  const kv = isS ? 3.0 : 1.15;                       // canopy extinction
  const att = Math.exp(-kv * V);                     // two-way loss through the canopy
  const surf = 0.606 * G * Math.pow(Rm, 1.6) * att;
  const Vs = 1 - Math.exp(-(isS ? 4.5 : 2.2) * V);   // volume term saturates with biomass
  const oneR = 1 - Rm;
  const db = 0.85 * D * G * oneR * oneR * Math.exp(-kv * V * 0.8);
  out[0] = 0.8 * surf + (isS ? 0.13 : 0.16) * Vs + db + NOISE_FLOOR;
  out[1] = surf * 0.04 * (0.3 + Rm) + (isS ? 0.036 : 0.05) * Vs + 0.03 * db + NOISE_FLOOR * 0.5;
  out[2] = 1.25 * surf + (isS ? 0.12 : 0.13) * Vs + 0.3 * db + NOISE_FLOOR;
}

export interface Breakdown {
  G: number;
  Rm: number;
  /** HH power from rough-surface scattering */
  surface: number;
  /** HH power from volume scattering */
  volume: number;
  /** HH power from double-bounce */
  dbl: number;
  /** share of power mirrored away from the sensor */
  specular: number;
  transmitted: number;
}

/** HH-channel component breakdown: which scattering mechanism returns the power. */
export function breakdown(R: number, E: number, V: number, D: number, isS: boolean): Breakdown {
  const Rm = isS ? Math.min(1, R * 1.55 + 0.04) : R;
  const G = fresnel(E);
  const kv = isS ? 3.0 : 1.15;
  const att = Math.exp(-kv * V);
  const surface = 0.8 * 0.606 * G * Math.pow(Rm, 1.6) * att;
  const volume = (isS ? 0.13 : 0.16) * (1 - Math.exp(-(isS ? 4.5 : 2.2) * V));
  const oneR = 1 - Rm;
  const dbl = 0.85 * D * G * oneR * oneR * Math.exp(-kv * V * 0.8);
  return { G, Rm, surface, volume, dbl, specular: G * oneR * oneR, transmitted: 1 - G };
}

export const toDb = (x: number): number => 10 * Math.log10(x);
