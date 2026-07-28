/**
 * A form field that holds its own draft text.
 *
 * The point is that an intermediate value never reaches the model. The input
 * shows exactly what was typed, so editing is never fought; the scenario only
 * updates when the draft validates. When it doesn't, the previous good value
 * stays in effect, the field explains what it wants, and the projection behind
 * it keeps showing the last coherent answer instead of blanking out.
 */
import { useEffect, useId, useState } from 'react';
import type { Check } from '../domain/validate';

interface Props {
  label: React.ReactNode;
  /** The committed value, formatted for display. */
  value: string;
  check: (raw: string) => Check;
  onCommit: (value: number | string) => void;
  hint?: React.ReactNode;
  type?: 'text' | 'date' | 'number';
  step?: number;
  /** Rendered inside the input, e.g. a currency mark. */
  prefix?: string;
  /** Secondary readout, e.g. the yen equivalent of a dollar amount. */
  secondary?: string;
}

export function Field({
  label, value, check, onCommit, hint, type = 'text', step, prefix, secondary,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);
  const id = useId();

  // Adopt external changes (a preset, a reset) without clobbering active edits.
  useEffect(() => {
    if (!touched) setDraft(value);
  }, [value, touched]);

  const result = check(draft);
  const invalid = touched && result.error !== null;

  const handle = (raw: string) => {
    setTouched(true);
    setDraft(raw);
    const r = check(raw);
    if (r.error === null && r.value !== undefined) onCommit(r.value);
  };

  return (
    <div className={`field ${invalid ? 'field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        {prefix && <span className="field__prefix" aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          type={type}
          step={step}
          value={draft}
          className={prefix ? 'has-prefix' : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(e) => handle(e.target.value)}
          onBlur={() => {
            // A field left invalid snaps back to the value actually in effect,
            // so the form can never disagree with the numbers below it.
            if (check(draft).error !== null) {
              setDraft(value);
              setTouched(false);
            }
          }}
        />
      </div>
      {secondary && !invalid && <span className="field__secondary">{secondary}</span>}
      {invalid ? (
        <span className="field__error" id={`${id}-err`} role="alert">
          {result.error}
        </span>
      ) : (
        hint && <span className="field__hint" id={`${id}-hint`}>{hint}</span>
      )}
    </div>
  );
}
