/**
 * Realistic offline outputs for the mock SpeechToText and LlmProvider, one per seeded job type across the five pilot
 * trades. Fictional content only. Keys match JobType.key in the seed data.
 */
export interface JobFixture {
  transcript: string;
  summary: string;
  tasks: string[];
  materials: string[];
  safety_measures: string[];
  suggested_units: { code: string; confidence: number; evidence: string[] }[];
}

export const JOB_FIXTURES: Record<string, JobFixture> = {
  // ------------------------------------------------------------- Solar PV
  solar_battery_inverter_install: {
    transcript:
      'Today I installed a 3 kVA inverter for the client and two 200 amp-hour gel batteries. I mounted the inverter on the wall, connected the batteries in series for 24 volts, put a DC isolator and a 63 amp DC breaker between the batteries and the inverter, and used 16 mm cable. Before I started I switched off the main supply. At the end I tested the output and showed the client how to read the display.',
    summary:
      'Installed a 3 kVA inverter and two 200 Ah gel batteries in series (24 V), with a DC isolator and 63 A DC breaker, then tested the output and showed the client the display.',
    tasks: ['mounted inverter on wall', 'connected batteries in series', 'installed DC isolator and breaker', 'tested output', 'explained display to client'],
    materials: ['3 kVA inverter', '2 x 200 Ah gel batteries', '16 mm² cable', '63 A DC breaker', 'DC isolator'],
    safety_measures: ['isolated mains supply before wiring'],
    suggested_units: [
      { code: 'SOL-04', confidence: 0.88, evidence: ['photo_after_1', 'transcript'] },
      { code: 'SOL-05', confidence: 0.91, evidence: ['photo_after_1', 'transcript'] },
      { code: 'SOL-03', confidence: 0.84, evidence: ['photo_after_2', 'transcript'] },
      { code: 'SOL-07', confidence: 0.81, evidence: ['transcript'] },
      { code: 'SOL-08', confidence: 0.62, evidence: ['transcript'] },
    ],
  },
  solar_panel_mounting: {
    transcript:
      'I mounted four 450 watt panels on a corrugated iron roof. I used aluminium rails and roof hooks, and sealed every hole with silicone. I wore a harness tied to the roof truss. Then I ran the DC cable in conduit down to the isolator and earthed the frame.',
    summary: 'Mounted four 450 W panels on aluminium rails on an iron roof, sealed fixings, ran DC cable in conduit to the isolator and earthed the frame.',
    tasks: ['fixed roof hooks and rails', 'mounted four panels', 'sealed roof penetrations', 'ran DC cable in conduit', 'earthed array frame'],
    materials: ['4 x 450 W panels', 'aluminium rails', 'roof hooks', 'silicone sealant', '6 mm² PV cable', 'conduit'],
    safety_measures: ['used safety harness on roof'],
    suggested_units: [
      { code: 'SOL-02', confidence: 0.93, evidence: ['photo_after_1', 'transcript'] },
      { code: 'SOL-03', confidence: 0.82, evidence: ['transcript'] },
      { code: 'SOL-06', confidence: 0.8, evidence: ['transcript'] },
    ],
  },
  solar_full_system_install: {
    transcript:
      'This was a full system for a small shop. First I checked the loads: fridge, lights, a laptop and the till, about 2.5 kilowatt hours a day. Then I put up six panels, a 5 kVA hybrid inverter and a lithium battery. I installed surge protection and an earth spike. I commissioned it and gave the owner a maintenance card.',
    summary:
      'Designed and installed a complete system for a shop after a load assessment (about 2.5 kWh/day): six panels, a 5 kVA hybrid inverter, lithium battery, surge protection and earthing, then commissioned it and briefed the owner.',
    tasks: ['load assessment', 'panel installation', 'inverter and battery installation', 'surge protection and earthing', 'commissioning', 'customer handover'],
    materials: ['6 x 450 W panels', '5 kVA hybrid inverter', '5 kWh lithium battery', 'surge protection device', 'earth spike'],
    safety_measures: ['isolated supply', 'installed surge protection'],
    suggested_units: [
      { code: 'SOL-01', confidence: 0.86, evidence: ['transcript'] },
      { code: 'SOL-02', confidence: 0.83, evidence: ['photo_after_1'] },
      { code: 'SOL-05', confidence: 0.88, evidence: ['photo_after_2', 'transcript'] },
      { code: 'SOL-06', confidence: 0.85, evidence: ['transcript'] },
      { code: 'SOL-07', confidence: 0.82, evidence: ['transcript'] },
      { code: 'SOL-08', confidence: 0.8, evidence: ['transcript'] },
    ],
  },
  solar_site_assessment: {
    transcript:
      'I visited the house to plan a system. I listed all the appliances and how many hours they run, it came to about 4 kilowatt hours a day. I checked the roof faces north with no shade after nine in the morning. I recommended 8 panels and a 5 kVA inverter.',
    summary: 'Assessed a house for solar: listed appliance loads (about 4 kWh/day), checked roof orientation and shading, and recommended 8 panels with a 5 kVA inverter.',
    tasks: ['listed appliance loads', 'calculated daily energy use', 'checked roof orientation and shading', 'recommended system size'],
    materials: ['measuring tape', 'load sheet'],
    safety_measures: [],
    suggested_units: [{ code: 'SOL-01', confidence: 0.94, evidence: ['transcript'] }],
  },
  solar_fault_repair: {
    transcript:
      'The client said the system was not charging. I found a burnt MC4 connector on the string and water in the combiner box. I replaced the connector, dried and resealed the box, and tested the voltage on each string.',
    summary: 'Found a burnt MC4 connector and water in the combiner box, replaced and resealed them, and tested each string voltage.',
    tasks: ['diagnosed charging fault', 'replaced MC4 connector', 'resealed combiner box', 'tested string voltages'],
    materials: ['MC4 connectors', 'cable glands', 'silicone'],
    safety_measures: ['opened DC isolator before work'],
    suggested_units: [
      { code: 'SOL-03', confidence: 0.86, evidence: ['photo_after_1', 'transcript'] },
      { code: 'SOL-07', confidence: 0.83, evidence: ['transcript'] },
    ],
  },
  // ------------------------------------------------------------- Welding
  wld_gate: {
    transcript:
      'I made a double swing gate, 3.6 metres wide. I measured the opening, cut 40 by 40 square tubing, welded the frame flat on the bench and added the infill bars. I ground all the welds smooth and painted red oxide primer and black enamel. I wore my helmet, gloves and leather apron.',
    summary: 'Fabricated a 3.6 m double swing gate from 40×40 square tube, with infill bars, ground welds and primer plus enamel finish.',
    tasks: ['measured opening', 'cut square tubing', 'welded frame', 'welded infill bars', 'ground welds', 'primed and painted'],
    materials: ['40×40 square tube', '16 mm round bar', 'hinges', 'red oxide primer', 'black enamel'],
    safety_measures: ['welding helmet', 'leather gloves and apron'],
    suggested_units: [
      { code: 'WLD-01', confidence: 0.81, evidence: ['transcript'] },
      { code: 'WLD-02', confidence: 0.85, evidence: ['photo_before_1', 'transcript'] },
      { code: 'WLD-03', confidence: 0.88, evidence: ['photo_after_1'] },
      { code: 'WLD-05', confidence: 0.93, evidence: ['photo_after_1', 'transcript'] },
      { code: 'WLD-06', confidence: 0.87, evidence: ['photo_after_2', 'transcript'] },
      { code: 'WLD-07', confidence: 0.8, evidence: ['transcript'] },
    ],
  },
  wld_burglar_bars: {
    transcript: 'I made and fitted burglar bars for three windows. I cut 12 mm square bar, welded the frames, drilled and fixed them into the wall with rawl bolts, then painted them white.',
    summary: 'Made and fitted burglar bars for three windows from 12 mm square bar, fixed with rawl bolts and painted.',
    tasks: ['measured windows', 'cut and welded bars', 'fixed to wall', 'painted'],
    materials: ['12 mm square bar', 'rawl bolts', 'white enamel'],
    safety_measures: ['eye protection while grinding'],
    suggested_units: [
      { code: 'WLD-02', confidence: 0.82, evidence: ['transcript'] },
      { code: 'WLD-05', confidence: 0.9, evidence: ['photo_after_1'] },
      { code: 'WLD-06', confidence: 0.81, evidence: ['photo_after_1'] },
    ],
  },
  wld_repair: {
    transcript: 'A cart axle bracket was cracked. I cleaned it, ground a V groove, and welded it in the overhead position because the cart could not be turned over. Then I added a gusset plate for strength.',
    summary: 'Repaired a cracked cart axle bracket with an overhead weld after V-grooving, and added a gusset plate.',
    tasks: ['prepared crack with V groove', 'overhead weld', 'added gusset plate'],
    materials: ['E6013 electrodes', '6 mm plate'],
    safety_measures: ['helmet and gloves'],
    suggested_units: [
      { code: 'WLD-04', confidence: 0.84, evidence: ['transcript'] },
      { code: 'WLD-02', confidence: 0.8, evidence: ['transcript'] },
    ],
  },
  // ------------------------------------------------------------- Plumbing
  plb_geyser: {
    transcript:
      'I installed a 150 litre geyser in the roof. I put in the drip tray, the pressure control valve, the vacuum breakers and the safety valve, and ran the overflow outside. I used 22 mm copper with compression fittings. I filled it and checked for leaks before switching on the element.',
    summary: 'Installed a 150 L geyser with drip tray, pressure control valve, vacuum breakers and safety valve in 22 mm copper, then filled and leak-tested before power-on.',
    tasks: ['fitted drip tray', 'installed geyser', 'fitted valves', 'ran overflow', 'filled and leak-tested'],
    materials: ['150 L geyser', '22 mm copper pipe', 'compression fittings', 'pressure control valve', 'vacuum breakers'],
    safety_measures: ['filled geyser before switching on element'],
    suggested_units: [
      { code: 'PLB-05', confidence: 0.94, evidence: ['photo_after_1', 'transcript'] },
      { code: 'PLB-01', confidence: 0.83, evidence: ['transcript'] },
      { code: 'PLB-07', confidence: 0.8, evidence: ['transcript'] },
    ],
  },
  plb_toilet_basin: {
    transcript: 'I replaced a broken toilet and fitted a new wash basin. I connected the pan to the soil pipe with a new connector, fitted the cistern and flexible hoses and sealed everything with silicone.',
    summary: 'Replaced a toilet and fitted a new wash basin, connecting the pan to the soil pipe and sealing all fittings.',
    tasks: ['removed old toilet', 'fitted pan and cistern', 'fitted basin', 'connected supply hoses', 'sealed fittings'],
    materials: ['toilet suite', 'pan connector', 'wash basin', 'flexible hoses', 'silicone'],
    safety_measures: ['closed supply valve before work'],
    suggested_units: [
      { code: 'PLB-04', confidence: 0.95, evidence: ['photo_after_1', 'transcript'] },
      { code: 'PLB-01', confidence: 0.72, evidence: ['transcript'] },
    ],
  },
  plb_leak_repair: {
    transcript: 'There was water on the wall. I opened the wall and found a split in a PVC pipe joint. I cut it out, joined a new section with solvent cement, waited, then pressurised it to check.',
    summary: 'Traced a leak to a split PVC joint inside a wall, replaced the section with solvent-welded fittings and pressure-checked it.',
    tasks: ['traced leak', 'cut out damaged section', 'solvent-welded new section', 'pressure check'],
    materials: ['PVC pipe', 'solvent cement', 'couplings'],
    safety_measures: [],
    suggested_units: [
      { code: 'PLB-06', confidence: 0.92, evidence: ['transcript'] },
      { code: 'PLB-01', confidence: 0.84, evidence: ['photo_after_1'] },
      { code: 'PLB-07', confidence: 0.7, evidence: ['transcript'] },
    ],
  },
  // ------------------------------------------------------------- Motor mechanics
  mec_service: {
    transcript: 'Full service on a Honda Fit. I changed the oil and filter, the air filter and the spark plugs, checked the brake fluid and coolant, and reset the service light.',
    summary: 'Full service on a Honda Fit: oil and filter, air filter, spark plugs, fluid checks and service light reset.',
    tasks: ['oil and filter change', 'air filter change', 'spark plugs', 'fluid checks', 'reset service light'],
    materials: ['5W-30 oil', 'oil filter', 'air filter', 'spark plugs'],
    safety_measures: ['used axle stands'],
    suggested_units: [
      { code: 'MEC-01', confidence: 0.95, evidence: ['transcript'] },
      { code: 'MEC-07', confidence: 0.74, evidence: ['transcript'] },
    ],
  },
  mec_brakes: {
    transcript: 'The client had grinding brakes on a Toyota Corolla. I replaced the front pads and skimmed the discs, bled the system with new fluid and road-tested it.',
    summary: 'Replaced front brake pads, skimmed discs, bled the brake system and road-tested a Toyota Corolla.',
    tasks: ['replaced front pads', 'skimmed discs', 'bled brakes', 'road test'],
    materials: ['brake pads', 'DOT 4 brake fluid'],
    safety_measures: ['used axle stands', 'road test after repair'],
    suggested_units: [{ code: 'MEC-02', confidence: 0.95, evidence: ['photo_after_1', 'transcript'] }],
  },
  mec_engine_diag: {
    transcript: 'The engine light was on and the car was misfiring. I scanned it, found a misfire on cylinder 3, swapped the coil to confirm, and replaced the faulty ignition coil.',
    summary: 'Diagnosed a cylinder 3 misfire with a scanner and coil swap test, and replaced the faulty ignition coil.',
    tasks: ['scanned fault codes', 'coil swap test', 'replaced ignition coil', 'cleared codes'],
    materials: ['ignition coil'],
    safety_measures: [],
    suggested_units: [
      { code: 'MEC-03', confidence: 0.93, evidence: ['transcript'] },
      { code: 'MEC-05', confidence: 0.82, evidence: ['transcript'] },
    ],
  },
  // ------------------------------------------------------------- Tailoring
  tlr_dress: {
    transcript: 'I made a dress for a wedding. I took the client’s measurements, drafted the pattern, cut the chitenge fabric, sewed it on the machine, did a fitting, then finished the hem and the zip.',
    summary: 'Made a wedding dress in chitenge fabric from measurements and a drafted pattern, with a fitting, hem and zip finish.',
    tasks: ['took measurements', 'drafted pattern', 'cut fabric', 'machine sewing', 'fitting', 'hem and zip'],
    materials: ['chitenge fabric', 'invisible zip', 'thread', 'interfacing'],
    safety_measures: [],
    suggested_units: [
      { code: 'TLR-01', confidence: 0.92, evidence: ['transcript'] },
      { code: 'TLR-02', confidence: 0.87, evidence: ['transcript'] },
      { code: 'TLR-03', confidence: 0.85, evidence: ['photo_before_1'] },
      { code: 'TLR-04', confidence: 0.88, evidence: ['photo_after_1'] },
      { code: 'TLR-05', confidence: 0.81, evidence: ['transcript'] },
      { code: 'TLR-06', confidence: 0.86, evidence: ['photo_after_2'] },
    ],
  },
  tlr_school_uniform: {
    transcript: 'I sewed ten school uniforms for a primary school, five shirts and five tunics, in different sizes from the measurement list.',
    summary: 'Sewed ten school uniforms (five shirts, five tunics) in sizes from the school’s measurement list.',
    tasks: ['cut fabric to sizes', 'machine sewing', 'buttons and hems'],
    materials: ['poly-cotton fabric', 'buttons', 'thread'],
    safety_measures: [],
    suggested_units: [
      { code: 'TLR-03', confidence: 0.86, evidence: ['transcript'] },
      { code: 'TLR-04', confidence: 0.9, evidence: ['photo_after_1'] },
      { code: 'TLR-06', confidence: 0.84, evidence: ['photo_after_1'] },
    ],
  },
  tlr_alterations: {
    transcript: 'I took in a suit jacket at the waist and shortened the trousers, then pressed everything.',
    summary: 'Altered a suit: took in the jacket waist, shortened the trousers and pressed both.',
    tasks: ['took in jacket', 'shortened trousers', 'pressed garments'],
    materials: ['thread'],
    safety_measures: [],
    suggested_units: [
      { code: 'TLR-05', confidence: 0.93, evidence: ['transcript'] },
      { code: 'TLR-06', confidence: 0.8, evidence: ['transcript'] },
    ],
  },
};

/** Generic fallback for job types without a dedicated fixture. */
export const DEFAULT_FIXTURE: JobFixture = {
  transcript: 'I finished the job for the client and checked that everything works. The client was happy with the work.',
  summary: 'Completed the job and checked the work with the client.',
  tasks: ['completed the job', 'checked the work with the client'],
  materials: [],
  safety_measures: [],
  suggested_units: [],
};

export function fixtureFor(jobTypeKey: string | undefined): JobFixture {
  return (jobTypeKey && JOB_FIXTURES[jobTypeKey]) || DEFAULT_FIXTURE;
}
