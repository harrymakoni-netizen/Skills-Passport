/**
 * English copy for the marketing page and staff dashboards (staff work in English during the pilot).
 * Artisan/client-facing pages use the en/sn/nd catalogue in packages/core. Kept in one module so it can move into the
 * catalogue when the dashboards are translated.
 */
export const site = {
  nav: { find: 'Find an artisan', how: 'How it works', levels: 'Levels', signIn: 'Sign in' },
  hero: {
    eyebrow: 'Skills Passport · Zimbabwe',
    title: 'A record of real work, confirmed by the people who paid for it.',
    body: 'Young artisans log each job on WhatsApp with photos and a voice note. The client confirms with one tap. Master artisans in the same trade review the quality. Every confirmed job adds to a passport that buyers, employers and lenders can check.',
    primary: 'See an example passport',
    secondary: 'Find an artisan',
    note: 'Pilot in Harare and Bulawayo · Solar, welding, plumbing, motor mechanics and tailoring',
  },
  how: {
    title: 'How a job becomes part of the record',
    steps: [
      { n: '01', title: 'Log the job on WhatsApp', body: 'After finishing, the artisan sends before and after photos and a short voice note in English, chiShona or isiNdebele. No app to install.', quote: 'Send a voice note: what you did, the materials you used and any problem you solved.' },
      { n: '02', title: 'The client confirms', body: 'The client gets one WhatsApp message and taps “Yes, it was done”. They can rate the work and see the photos. They never need an account.', quote: 'Tendai says they did ‘Battery and inverter installation’ for you on 12 Nov. Was this work done?' },
      { n: '03', title: 'A master artisan reviews', body: 'Experienced artisans in the same trade review every new artisan’s first jobs, a random share after that, and every flagged or disputed job.', quote: 'Meets the standard · Needs improvement · Not accepted' },
      { n: '04', title: 'The passport grows', body: 'Confirmed jobs, different clients, endorsements and verified skills move the artisan from Starter to Bronze, Silver and Gold.', quote: '2 more jobs from new clients to reach Bronze.' },
    ],
  },
  levels: {
    title: 'Levels are earned, and can be lost',
    body: 'Levels are recalculated after every job. Rejected jobs or withdrawn endorsements can move an artisan down.',
    rows: [
      { level: 'starter', shown: 'New member', req: 'Passport created on WhatsApp or with a field agent.' },
      { level: 'bronze', shown: 'Verified jobs', req: '3 confirmed jobs from at least 3 different clients.' },
      { level: 'silver', shown: 'Endorsed artisan', req: '5 confirmed jobs, 4 clients, an endorsement from a master artisan, average rating 3.5 or more, no open disputes.' },
      { level: 'gold', shown: 'Trade-test ready', req: '12 jobs over at least 3 months, 8 clients, endorsements from 2 master artisans, 70% of the trade’s skills verified.' },
    ] as const,
  },
  honest: {
    title: 'Built so the record can be trusted',
    items: [
      { title: 'One tap from a real client', body: 'A client’s number can’t be the artisan’s own, another artisan’s or a verifier’s. Only two jobs per client count in any 30 days.' },
      { title: 'Photos are checked', body: 'Every photo is fingerprinted. Re-used, screenshot or downloaded images are flagged for review, never silently accepted.' },
      { title: 'People decide, not software', body: 'AI transcribes voice notes and suggests which skills a job shows. Only a master artisan can verify a skill or endorse an artisan.' },
      { title: 'Private by default', body: 'Phone numbers, exact locations, prices and client details never appear on a passport. Artisans choose which photos are public.' },
    ],
  },
  trades: { title: 'Pilot trades', body: 'Each trade has a draft framework of competency units, written with master artisans and mapped to national trade-test standards as they are confirmed.' },
  footer: {
    disclaimer: 'Skills Passport is a record of work confirmed by clients and reviewed by master artisans. It is not an official trade-test certificate.',
    links: { find: 'Find an artisan', signIn: 'Staff and buyer sign in' },
  },
};
