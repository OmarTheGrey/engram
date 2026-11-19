// The invented facts the seeded-fault generator (card L2) writes into a
// LongMemEval memory state, and the sentences it writes them in. Every name
// and value here is made up for this set; none is taken from LongMemEval.
//
// A fact is an attribute of the user's life (or of the user's work, for the
// role scope) and a value. Within one question every attribute is used by at
// most one injected item group, so no two groups contradict each other by
// accident; every attribute has four values, so a group that needs two
// different values of one attribute always finds them.
//
// The sentences are shared by a fault and its near-miss: what makes an item
// faulty is a field the plane records (its validity, its class, its
// provenance, its source's later rewrite) or which value or attribute the
// sentence carries, never which sentence was chosen. No sentence names a
// fault class, a lint or the word fault.

export interface Fact {
  attribute: string;
  values: readonly [string, string, string, string];
}

/** Attributes of the user's own life: written to the person scope, and once to the role scope where they do not belong. */
export const PERSONAL: readonly Fact[] = [
  {
    attribute: "gym",
    values: ["Ironworks Fitness", "Harbor Athletic Club", "Northside Strength", "Summit Climbing"],
  },
  { attribute: "dentist", values: ["Dr. Alvarez", "Dr. Okafor", "Dr. Lindqvist", "Dr. Moreau"] },
  {
    attribute: "favourite coffee shop",
    values: ["Bean Theory", "The Daily Grind", "Copper Kettle", "Morning Ritual"],
  },
  {
    attribute: "car",
    values: [
      "a blue Honda Civic",
      "a grey Subaru Outback",
      "a red Mazda 3",
      "a white Toyota Corolla",
    ],
  },
  { attribute: "landlord", values: ["Mr. Haddad", "Ms. Petrova", "Mr. Nakamura", "Ms. Brennan"] },
  {
    attribute: "bank",
    values: ["First Harbor Credit Union", "Riverstone Bank", "Meridian Savings", "Oakline Bank"],
  },
  {
    attribute: "pharmacy",
    values: ["the CarePoint on Elm Street", "the Wellway on 3rd Avenue", "MedPlus", "GreenCross"],
  },
  {
    attribute: "barber",
    values: [
      "Tony at Sharp Cuts",
      "Lena at Studio Nine",
      "Marco at The Chair",
      "Sam at Fade House",
    ],
  },
  {
    attribute: "yoga studio",
    values: ["Lotus Flow", "Still Point Yoga", "Breathe Studio", "Sun Salute Collective"],
  },
  { attribute: "piano teacher", values: ["Mrs. Ito", "Mr. Delgado", "Ms. Varga", "Mr. Osei"] },
  { attribute: "vet", values: ["Dr. Kowalski", "Dr. Mensah", "Dr. Fischer", "Dr. Ramos"] },
  {
    attribute: "internet provider",
    values: ["Skylink Fiber", "NetWave", "Clearline", "Brightpath Broadband"],
  },
  {
    attribute: "mobile carrier",
    values: ["Volt Mobile", "Horizon Wireless", "Pulse Telecom", "Orbit Cell"],
  },
  {
    attribute: "usual running route",
    values: ["the river loop", "the park perimeter", "the old rail trail", "the harbour boardwalk"],
  },
  {
    attribute: "go-to pizza place",
    values: ["Napoli Corner", "Slice Republic", "Forno Rosso", "Pie Society"],
  },
  { attribute: "book club day", values: ["Tuesday", "Wednesday", "Thursday", "Sunday"] },
  {
    attribute: "favourite hiking trail",
    values: ["Eagle Ridge", "Cedar Falls", "Granite Loop", "Fox Hollow"],
  },
  { attribute: "eye doctor", values: ["Dr. Nguyen", "Dr. Abiodun", "Dr. Keller", "Dr. Santos"] },
  { attribute: "tennis partner", values: ["Priya", "Jonas", "Amara", "Felix"] },
  {
    attribute: "grocery store",
    values: ["FreshMart", "Green Basket", "Harvest Lane", "Market Square Foods"],
  },
  {
    attribute: "dry cleaner",
    values: ["Spotless on Main", "Crisp Cleaners", "Pressed Perfect", "Bluebell Cleaners"],
  },
  {
    attribute: "mechanic",
    values: [
      "Gus at Ace Auto",
      "Rita at Precision Motors",
      "Dev at Quick Fix",
      "Hal at Midtown Auto",
    ],
  },
  { attribute: "Spanish tutor", values: ["Lucia", "Mateo", "Carmen", "Diego"] },
  {
    attribute: "swimming pool",
    values: [
      "the Westside Aquatic Center",
      "the Lakeview Pool",
      "the Riverside Pool",
      "the Elm Park Lido",
    ],
  },
  {
    attribute: "favourite bakery",
    values: ["Crumb and Co", "Golden Crust", "Flour House", "Sweet Rise"],
  },
  { attribute: "physiotherapist", values: ["Dr. Hale", "Dr. Ivanova", "Dr. Mbeki", "Dr. Laurent"] },
  {
    attribute: "streaming service",
    values: ["StreamBox", "Cinewave", "Flixora", "ViewPort"],
  },
  {
    attribute: "insurance company",
    values: ["Shieldline", "Harborguard", "Truecover", "Northstar Mutual"],
  },
  {
    attribute: "favourite wine",
    values: ["a Rioja", "a Pinot Noir", "a Chenin Blanc", "a Malbec"],
  },
  { attribute: "accountant", values: ["Mr. Feld", "Ms. Adeyemi", "Mr. Rossi", "Ms. Holm"] },
  { attribute: "cleaning day", values: ["Monday", "Friday", "Saturday", "Tuesday"] },
  { attribute: "climbing partner", values: ["Noor", "Bastian", "Kiara", "Tomas"] },
  {
    attribute: "favourite sushi place",
    values: ["Umi Bar", "Sakura House", "Kaze Sushi", "Tsuki"],
  },
  { attribute: "cat's name", values: ["Miso", "Pepper", "Juniper", "Biscuit"] },
  {
    attribute: "bike",
    values: ["a green Trek hybrid", "a black Cannondale", "an orange Brompton", "a silver Giant"],
  },
  {
    attribute: "florist",
    values: ["Petal and Stem", "Bloom Room", "Wildflower Studio", "The Green Bouquet"],
  },
  { attribute: "parking spot", values: ["B14", "C22", "A07", "D31"] },
  { attribute: "locker number", values: ["112", "245", "318", "407"] },
  { attribute: "chess club night", values: ["Monday", "Wednesday", "Friday", "Thursday"] },
  {
    attribute: "favourite podcast",
    values: ["Deep Field", "The Long Table", "Small Hours", "Open Circuit"],
  },
];

/** Attributes of the user's work: what the role scope is for. */
export const WORK: readonly Fact[] = [
  { attribute: "team standup time", values: ["9:15", "9:30", "10:00", "8:45"] },
  { attribute: "sprint length", values: ["one week", "two weeks", "three weeks", "four weeks"] },
  { attribute: "project code name", values: ["Bluebird", "Kestrel", "Juniper", "Atlas"] },
  { attribute: "on-call rotation day", values: ["Monday", "Tuesday", "Wednesday", "Thursday"] },
  { attribute: "build server", values: ["ci-east-2", "ci-west-1", "build-03", "runner-pool-b"] },
  {
    attribute: "release train",
    values: ["every Tuesday", "every other Thursday", "the first Monday", "every Friday"],
  },
  {
    attribute: "design review room",
    values: ["Room 4B", "the Maple room", "Room 210", "the Harbor room"],
  },
  { attribute: "ticket tracker", values: ["Trackly", "Issuebase", "Taskforge", "Linebook"] },
  { attribute: "code freeze day", values: ["Thursday", "Wednesday", "Friday", "Monday"] },
  {
    attribute: "team chat channel",
    values: ["#core-dev", "#platform", "#team-orion", "#eng-north"],
  },
  {
    attribute: "deploy window",
    values: ["14:00 to 16:00", "10:00 to 12:00", "16:00 to 18:00", "09:00 to 11:00"],
  },
  { attribute: "expense approver", values: ["Dana", "Marcus", "Leila", "Owen"] },
];

/** What the user says about their own life, as a semantic item. */
export const statement = (attribute: string, value: string) => `My ${attribute} is ${value}.`;
/** What the user says when a value has changed since an earlier statement. */
export const update = (attribute: string, value: string) =>
  `Update: my ${attribute} is now ${value}.`;
/** What the user says to restate a value in the same breath. */
export const restatement = (attribute: string, value: string) =>
  `To be clear, my ${attribute} is ${value}.`;
/** A statement bounded in time; `until` is a date, `YYYY-MM-DD`. */
export const bounded = (attribute: string, value: string, until: string) =>
  `Until ${until}, my ${attribute} is ${value}.`;
/** What the user mentions in passing, as an episodic item. */
export const aside = (attribute: string, value: string) =>
  `By the way, my ${attribute} is ${value}.`;
/** What the user says about their work. */
export const workStatement = (attribute: string, value: string) =>
  `At work, our ${attribute} is ${value}.`;
/** A note a model extracts about the user. */
export const note = (attribute: string, value: string) => `The user's ${attribute} is ${value}.`;
/** A note a model extracts by quoting the user. */
export const quote = (excerpt: string) => `The user said: "${excerpt}"`;

/** Sentences a user turn is edited with after a note quoted it. */
export const EDITS = [
  "Edit: adding one more detail I forgot earlier.",
  "Edit: I fixed a couple of typos in this message.",
  "Edit: rephrased slightly for clarity.",
] as const;

/** The longest excerpt a quote takes from a turn, in characters. */
export const EXCERPT_MAX = 160;

/**
 * The first sentence of a turn, whitespace collapsed, cut at the last space
 * before EXCERPT_MAX characters when longer: a quote the turn supports.
 */
export function excerpt(content: string): string {
  const text = content.replace(/\s+/g, " ").trim();
  const end = /[.!?](?:\s|$)/.exec(text);
  const first = end ? text.slice(0, end.index + 1) : text;
  if (first.length <= EXCERPT_MAX) return first;
  const cut = first.slice(0, EXCERPT_MAX);
  const space = cut.lastIndexOf(" ");
  return space > 0 ? cut.slice(0, space) : cut;
}
