/**
 * Reference data from SPEC section 7 (draft competency units) and section 1 (pilot areas).
 * DRAFT — finalise each unit list with at least two master artisans per trade and align with official unit
 * standards before launch. Unit titles in sn/nd currently repeat the English technical term (needs translation review).
 */
export interface UnitSeed {
  code: string;
  title: string;
  description: string;
  evidence: string;
}
export interface JobTypeSeed {
  key: string;
  name: string;
  nameSn?: string;
  nameNd?: string;
  needsBefore: boolean;
  units: string[];
}
export interface TradeSeed {
  code: string;
  en: string;
  sn: string;
  nd: string;
  units: UnitSeed[];
  jobTypes: JobTypeSeed[];
}

export const TRADES: TradeSeed[] = [
  {
    code: 'SOL',
    en: 'Solar PV installation',
    sn: 'Kuisa masolar',
    nd: 'Ukufaka i-solar',
    units: [
      { code: 'SOL-01', title: 'Site assessment and load calculation', description: 'Lists appliances and usage, calculates daily energy demand and sizes panels, inverter and batteries; checks roof orientation and shading.', evidence: 'Voice note describing the load list and sizing; photo of the load sheet or roof orientation.' },
      { code: 'SOL-02', title: 'Panel mounting and safe roof work', description: 'Fixes rails and panels securely, seals roof penetrations and works at height with fall protection.', evidence: 'Photos of the finished array and fixings; voice note mentioning harness or ladder safety.' },
      { code: 'SOL-03', title: 'DC wiring and protection', description: 'Runs correctly sized DC cable with isolators, fuses or breakers and correct polarity; uses MC4 connectors properly.', evidence: 'Photos of DC isolator, breaker and cable routing; voice note naming cable size and protection.' },
      { code: 'SOL-04', title: 'Battery installation and safety', description: 'Installs and connects batteries in the correct series/parallel configuration with ventilation, terminal protection and fusing.', evidence: 'Photos of the battery bank and connections; voice note on configuration and voltage.' },
      { code: 'SOL-05', title: 'Inverter installation and set-up', description: 'Mounts and configures the inverter or hybrid unit, including charge settings and AC output.', evidence: 'Photo of the mounted inverter and display; voice note on settings.' },
      { code: 'SOL-06', title: 'Earthing and surge protection', description: 'Installs earth electrode, bonds array frames and fits surge protection devices.', evidence: 'Photos of the earth spike, bonding and SPD; voice note describing earthing.' },
      { code: 'SOL-07', title: 'Testing and commissioning', description: 'Measures string and battery voltages, checks output under load and records results.', evidence: 'Photo of a meter reading or inverter display; voice note on tests done.' },
      { code: 'SOL-08', title: 'Customer handover and maintenance advice', description: 'Explains safe operation, monitoring and basic maintenance to the customer.', evidence: 'Voice note describing what was explained; photo of a handover card if used.' },
    ],
    jobTypes: [
      { key: 'solar_battery_inverter_install', name: 'Battery and inverter installation', nameSn: 'Kuisa bhatiri ne inverter', nameNd: 'Ukufaka ibhetri le inverter', needsBefore: true, units: ['SOL-03', 'SOL-04', 'SOL-05', 'SOL-07', 'SOL-08'] },
      { key: 'solar_panel_mounting', name: 'Panel mounting', nameSn: 'Kuisa mapanera', nameNd: 'Ukufaka amaphaneli', needsBefore: true, units: ['SOL-02', 'SOL-03', 'SOL-06'] },
      { key: 'solar_full_system_install', name: 'Full system installation', nameSn: 'Kuisa system yese', nameNd: 'Ukufaka uhlelo lonke', needsBefore: true, units: ['SOL-01', 'SOL-02', 'SOL-03', 'SOL-04', 'SOL-05', 'SOL-06', 'SOL-07', 'SOL-08'] },
      { key: 'solar_site_assessment', name: 'Site assessment and quote', nameSn: 'Kuongorora nzvimbo', nameNd: 'Ukuhlola indawo', needsBefore: false, units: ['SOL-01'] },
      { key: 'solar_fault_repair', name: 'Fault finding and repair', nameSn: 'Kugadzirisa fault', nameNd: 'Ukulungisa iphutha', needsBefore: true, units: ['SOL-03', 'SOL-07'] },
    ],
  },
  {
    code: 'WLD',
    en: 'Welding and metal fabrication',
    sn: 'Kuwelda nekugadzira simbi',
    nd: 'Ukuwelda lokwakha insimbi',
    units: [
      { code: 'WLD-01', title: 'Reading drawings and measuring', description: 'Takes accurate measurements and works from sketches or drawings.', evidence: 'Photo of measurements or sketch; voice note on dimensions.' },
      { code: 'WLD-02', title: 'Cutting and preparing metal', description: 'Cuts, bevels and cleans material to size before welding.', evidence: 'Before photos of cut material; voice note on preparation.' },
      { code: 'WLD-03', title: 'Arc welding, flat position', description: 'Produces sound, even flat-position welds with correct electrode and current.', evidence: 'Close-up photos of welds; voice note on electrode and current.' },
      { code: 'WLD-04', title: 'Arc welding, vertical and overhead', description: 'Produces sound welds in vertical and overhead positions.', evidence: 'Photos of positional welds; voice note describing position.' },
      { code: 'WLD-05', title: 'Fabricating gates, frames and burglar bars', description: 'Builds square, strong gates, frames and burglar bars that fit the opening.', evidence: 'Photos of the finished item installed.' },
      { code: 'WLD-06', title: 'Grinding, finishing and painting', description: 'Grinds welds smooth, removes rust and applies primer and paint.', evidence: 'Photos of finished, painted work.' },
      { code: 'WLD-07', title: 'Workshop safety and PPE', description: 'Uses helmet, gloves, eye protection and safe workshop practice.', evidence: 'Voice note on PPE used; photo of PPE if available.' },
    ],
    jobTypes: [
      { key: 'wld_gate', name: 'Gate fabrication', nameSn: 'Kugadzira gedhi', nameNd: 'Ukwenza igede', needsBefore: true, units: ['WLD-01', 'WLD-02', 'WLD-03', 'WLD-05', 'WLD-06', 'WLD-07'] },
      { key: 'wld_burglar_bars', name: 'Burglar bars', nameSn: 'Mabhurogera bhawa', nameNd: 'Amabhurogila', needsBefore: false, units: ['WLD-02', 'WLD-03', 'WLD-05', 'WLD-06'] },
      { key: 'wld_repair', name: 'Welding repair', nameSn: 'Kugadzirisa nekuwelda', nameNd: 'Ukulungisa ngokuwelda', needsBefore: true, units: ['WLD-02', 'WLD-03', 'WLD-04', 'WLD-06'] },
      { key: 'wld_frame_structure', name: 'Frames and structures', nameSn: 'Mafuremu', nameNd: 'Amafulemu', needsBefore: false, units: ['WLD-01', 'WLD-02', 'WLD-03', 'WLD-04', 'WLD-05'] },
    ],
  },
  {
    code: 'PLB',
    en: 'Plumbing',
    sn: 'Kuplamba',
    nd: 'Ukuplamba',
    units: [
      { code: 'PLB-01', title: 'Pipe cutting and joining', description: 'Cuts and joins PVC, copper and galvanised pipe with the right fittings and methods.', evidence: 'Photos of joints and fittings; voice note naming pipe type and method.' },
      { code: 'PLB-02', title: 'Water supply installation', description: 'Installs cold and hot water supply lines with valves and correct pressure.', evidence: 'Photos of supply runs and valves.' },
      { code: 'PLB-03', title: 'Drainage and waste systems', description: 'Installs drains and waste pipes with correct falls, traps and access.', evidence: 'Photos of drainage runs and traps.' },
      { code: 'PLB-04', title: 'Sanitary fittings', description: 'Fits toilets, basins and sinks level, sealed and connected.', evidence: 'Photos of finished fittings.' },
      { code: 'PLB-05', title: 'Geyser and solar water heater installation', description: 'Installs geysers and solar heaters with drip tray, safety valves and vacuum breakers.', evidence: 'Photos of geyser, valves and drip tray; voice note on safety valves.' },
      { code: 'PLB-06', title: 'Leak detection and repair', description: 'Finds and repairs leaks with minimal damage.', evidence: 'Before and after photos; voice note on how the leak was found.' },
      { code: 'PLB-07', title: 'Pressure testing', description: 'Pressure-tests new installations and records the result.', evidence: 'Photo of gauge or test; voice note on the test.' },
    ],
    jobTypes: [
      { key: 'plb_pipe_install', name: 'Pipe installation', needsBefore: false, units: ['PLB-01', 'PLB-02', 'PLB-07'] },
      { key: 'plb_toilet_basin', name: 'Toilet or basin fitting', needsBefore: false, units: ['PLB-04', 'PLB-01'] },
      { key: 'plb_geyser', name: 'Geyser installation', needsBefore: true, units: ['PLB-05', 'PLB-01', 'PLB-02', 'PLB-07'] },
      { key: 'plb_leak_repair', name: 'Leak repair', needsBefore: true, units: ['PLB-06', 'PLB-01', 'PLB-07'] },
      { key: 'plb_drainage', name: 'Drainage work', needsBefore: true, units: ['PLB-03', 'PLB-01'] },
    ],
  },
  {
    code: 'MEC',
    en: 'Motor mechanics',
    sn: 'Kugadzira mota',
    nd: 'Ukulungisa izimota',
    units: [
      { code: 'MEC-01', title: 'Routine service', description: 'Changes oil, filters and plugs and checks fluids to the manufacturer schedule.', evidence: 'Photos of parts replaced; voice note listing the service items.' },
      { code: 'MEC-02', title: 'Brakes and suspension', description: 'Inspects and repairs brakes and suspension, including bleeding brakes.', evidence: 'Photos of brake work; voice note on parts and road test.' },
      { code: 'MEC-03', title: 'Engine diagnosis', description: 'Diagnoses faults systematically using scan tools and tests.', evidence: 'Voice note describing the diagnosis steps; photo of scan tool reading.' },
      { code: 'MEC-04', title: 'Engine repair and overhaul', description: 'Dismantles, repairs and reassembles engines to specification.', evidence: 'Before and after photos; voice note on the repair.' },
      { code: 'MEC-05', title: 'Electrical systems and batteries', description: 'Tests and repairs charging, starting, lighting and ignition systems.', evidence: 'Photos and voice note on the electrical fault and fix.' },
      { code: 'MEC-06', title: 'Transmission and clutch', description: 'Repairs clutches and gearboxes.', evidence: 'Photos of clutch or gearbox work.' },
      { code: 'MEC-07', title: 'Workshop safety', description: 'Uses stands, chocks and safe lifting and disposes of oil safely.', evidence: 'Voice note on safety steps.' },
    ],
    jobTypes: [
      { key: 'mec_service', name: 'Routine service', needsBefore: false, units: ['MEC-01', 'MEC-07'] },
      { key: 'mec_brakes', name: 'Brake repair', needsBefore: true, units: ['MEC-02', 'MEC-07'] },
      { key: 'mec_engine_diag', name: 'Engine diagnosis', needsBefore: false, units: ['MEC-03', 'MEC-05'] },
      { key: 'mec_engine_overhaul', name: 'Engine overhaul', needsBefore: true, units: ['MEC-04', 'MEC-03'] },
      { key: 'mec_clutch', name: 'Clutch replacement', needsBefore: true, units: ['MEC-06'] },
      { key: 'mec_electrical', name: 'Electrical repair', needsBefore: false, units: ['MEC-05'] },
    ],
  },
  {
    code: 'TLR',
    en: 'Tailoring',
    sn: 'Kusona',
    nd: 'Ukuthunga',
    units: [
      { code: 'TLR-01', title: 'Taking measurements', description: 'Takes and records accurate body measurements.', evidence: 'Photo of the measurement record; voice note.' },
      { code: 'TLR-02', title: 'Pattern drafting', description: 'Drafts patterns from measurements.', evidence: 'Photo of the drafted pattern.' },
      { code: 'TLR-03', title: 'Cutting fabric', description: 'Lays out and cuts fabric economically and on grain.', evidence: 'Photo of cut pieces or layout.' },
      { code: 'TLR-04', title: 'Machine sewing and seams', description: 'Sews straight, strong seams with suitable stitch and finish.', evidence: 'Close-up photos of seams.' },
      { code: 'TLR-05', title: 'Fitting and alterations', description: 'Fits garments on the client and alters for a good fit.', evidence: 'Before and after photos; voice note on the alteration.' },
      { code: 'TLR-06', title: 'Finishing', description: 'Finishes hems, buttons, zips and pressing neatly.', evidence: 'Close-up photos of finishing.' },
      { code: 'TLR-07', title: 'Garment design for customers', description: 'Designs garments with customers, including style and fabric advice.', evidence: 'Photos of the design and finished garment; voice note.' },
    ],
    jobTypes: [
      { key: 'tlr_dress', name: 'Dress making', nameSn: 'Kusona rokwe', nameNd: 'Ukuthunga ilokwe', needsBefore: false, units: ['TLR-01', 'TLR-02', 'TLR-03', 'TLR-04', 'TLR-06', 'TLR-07'] },
      { key: 'tlr_suit', name: 'Suit making', needsBefore: false, units: ['TLR-01', 'TLR-02', 'TLR-03', 'TLR-04', 'TLR-05', 'TLR-06'] },
      { key: 'tlr_school_uniform', name: 'School uniforms', nameSn: 'Yunifomu dzechikoro', nameNd: 'Umfaniswano wesikolo', needsBefore: false, units: ['TLR-01', 'TLR-03', 'TLR-04', 'TLR-06'] },
      { key: 'tlr_alterations', name: 'Alterations', nameSn: 'Kugadzirisa hembe', nameNd: 'Ukulungisa izigqoko', needsBefore: true, units: ['TLR-05', 'TLR-06'] },
    ],
  },
];

export const AREAS = [
  { name: 'Mbare', city: 'Harare', cityCode: 'HRE', province: 'Harare', lat: -17.8575, lng: 31.0399 },
  { name: 'Glen View', city: 'Harare', cityCode: 'HRE', province: 'Harare', lat: -17.9067, lng: 30.9681 },
  { name: 'Highfield', city: 'Harare', cityCode: 'HRE', province: 'Harare', lat: -17.8861, lng: 30.9964 },
  { name: 'Budiriro', city: 'Harare', cityCode: 'HRE', province: 'Harare', lat: -17.8989, lng: 30.9408 },
  { name: 'Makokoba', city: 'Bulawayo', cityCode: 'BYO', province: 'Bulawayo', lat: -20.1472, lng: 28.5672 },
  { name: 'Nkulumane', city: 'Bulawayo', cityCode: 'BYO', province: 'Bulawayo', lat: -20.1931, lng: 28.5236 },
];
