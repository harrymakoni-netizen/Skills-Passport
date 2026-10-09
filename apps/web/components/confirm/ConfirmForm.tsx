'use client';
import { useState } from 'react';
import { Button, Field, Textarea, buttonClass, cx } from '@sp/ui';

type Labels = {
  question: string; yes: string; no: string; rate: string; rateHelp: string; star: string[]; comment: string; commentHint: string;
  submit: string; submitting: string; doneTitle: string; doneYes: string; doneNo: string; viewPassport: string; alreadyConfirmed: string;
  error: string; chooseRating: string; stop: string; stopped: string;
};

/** Confirm or dispute, 1–5 stars, optional comment. Large touch targets; works on low-end phones. */
export function ConfirmForm({ token, mode, labels, passportHref }: { token: string; mode: 'confirm' | 'rate'; labels: Labels; passportHref: string | null }) {
  const [answer, setAnswer] = useState<'confirmed' | 'disputed' | null>(mode === 'rate' ? 'confirmed' : null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error' | 'stopped'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  async function send(response: 'confirmed' | 'disputed' | 'stop') {
    if (response === 'confirmed' && mode === 'rate' && !rating) {
      setProblem(labels.chooseRating);
      return;
    }
    setState('sending');
    setProblem(null);
    try {
      const res = await fetch(`/api/public/confirmations/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response, rating, comment: comment.trim() || null }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (!res.ok || !data.ok) throw new Error();
      setState(response === 'stop' ? 'stopped' : 'done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done' || state === 'stopped') {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-success/25 bg-success-50 px-5 py-6 animate-rise" aria-live="polite">
        <h2 className="font-display text-lg font-semibold text-ink-900">{labels.doneTitle}</h2>
        <p className="text-text">{state === 'stopped' ? labels.stopped : answer === 'disputed' ? labels.doneNo : labels.doneYes}</p>
        {passportHref && answer !== 'disputed' && state === 'done' ? (
          <a href={passportHref} className={buttonClass('secondary', 'md', 'self-start')}>
            {labels.viewPassport}
          </a>
        ) : null}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      {mode === 'rate' ? (
        <p className="rounded-md bg-ink-50 px-4 py-3 text-sm text-ink-900">{labels.alreadyConfirmed}</p>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">{labels.question}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['confirmed', 'disputed'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={answer === v}
                onClick={() => setAnswer(v)}
                className={cx(
                  'flex min-h-14 items-center gap-3 rounded-md border px-4 text-left text-base font-semibold transition-colors duration-150',
                  answer === v ? (v === 'confirmed' ? 'border-ink-900 bg-ink-900 text-paper' : 'border-danger bg-danger-50 text-danger') : 'border-rule-strong bg-raised text-text hover:border-ink-700',
                )}
              >
                <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full border', answer === v ? 'border-current' : 'border-rule-strong')} aria-hidden>
                  {answer === v ? <span className="size-2.5 rounded-full bg-current" /> : null}
                </span>
                {v === 'confirmed' ? labels.yes : labels.no}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {answer === 'confirmed' ? (
        <fieldset className="flex flex-col gap-3 animate-rise">
          <legend className="mb-1 font-semibold">{labels.rate}</legend>
          <p className="-mt-1 text-sm text-muted">{labels.rateHelp}</p>
          <div className="flex gap-2" role="radiogroup" aria-label={labels.rate}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={labels.star[n - 1]}
                onClick={() => setRating(n)}
                className={cx(
                  'flex size-12 items-center justify-center rounded-md border transition-colors duration-150 sm:size-14',
                  rating !== null && n <= rating ? 'border-accent bg-accent-50 text-accent' : 'border-rule-strong bg-raised text-faint hover:text-accent',
                )}
              >
                <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                  <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill={rating !== null && n <= rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {answer ? (
        <Field label={labels.comment} htmlFor="comment">
          <Textarea id="comment" value={comment} maxLength={1000} placeholder={labels.commentHint} onChange={(e) => setComment(e.target.value)} />
        </Field>
      ) : null}

      {problem ? <p className="text-sm text-danger" role="alert">{problem}</p> : null}
      {state === 'error' ? <p className="text-sm text-danger" role="alert">{labels.error}</p> : null}

      <Button size="lg" disabled={!answer} loading={state === 'sending'} onClick={() => answer && send(answer)} className="w-full sm:w-auto sm:self-start">
        {state === 'sending' ? labels.submitting : labels.submit}
      </Button>

      <button type="button" onClick={() => send('stop')} className="self-start text-xs text-muted underline underline-offset-4 hover:text-text">
        {labels.stop}
      </button>
    </section>
  );
}
