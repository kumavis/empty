/**
 * Loads the term dictionary from docs/glossary/*.json at build time.
 *
 * The research documents stay the single source of truth for terminology — the
 * webapp reads the same files a reader would, rather than keeping a parallel
 * copy that could drift. `scripts/check_glossary.py` validates them in CI.
 */

export interface Citation {
  label: string;
  /** Repo-relative path to an archived primary source. */
  source: string;
  url: string;
}

export interface Term {
  id: string;
  en: string;
  ja?: string;
  romaji?: string;
  jurisdiction: 'JP' | 'US' | 'US-STATE' | 'TREATY';
  category: string;
  short: string;
  definition: string;
  citations: Citation[];
  seeAlso?: string[];
  /** Set when the term is easily confused with a similar one. */
  falseFriend?: string;
}

const modules = import.meta.glob<{ default: Term[] }>('../../../docs/glossary/*.json', {
  eager: true,
});

export const TERMS: Term[] = Object.values(modules).flatMap((m) => m.default);

const byId = new Map(TERMS.map((t) => [t.id, t]));

export function getTerm(id: string): Term | undefined {
  return byId.get(id);
}

/**
 * Render a term the way docs/CONVENTIONS.md rule 3 requires: the English
 * translation first, with the Japanese in parentheses.
 *
 *   non-permanent resident (非永住者, hi-eijūsha)
 *
 * The glossary stores the pieces separately so the UI composes this itself.
 */
export function displayName(term: Term, opts: { withRomaji?: boolean } = {}): string {
  if (!term.ja) return term.en;
  const inner = opts.withRomaji && term.romaji ? `${term.ja}, ${term.romaji}` : term.ja;
  return `${term.en} (${inner})`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  'japan-residency': 'Japan — residency',
  'japan-remittance': 'Japan — remittance basis',
  'japan-income-tax': 'Japan — income tax',
  'japan-exit': 'Japan — leaving',
  'us-sourcing': 'US — taxation and sourcing',
  'us-ftc': 'US — foreign tax credit',
  'us-state': 'US — state and expatriation',
  treaty: 'Treaty',
};

export const JURISDICTION_LABELS: Record<Term['jurisdiction'], string> = {
  JP: 'Japan',
  US: 'United States',
  'US-STATE': 'US state',
  TREATY: 'Treaty',
};

/** Case-insensitive search across the headword, Japanese term and definition. */
export function searchTerms(query: string): Term[] {
  const q = query.trim().toLowerCase();
  if (!q) return TERMS;
  return TERMS.filter((t) =>
    [t.en, t.ja, t.romaji, t.short, t.definition, t.category]
      .filter(Boolean)
      .some((f) => f!.toLowerCase().includes(q)),
  );
}
