/**
 * The browsable term dictionary — the same data the popups use, listed in full
 * with search, so a reader can look a term up without hunting for a mention.
 */
import { useMemo, useState } from 'react';
import {
  CATEGORY_LABELS,
  JURISDICTION_LABELS,
  type Term,
  TERMS,
  searchTerms,
} from '../glossary/load';

export function Glossary({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Term | null>(null);

  const grouped = useMemo(() => {
    const results = searchTerms(query);
    const map = new Map<string, Term[]>();
    for (const t of results) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.en.localeCompare(b.en));
    return [...map.entries()].sort(([a], [b]) =>
      (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b),
    );
  }, [query]);

  const count = searchTerms(query).length;

  return (
    <>
    <button className="scrim" aria-label="Close dictionary" onClick={onClose} />
    <div className="drawer" role="dialog" aria-label="Term dictionary">
      <div className="drawer__head">
        <div>
          <h2>Term dictionary</h2>
          <p className="muted">
            {count} of {TERMS.length} terms · English and Japanese · loaded from{' '}
            <code>docs/glossary/</code>
          </p>
        </div>
        <button className="btn" onClick={onClose} aria-label="Close dictionary">
          Close
        </button>
      </div>

      <input
        className="drawer__search"
        placeholder="Search English, 日本語, romaji, or definition…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <div className="drawer__body">
        {grouped.length === 0 && <p className="muted">No terms match “{query}”.</p>}

        {grouped.map(([category, terms]) => (
          <section key={category}>
            <h3 className="drawer__cat">{CATEGORY_LABELS[category] ?? category}</h3>
            {terms.map((t) => {
              const isOpen = selected?.id === t.id;
              return (
                <article key={t.id} className={`entry ${isOpen ? 'entry--open' : ''}`}>
                  <button
                    className="entry__head"
                    onClick={() => setSelected(isOpen ? null : t)}
                    aria-expanded={isOpen}
                  >
                    <span className="entry__en">{t.en}</span>
                    {t.ja && (
                      <span className="entry__ja">
                        {t.ja}
                        {t.romaji ? ` · ${t.romaji}` : ''}
                      </span>
                    )}
                    <span className="entry__badge">{JURISDICTION_LABELS[t.jurisdiction]}</span>
                  </button>

                  <p className="entry__short">{t.short}</p>

                  {isOpen && (
                    <div className="entry__detail">
                      <p>{t.definition}</p>
                      {t.falseFriend && (
                        <p className="entry__warn">
                          <strong>Easily confused: </strong>
                          {t.falseFriend}
                        </p>
                      )}
                      <p className="entry__cites">
                        {t.citations.map((c) => (
                          <a key={c.label} href={c.url} target="_blank" rel="noreferrer">
                            {c.label}
                          </a>
                        ))}
                      </p>
                      <p className="muted entry__src">
                        Archived at{' '}
                        {t.citations.map((c) => (
                          <code key={c.source}>{c.source}</code>
                        ))}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
    </>
  );
}
