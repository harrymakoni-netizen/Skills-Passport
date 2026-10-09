/**
 * Fine engraved-line (guilloche-style) pattern used sparingly on the passport header — the security-printing cue of the
 * design concept. Deterministic SVG, served as a cached static file.
 */
export function guillocheSvg(opts: { width?: number; height?: number; color?: string; opacity?: number } = {}): string {
  const W = opts.width ?? 1200;
  const H = opts.height ?? 360;
  const color = opts.color ?? '#9CC2B0';
  const op = opts.opacity ?? 0.22;
  const paths: string[] = [];
  // Rosette on the right, engraved waves across.
  for (let k = 0; k < 9; k++) {
    let d = '';
    const cx = W * 0.82;
    const cy = H * 0.5;
    const r = 110 + k * 9;
    for (let i = 0; i <= 150; i++) {
      const a = (i / 150) * Math.PI * 2;
      const rr = r + 18 * Math.sin(9 * a + k * 0.5) + 8 * Math.cos(15 * a - k * 0.3);
      d += `${i ? 'L' : 'M'}${Math.round(cx + rr * Math.cos(a))} ${Math.round(cy + rr * Math.sin(a))}`;
    }
    paths.push(`<path d="${d}Z"/>`);
  }
  for (let k = 0; k < 12; k++) {
    let d = '';
    for (let x = 0; x <= W; x += 12) {
      const y = H * 0.18 + k * (H * 0.05) + 10 * Math.sin(x / 38 + k * 0.6) + 5 * Math.sin(x / 11 + k);
      d += `${x ? 'L' : 'M'}${x} ${Math.round(y)}`;
    }
    paths.push(`<path d="${d}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="0.9">${paths.join('')}</g></svg>`;
}
