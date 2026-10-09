export type Choice = { id: string; title: string; description?: string };
export type Out =
  | { kind: 'text'; text: string }
  | { kind: 'buttons'; body: string; buttons: Choice[]; footer?: string }
  | { kind: 'list'; body: string; buttonLabel: string; sections: { title?: string; rows: Choice[] }[] }
  | { kind: 'media'; mediaType: 'image' | 'audio' | 'video' | 'document'; source: { key: string } | { url: string }; caption?: string }
  | { kind: 'template'; template: string; params: string[]; buttons: Choice[]; preview: string };
export type In =
  | { kind: 'text'; text: string }
  | { kind: 'choice'; id: string; title?: string }
  | { kind: 'media'; mediaType: 'image' | 'audio' | 'video'; providerMediaId: string; mimeType: string; durationSec?: number }
  | { kind: 'contact'; phone: string; name?: string }
  | { kind: 'location'; lat: number; lng: number }
  | { kind: 'unsupported' };
export type Entry = { id: string; direction: 'in' | 'out'; at: string; message?: Out; inbound?: In; mediaUrl?: string; status?: string };
