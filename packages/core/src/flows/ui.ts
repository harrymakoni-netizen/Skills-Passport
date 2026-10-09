import { t, type MessageKey, type Params } from '../i18n';
import { clip, LIMITS, type Choice, type Lang, type OutboundMessage } from '../messages';

/** Small builders so flows read like the conversation they produce. */
export const text = (body: string): OutboundMessage => ({ kind: 'text', text: body });

export const say = (lang: Lang, key: MessageKey, params?: Params): OutboundMessage => text(t(lang, key, params));

export function buttons(body: string, choices: Choice[]): OutboundMessage {
  if (choices.length > LIMITS.maxButtons) throw new Error('Too many buttons');
  return { kind: 'buttons', body, buttons: choices.map((c) => ({ id: c.id, title: clip(c.title, LIMITS.maxButtonTitle) })) };
}

export function list(lang: Lang, body: string, rows: Choice[], sectionTitle?: string): OutboundMessage {
  if (rows.length > LIMITS.maxListRows) throw new Error(`Too many list rows: ${rows.length}`);
  return {
    kind: 'list',
    body,
    buttonLabel: t(lang, 'common.choose'),
    sections: [
      {
        ...(sectionTitle ? { title: clip(sectionTitle, LIMITS.maxRowTitle) } : {}),
        rows: rows.map((r) => ({
          id: r.id,
          title: clip(r.title, LIMITS.maxRowTitle),
          ...(r.description ? { description: clip(r.description, LIMITS.maxRowDescription) } : {}),
        })),
      },
    ],
  };
}

export const choice = (lang: Lang, id: string, key: MessageKey): Choice => ({ id, title: t(lang, key) });
