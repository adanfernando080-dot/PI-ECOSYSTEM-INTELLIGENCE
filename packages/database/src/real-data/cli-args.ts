/** Minimal `--flag` / `--key=value` parser shared by the real-data CLIs (no dependency). */
export interface ParsedArgs {
  flags: Set<string>;
  values: Map<string, string>;
  unknown: string[];
}

export function parseArgs(argv: readonly string[], known: { flags: readonly string[]; values: readonly string[] }): ParsedArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const unknown: string[] = [];
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      unknown.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (eq === -1 && known.flags.includes(key)) flags.add(key);
    else if (eq !== -1 && known.values.includes(key)) values.set(key, arg.slice(eq + 1));
    else unknown.push(arg);
  }
  return { flags, values, unknown };
}
