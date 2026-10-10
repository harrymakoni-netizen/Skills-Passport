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
    links: { find: 'Find an artisan', signIn: 'Staff and buyer sign in', privacy: 'Privacy' },
  },
  privacy: {
    title: 'Privacy policy',
    updated: 'Last updated 10 October 2026',
    intro:
      'Skills Passport keeps a record of work done by artisans in Zimbabwe, confirmed by their clients on WhatsApp and reviewed by master artisans. This page explains what we collect, why, who can see it and how to have it removed. We follow the Cyber and Data Protection Act [Chapter 12:07].',
    sections: [
      {
        title: 'What we collect',
        items: [
          'Artisans: name, WhatsApp number, year of birth (to check the 18–35 age range), trade, city and area, years of experience and how you learned, and an optional profile photo.',
          'Jobs: photos, voice notes and their transcripts, the job type, date and area, and optionally the price and the job location.',
          'Clients: the name and WhatsApp number an artisan gives us, and the client’s answer, rating and comment.',
          'Optional: gender and disability, only with separate consent, used for anonymous pilot statistics unless you choose to show a badge.',
          'Staff and buyers: name, email, phone number and a record of sign-ins and admin actions.',
        ],
      },
      {
        title: 'Why we use it',
        items: [
          'To build each artisan’s passport: confirming jobs with clients, reviewing quality and calculating levels.',
          'To send WhatsApp messages you asked for, or that a job needs (for example, asking a client to confirm a job).',
          'To prevent fraud, such as repeated photos or artisans confirming their own jobs.',
          'To publish anonymous pilot statistics. Groups smaller than five people are never shown.',
        ],
      },
      {
        title: 'What is public',
        items: [
          'A passport page shows the artisan’s first name and initial, trade, area, level, confirmed job counts, ratings, endorsements and the job photos the artisan chose to make public.',
          'Phone numbers, exact locations, prices and client details are never public. Location data is removed from every public photo.',
          'Buyers receive an artisan’s contact details only after the artisan accepts their work request.',
        ],
      },
      {
        title: 'How we protect it',
        items: [
          'Names and phone numbers are encrypted in our database. Phone numbers are matched using a one-way fingerprint, so the number itself is not needed to look someone up.',
          'Phone numbers never appear in logs, analytics or anything sent to AI services.',
          'Staff accounts use two-step sign-in. Access to personal data is recorded in an audit log.',
        ],
      },
      {
        title: 'Who processes it for us',
        items: [
          'Meta (WhatsApp Business Platform) carries our WhatsApp messages.',
          'Our website and database are hosted by Vercel and Neon in the European Union (Frankfurt).',
          'When automatic transcription and job summaries are switched on, voice notes and job text, with names and numbers removed, are processed by a speech-to-text service and by Anthropic. Their suggestions are advisory: only a master artisan can verify a skill.',
          'We do not sell personal data and do not use it for advertising.',
        ],
      },
      {
        title: 'Your choices and rights',
        items: [
          'Artisans can delete their account from the WhatsApp menu (Settings → Delete my account). The passport page goes offline at once and personal data is deleted within 30 days. Anonymous statistics are kept.',
          'Clients can tap “Stop messages” on any message from us, and we will not contact them again.',
          'You can ask to see, correct or delete the personal data we hold about you.',
        ],
      },
    ],
    contactTitle: 'Contact',
    contactWhatsApp: 'Send “help” to the Skills Passport WhatsApp number.',
    contactEmail: 'Email {email}.',
    operator: 'Skills Passport is operated by {name}.',
    notOfficial: 'Skills Passport is not an official trade-test certificate.',
  },
};
