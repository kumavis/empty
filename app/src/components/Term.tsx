/**
 * The popup term dictionary.
 *
 * <T id="non-permanent-resident" /> renders "non-permanent resident (非永住者)"
 * as an underlined trigger; hovering or focusing it opens a card with the
 * definition, its citations into the archived sources, and any false-friend
 * warning. Every Japanese tax term in the UI goes through this component, so
 * the English-first-with-Japanese-in-parentheses convention is enforced in one
 * place rather than by hand at each call site.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { JURISDICTION_LABELS, getTerm } from '../glossary/load';

interface Props {
  id: string;
  /** Override the visible text while keeping the popup. */
  children?: React.ReactNode;
  /** Show the romanisation in the trigger as well as the popup. */
  withRomaji?: boolean;
}

export function T({ id, children, withRomaji }: Props) {
  const term = getTerm(id);
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popupId = useId();

  // Flip the card above the trigger when there is not enough room below, so a
  // definition near the foot of the page is not clipped.
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setFlip(window.innerHeight - rect.bottom < 280);
  }, [open]);

  if (!term) {
    // A broken id should be loud in development rather than silently rendering
    // bare text — check_glossary.py cannot catch a typo in a call site.
    return <span className="term term--missing">{children ?? id}</span>;
  }

  const label = children ?? (
    <>
      {term.en}
      {term.ja && (
        <span className="term__ja">
          {' '}
          ({term.ja}
          {withRomaji && term.romaji ? `, ${term.romaji}` : ''})
        </span>
      )}
    </>
  );

  return (
    <span
      ref={wrapRef}
      className="term"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="term__trigger"
        aria-expanded={open}
        aria-describedby={open ? popupId : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {label}
      </button>

      {open && (
        <span className={`term__popup ${flip ? 'term__popup--above' : ''}`} id={popupId} role="tooltip">
          <span className="term__head">
            <strong>{term.en}</strong>
            {term.ja && (
              <span className="term__headja">
                {term.ja}
                {term.romaji ? ` · ${term.romaji}` : ''}
              </span>
            )}
            <span className="term__badge">{JURISDICTION_LABELS[term.jurisdiction]}</span>
          </span>

          <span className="term__short">{term.short}</span>
          <span className="term__def">{term.definition}</span>

          {term.falseFriend && (
            <span className="term__warn">
              <strong>Easily confused: </strong>
              {term.falseFriend}
            </span>
          )}

          <span className="term__cites">
            {term.citations.map((c) => (
              <a key={c.label} href={c.url} target="_blank" rel="noreferrer">
                {c.label}
              </a>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
