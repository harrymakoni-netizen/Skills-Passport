import { Fragment, type ReactNode } from 'react';

/** WhatsApp-style formatting: *bold*, line breaks and clickable links. */
export function WaText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i ? <br /> : null}
          {renderLine(line)}
        </Fragment>
      ))}
    </>
  );
}

function renderLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*[^*\n]+\*)|(https?:\/\/[^\s]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1].slice(1, -1)}</strong>);
    else if (m[2]) {
      const url = m[2].replace(/[.,)]+$/, '');
      out.push(
        <a key={k++} href={url} target="_blank" rel="noreferrer" className="break-all text-[#027eb5] underline">
          {url}
        </a>,
      );
      if (url.length < m[2].length) out.push(m[2].slice(url.length));
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export const timeOf = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(new Date(iso));
