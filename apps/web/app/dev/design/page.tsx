import type { Metadata } from 'next';
import { Badge, Button, Checkbox, EmptyState, ErrorState, Field, Input, LevelBadge, PageHeader, PassportHeader, Panel, Seal, Select, Skeleton, Stat, Table, TD, TH, Textarea } from '@sp/ui';
import { DesignInteractive } from './interactive';

export const metadata: Metadata = { title: 'Design system', robots: { index: false } };

const swatches = [
  ['ink-900', '#0E4334', 'Primary ink'],
  ['ink-700', '#2F6B4F', 'Secondary ink · success'],
  ['ink-100', '#E3ECE7', 'Selected fill'],
  ['paper', '#F7F4EE', 'Background'],
  ['raised', '#FFFFFF', 'Surfaces'],
  ['rule', '#DDD6C8', 'Hairlines'],
  ['text', '#141414', 'Body text'],
  ['muted', '#5E6660', 'Secondary text'],
  ['accent', '#9A5419', 'Seals, accents (only accent)'],
  ['accent-mark', '#E16E18', 'Logo orange — marks only'],
  ['bronze', '#8C5A2B', 'Bronze'],
  ['silver', '#6B7176', 'Silver'],
  ['gold', '#8A6A1F', 'Gold'],
  ['danger', '#9B2C2C', 'Errors, disputes'],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-rule pt-6">
      <h2 className="smallcaps text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 md:px-6">
      <PageHeader eyebrow="Development" title="Design system" description="Tokens and components from packages/ui. See docs/DESIGN.md for the rules behind them." />

      <Section title="Colour">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {swatches.map(([name, hex, use]) => (
            <li key={name} className="flex flex-col gap-1.5 text-xs">
              <span className="h-14 rounded-md border border-rule" style={{ background: hex }} />
              <span className="font-mono">{name}</span>
              <span className="text-muted">{use}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type — six sizes, three families">
        <div className="flex flex-col gap-3">
          <p className="font-display text-display font-semibold">Tendai M.</p>
          <p className="font-display text-xl font-semibold">Page title · Fraunces 28</p>
          <p className="text-lg font-semibold">Section heading · Plex Sans 20</p>
          <p className="text-base">Body text for public pages · Plex Sans 16. Short sentences, plain and specific.</p>
          <p className="text-sm text-muted">Dashboard body and table cells · 14</p>
          <p className="smallcaps text-muted">Label · 12 small caps</p>
          <p className="serial">SP-HRE-00123 · J-7K3Q2 · 4.6</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Client name" htmlFor="d1" hint="As the artisan knows them.">
            <Input id="d1" placeholder="Mai Chiedza" />
          </Field>
          <Field label="Client phone" htmlFor="d2" error="That doesn’t look like a valid mobile number.">
            <Input id="d2" defaultValue="12345" aria-invalid />
          </Field>
          <Field label="Trade" htmlFor="d3">
            <Select id="d3" defaultValue="SOL">
              <option value="SOL">Solar PV installation</option>
              <option value="WLD">Welding and metal fabrication</option>
            </Select>
          </Field>
          <Field label="Note to the artisan" htmlFor="d4" optional="optional">
            <Textarea id="d4" placeholder="Specific and kind." />
          </Field>
          <Checkbox label="The artisan is with me" description="Required for agent-assisted jobs." defaultChecked />
        </div>
      </Section>

      <Section title="Badges, levels and seal">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Neutral</Badge>
          <Badge tone="ink">Ink</Badge>
          <Badge tone="success" dot>Verified</Badge>
          <Badge tone="warning">Pending</Badge>
          <Badge tone="danger">Disputed</Badge>
          <Badge tone="accent">Accent</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(['starter', 'bronze', 'silver', 'gold'] as const).map((l) => (
            <LevelBadge key={l} level={l} label={l} />
          ))}
          <span className="rounded-md bg-ink-900 p-3">
            <span className="flex gap-2">
              {(['starter', 'bronze', 'silver', 'gold'] as const).map((l) => (
                <LevelBadge key={l} level={l} label={l} onDark />
              ))}
            </span>
          </span>
          <Seal initials="FC" />
          <Seal initials="SN" size={48} />
        </div>
      </Section>

      <Section title="Passport header">
        <PassportHeader label="Skills Passport" name="Rudo N." meta={<span><span className="font-semibold text-paper">Welding and metal fabrication</span> · Highfield, Harare</span>} level="bronze" levelLabel="Bronze" levelCaption="Verified jobs" code="SP-HRE-00002" codeLabel="Passport no." footer="Member since Jul 2026" />
      </Section>

      <Section title="Figures and panels">
        <div className="grid grid-cols-3 gap-6">
          <Stat value="8" label="Confirmed jobs" />
          <Stat value="7" label="Clients served" />
          <Stat value="4.6" label="Average rating" hint="from 8 ratings" />
        </div>
        <Panel title="Panel title" actions={<Button size="sm" variant="ghost">Action</Button>}>
          <p className="p-4 text-sm text-muted">Hairline border, small radius, no shadow.</p>
        </Panel>
      </Section>

      <Section title="Table">
        <Table>
          <thead>
            <tr>
              <TH sort="desc">Joined</TH>
              <TH>Name</TH>
              <TH className="text-right">Jobs</TH>
            </tr>
          </thead>
          <tbody>
            <tr><TD className="font-mono text-xs">SP-HRE-00001</TD><TD>Tendai M.</TD><TD className="text-right font-mono">8</TD></tr>
            <tr><TD className="font-mono text-xs">SP-HRE-00002</TD><TD>Rudo N.</TD><TD className="text-right font-mono">5</TD></tr>
          </tbody>
        </Table>
      </Section>

      <Section title="States">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4" />
            <Skeleton className="h-24" />
          </div>
          <EmptyState title="The queue is clear" body="New jobs appear here when clients confirm them." action={<Button size="sm" variant="secondary">Refresh</Button>} />
          <ErrorState title="The queue could not load" body="Check your connection and try again." action={<Button size="sm" variant="secondary">Try again</Button>} />
        </div>
      </Section>

      <Section title="Tabs, dialog and toast">
        <DesignInteractive />
      </Section>
    </main>
  );
}
