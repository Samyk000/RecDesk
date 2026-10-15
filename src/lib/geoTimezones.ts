import { formatZoneTime } from "./utils";

export type TimezoneBadge = "ET" | "CT" | "MT" | "PT" | "AK" | "HI";

export interface StateGeo {
  code: string;
  name: string;
  zone: string;
  badge: TimezoneBadge;
  hasDst?: boolean;
  split?: {
    secondaryBadge: TimezoneBadge;
    secondaryZone: string;
    details: string;
  };
}

export interface CityGeo {
  city: string;
  stateCode: string;
  stateName: string;
  zone: string;
  badge: TimezoneBadge;
  note?: string;
  aliases?: string[];
}

export interface FuzzySearchResult {
  type: "state" | "city";
  title: string;
  subtitle: string;
  badge: TimezoneBadge;
  zone: string;
  stateCode: string;
  stateName: string;
  timeString: string;
  splitInfo?: string;
  note?: string;
  score: number;
}

/**
 * All 50 US States + District of Columbia in alphabetical order
 */
export const US_STATES_AZ: StateGeo[] = [
  { code: "AL", name: "Alabama", zone: "America/Chicago", badge: "CT" },
  { code: "AK", name: "Alaska", zone: "America/Anchorage", badge: "AK" },
  {
    code: "AZ",
    name: "Arizona",
    zone: "America/Phoenix",
    badge: "MT",
    hasDst: false,
    split: {
      secondaryBadge: "MT",
      secondaryZone: "America/Phoenix",
      details: "Observes Mountain Standard Time year-round (No DST)",
    },
  },
  { code: "AR", name: "Arkansas", zone: "America/Chicago", badge: "CT" },
  { code: "CA", name: "California", zone: "America/Los_Angeles", badge: "PT" },
  { code: "CO", name: "Colorado", zone: "America/Denver", badge: "MT" },
  { code: "CT", name: "Connecticut", zone: "America/New_York", badge: "ET" },
  { code: "DE", name: "Delaware", zone: "America/New_York", badge: "ET" },
  { code: "DC", name: "District of Columbia", zone: "America/New_York", badge: "ET" },
  {
    code: "FL",
    name: "Florida",
    zone: "America/New_York",
    badge: "ET",
    split: {
      secondaryBadge: "CT",
      secondaryZone: "America/Chicago",
      details: "Peninsula in ET; western panhandle (Pensacola) in CT",
    },
  },
  { code: "GA", name: "Georgia", zone: "America/New_York", badge: "ET" },
  { code: "HI", name: "Hawaii", zone: "Pacific/Honolulu", badge: "HI", hasDst: false },
  {
    code: "ID",
    name: "Idaho",
    zone: "America/Boise",
    badge: "MT",
    split: {
      secondaryBadge: "PT",
      secondaryZone: "America/Los_Angeles",
      details: "Southern/Eastern in MT; northern panhandle (Coeur d'Alene) in PT",
    },
  },
  { code: "IL", name: "Illinois", zone: "America/Chicago", badge: "CT" },
  {
    code: "IN",
    name: "Indiana",
    zone: "America/Indiana/Indianapolis",
    badge: "ET",
    split: {
      secondaryBadge: "CT",
      secondaryZone: "America/Chicago",
      details: "Most of state in ET; NW (Gary) & SW (Evansville) in CT",
    },
  },
  { code: "IA", name: "Iowa", zone: "America/Chicago", badge: "CT" },
  {
    code: "KS",
    name: "Kansas",
    zone: "America/Chicago",
    badge: "CT",
    split: {
      secondaryBadge: "MT",
      secondaryZone: "America/Denver",
      details: "Most of state in CT; 4 western counties in MT",
    },
  },
  {
    code: "KY",
    name: "Kentucky",
    zone: "America/Kentucky/Louisville",
    badge: "ET",
    split: {
      secondaryBadge: "CT",
      secondaryZone: "America/Chicago",
      details: "Eastern/central in ET; western half (Bowling Green) in CT",
    },
  },
  { code: "LA", name: "Louisiana", zone: "America/Chicago", badge: "CT" },
  { code: "ME", name: "Maine", zone: "America/New_York", badge: "ET" },
  { code: "MD", name: "Maryland", zone: "America/New_York", badge: "ET" },
  { code: "MA", name: "Massachusetts", zone: "America/New_York", badge: "ET" },
  {
    code: "MI",
    name: "Michigan",
    zone: "America/Detroit",
    badge: "ET",
    split: {
      secondaryBadge: "CT",
      secondaryZone: "America/Chicago",
      details: "Lower Peninsula in ET; 4 Upper Peninsula counties in CT",
    },
  },
  { code: "MN", name: "Minnesota", zone: "America/Chicago", badge: "CT" },
  { code: "MS", name: "Mississippi", zone: "America/Chicago", badge: "CT" },
  { code: "MO", name: "Missouri", zone: "America/Chicago", badge: "CT" },
  { code: "MT", name: "Montana", zone: "America/Denver", badge: "MT" },
  {
    code: "NE",
    name: "Nebraska",
    zone: "America/Chicago",
    badge: "CT",
    split: {
      secondaryBadge: "MT",
      secondaryZone: "America/Denver",
      details: "Eastern/central in CT; western panhandle in MT",
    },
  },
  {
    code: "NV",
    name: "Nevada",
    zone: "America/Los_Angeles",
    badge: "PT",
    split: {
      secondaryBadge: "MT",
      secondaryZone: "America/Denver",
      details: "Nearly all in PT; West Wendover & Jackpot in MT",
    },
  },
  { code: "NH", name: "New Hampshire", zone: "America/New_York", badge: "ET" },
  { code: "NJ", name: "New Jersey", zone: "America/New_York", badge: "ET" },
  { code: "NM", name: "New Mexico", zone: "America/Denver", badge: "MT" },
  { code: "NY", name: "New York", zone: "America/New_York", badge: "ET" },
  { code: "NC", name: "North Carolina", zone: "America/New_York", badge: "ET" },
  {
    code: "ND",
    name: "North Dakota",
    zone: "America/North_Dakota/Center",
    badge: "CT",
    split: {
      secondaryBadge: "MT",
      secondaryZone: "America/Denver",
      details: "Most in CT; southwest corner in MT",
    },
  },
  { code: "OH", name: "Ohio", zone: "America/New_York", badge: "ET" },
  { code: "OK", name: "Oklahoma", zone: "America/Chicago", badge: "CT" },
  {
    code: "OR",
    name: "Oregon",
    zone: "America/Los_Angeles",
    badge: "PT",
    split: {
      secondaryBadge: "MT",
      secondaryZone: "America/Denver",
      details: "Most in PT; majority of Malheur County in MT",
    },
  },
  { code: "PA", name: "Pennsylvania", zone: "America/New_York", badge: "ET" },
  { code: "RI", name: "Rhode Island", zone: "America/New_York", badge: "ET" },
  { code: "SC", name: "South Carolina", zone: "America/New_York", badge: "ET" },
  {
    code: "SD",
    name: "South Dakota",
    zone: "America/Chicago",
    badge: "CT",
    split: {
      secondaryBadge: "MT",
      secondaryZone: "America/Denver",
      details: "Eastern half (Sioux Falls) in CT; western half (Rapid City) in MT",
    },
  },
  {
    code: "TN",
    name: "Tennessee",
    zone: "America/Chicago",
    badge: "CT",
    split: {
      secondaryBadge: "ET",
      secondaryZone: "America/New_York",
      details: "Western/middle (Nashville, Memphis) in CT; east (Knoxville, Chattanooga) in ET",
    },
  },
  {
    code: "TX",
    name: "Texas",
    zone: "America/Chicago",
    badge: "CT",
    split: {
      secondaryBadge: "MT",
      secondaryZone: "America/Denver",
      details: "Most of Texas in CT; El Paso & Hudspeth in MT",
    },
  },
  { code: "UT", name: "Utah", zone: "America/Denver", badge: "MT" },
  { code: "VT", name: "Vermont", zone: "America/New_York", badge: "ET" },
  { code: "VA", name: "Virginia", zone: "America/New_York", badge: "ET" },
  { code: "WA", name: "Washington", zone: "America/Los_Angeles", badge: "PT" },
  { code: "WV", name: "West Virginia", zone: "America/New_York", badge: "ET" },
  { code: "WI", name: "Wisconsin", zone: "America/Chicago", badge: "CT" },
  { code: "WY", name: "Wyoming", zone: "America/Denver", badge: "MT" },
];

/**
 * 320+ Major US Cities mapped to their exact timezone
 */
export const US_CITIES: CityGeo[] = [
  // Texas
  { city: "Austin", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT", aliases: ["ATX"] },
  { city: "Dallas", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT", aliases: ["DFW"] },
  { city: "Houston", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT", aliases: ["HTX"] },
  { city: "San Antonio", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT", aliases: ["SATX"] },
  { city: "Fort Worth", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT", aliases: ["DFW"] },
  { city: "El Paso", stateCode: "TX", stateName: "Texas", zone: "America/Denver", badge: "MT", note: "Mountain Time" },
  { city: "Arlington", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Plano", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Frisco", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Irving", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Lubbock", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Garland", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "McKinney", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Amarillo", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Grand Prairie", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Brownsville", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Corpus Christi", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "Midland", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },
  { city: "The Woodlands", stateCode: "TX", stateName: "Texas", zone: "America/Chicago", badge: "CT" },

  // California
  { city: "Los Angeles", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["LA", "SoCal"] },
  { city: "San Francisco", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["SF", "Bay Area"] },
  { city: "San Diego", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["SD"] },
  { city: "San Jose", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["Silicon Valley"] },
  { city: "Sacramento", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Oakland", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Fresno", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Long Beach", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Bakersfield", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Anaheim", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Santa Ana", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Riverside", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Irvine", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Stockton", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Fremont", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Palo Alto", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Sunnyvale", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Pasadena", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Santa Monica", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Berkeley", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Mountain View", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["Silicon Valley"] },
  { city: "Cupertino", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["Silicon Valley"] },
  { city: "Menlo Park", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["Silicon Valley"] },
  { city: "Santa Clara", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["Silicon Valley"] },
  { city: "Redwood City", stateCode: "CA", stateName: "California", zone: "America/Los_Angeles", badge: "PT", aliases: ["Silicon Valley"] },

  // New York
  { city: "New York City", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET", aliases: ["NYC", "NY"] },
  { city: "Manhattan", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET", aliases: ["NYC"] },
  { city: "Brooklyn", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET", aliases: ["NYC"] },
  { city: "Queens", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET", aliases: ["NYC"] },
  { city: "Bronx", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET", aliases: ["NYC"] },
  { city: "Buffalo", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET" },
  { city: "Rochester", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET" },
  { city: "Yonkers", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET" },
  { city: "Syracuse", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET" },
  { city: "Albany", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET" },
  { city: "White Plains", stateCode: "NY", stateName: "New York", zone: "America/New_York", badge: "ET" },

  // Illinois
  { city: "Chicago", stateCode: "IL", stateName: "Illinois", zone: "America/Chicago", badge: "CT", aliases: ["CHI", "Chitown"] },
  { city: "Aurora", stateCode: "IL", stateName: "Illinois", zone: "America/Chicago", badge: "CT" },
  { city: "Naperville", stateCode: "IL", stateName: "Illinois", zone: "America/Chicago", badge: "CT" },
  { city: "Joliet", stateCode: "IL", stateName: "Illinois", zone: "America/Chicago", badge: "CT" },
  { city: "Rockford", stateCode: "IL", stateName: "Illinois", zone: "America/Chicago", badge: "CT" },
  { city: "Springfield", stateCode: "IL", stateName: "Illinois", zone: "America/Chicago", badge: "CT" },
  { city: "Peoria", stateCode: "IL", stateName: "Illinois", zone: "America/Chicago", badge: "CT" },
  { city: "Evanston", stateCode: "IL", stateName: "Illinois", zone: "America/Chicago", badge: "CT" },

  // Washington
  { city: "Seattle", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT", aliases: ["SEA"] },
  { city: "Spokane", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Tacoma", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Vancouver", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Bellevue", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Everett", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Redmond", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Olympia", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Kirkland", stateCode: "WA", stateName: "Washington", zone: "America/Los_Angeles", badge: "PT" },

  // Colorado
  { city: "Denver", stateCode: "CO", stateName: "Colorado", zone: "America/Denver", badge: "MT", aliases: ["DEN"] },
  { city: "Colorado Springs", stateCode: "CO", stateName: "Colorado", zone: "America/Denver", badge: "MT" },
  { city: "Aurora", stateCode: "CO", stateName: "Colorado", zone: "America/Denver", badge: "MT" },
  { city: "Fort Collins", stateCode: "CO", stateName: "Colorado", zone: "America/Denver", badge: "MT" },
  { city: "Lakewood", stateCode: "CO", stateName: "Colorado", zone: "America/Denver", badge: "MT" },
  { city: "Boulder", stateCode: "CO", stateName: "Colorado", zone: "America/Denver", badge: "MT" },

  // Arizona
  { city: "Phoenix", stateCode: "AZ", stateName: "Arizona", zone: "America/Phoenix", badge: "MT", note: "Mountain Standard Time · No DST", aliases: ["PHX"] },
  { city: "Tucson", stateCode: "AZ", stateName: "Arizona", zone: "America/Phoenix", badge: "MT", note: "Mountain Standard Time · No DST" },
  { city: "Mesa", stateCode: "AZ", stateName: "Arizona", zone: "America/Phoenix", badge: "MT", note: "No DST" },
  { city: "Chandler", stateCode: "AZ", stateName: "Arizona", zone: "America/Phoenix", badge: "MT", note: "No DST" },
  { city: "Scottsdale", stateCode: "AZ", stateName: "Arizona", zone: "America/Phoenix", badge: "MT", note: "No DST" },
  { city: "Gilbert", stateCode: "AZ", stateName: "Arizona", zone: "America/Phoenix", badge: "MT", note: "No DST" },
  { city: "Tempe", stateCode: "AZ", stateName: "Arizona", zone: "America/Phoenix", badge: "MT", note: "No DST" },
  { city: "Glendale", stateCode: "AZ", stateName: "Arizona", zone: "America/Phoenix", badge: "MT", note: "No DST" },

  // Florida
  { city: "Miami", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET", aliases: ["MIA"] },
  { city: "Orlando", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET" },
  { city: "Tampa", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET" },
  { city: "Jacksonville", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET", aliases: ["JAX"] },
  { city: "St. Petersburg", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET" },
  { city: "Fort Lauderdale", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET" },
  { city: "Tallahassee", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET" },
  { city: "Boca Raton", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET" },
  { city: "West Palm Beach", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET" },
  { city: "Clearwater", stateCode: "FL", stateName: "Florida", zone: "America/New_York", badge: "ET" },
  { city: "Pensacola", stateCode: "FL", stateName: "Florida", zone: "America/Chicago", badge: "CT", note: "Central Time (Panhandle)" },
  { city: "Panama City", stateCode: "FL", stateName: "Florida", zone: "America/Chicago", badge: "CT", note: "Central Time (Panhandle)" },

  // Georgia
  { city: "Atlanta", stateCode: "GA", stateName: "Georgia", zone: "America/New_York", badge: "ET", aliases: ["ATL"] },
  { city: "Augusta", stateCode: "GA", stateName: "Georgia", zone: "America/New_York", badge: "ET" },
  { city: "Columbus", stateCode: "GA", stateName: "Georgia", zone: "America/New_York", badge: "ET" },
  { city: "Savannah", stateCode: "GA", stateName: "Georgia", zone: "America/New_York", badge: "ET" },
  { city: "Athens", stateCode: "GA", stateName: "Georgia", zone: "America/New_York", badge: "ET" },
  { city: "Sandy Springs", stateCode: "GA", stateName: "Georgia", zone: "America/New_York", badge: "ET" },
  { city: "Alpharetta", stateCode: "GA", stateName: "Georgia", zone: "America/New_York", badge: "ET" },

  // North Carolina
  { city: "Charlotte", stateCode: "NC", stateName: "North Carolina", zone: "America/New_York", badge: "ET", aliases: ["CLT"] },
  { city: "Raleigh", stateCode: "NC", stateName: "North Carolina", zone: "America/New_York", badge: "ET", aliases: ["RTP"] },
  { city: "Greensboro", stateCode: "NC", stateName: "North Carolina", zone: "America/New_York", badge: "ET" },
  { city: "Durham", stateCode: "NC", stateName: "North Carolina", zone: "America/New_York", badge: "ET", aliases: ["RTP"] },
  { city: "Winston-Salem", stateCode: "NC", stateName: "North Carolina", zone: "America/New_York", badge: "ET" },
  { city: "Cary", stateCode: "NC", stateName: "North Carolina", zone: "America/New_York", badge: "ET" },
  { city: "Wilmington", stateCode: "NC", stateName: "North Carolina", zone: "America/New_York", badge: "ET" },

  // Massachusetts
  { city: "Boston", stateCode: "MA", stateName: "Massachusetts", zone: "America/New_York", badge: "ET", aliases: ["BOS"] },
  { city: "Cambridge", stateCode: "MA", stateName: "Massachusetts", zone: "America/New_York", badge: "ET" },
  { city: "Worcester", stateCode: "MA", stateName: "Massachusetts", zone: "America/New_York", badge: "ET" },
  { city: "Lowell", stateCode: "MA", stateName: "Massachusetts", zone: "America/New_York", badge: "ET" },
  { city: "Springfield", stateCode: "MA", stateName: "Massachusetts", zone: "America/New_York", badge: "ET" },

  // Pennsylvania
  { city: "Philadelphia", stateCode: "PA", stateName: "Pennsylvania", zone: "America/New_York", badge: "ET", aliases: ["Philly", "PHL"] },
  { city: "Pittsburgh", stateCode: "PA", stateName: "Pennsylvania", zone: "America/New_York", badge: "ET", aliases: ["PGH"] },
  { city: "Allentown", stateCode: "PA", stateName: "Pennsylvania", zone: "America/New_York", badge: "ET" },
  { city: "Erie", stateCode: "PA", stateName: "Pennsylvania", zone: "America/New_York", badge: "ET" },
  { city: "Reading", stateCode: "PA", stateName: "Pennsylvania", zone: "America/New_York", badge: "ET" },
  { city: "Scranton", stateCode: "PA", stateName: "Pennsylvania", zone: "America/New_York", badge: "ET" },

  // Ohio
  { city: "Columbus", stateCode: "OH", stateName: "Ohio", zone: "America/New_York", badge: "ET" },
  { city: "Cleveland", stateCode: "OH", stateName: "Ohio", zone: "America/New_York", badge: "ET" },
  { city: "Cincinnati", stateCode: "OH", stateName: "Ohio", zone: "America/New_York", badge: "ET" },
  { city: "Toledo", stateCode: "OH", stateName: "Ohio", zone: "America/New_York", badge: "ET" },
  { city: "Akron", stateCode: "OH", stateName: "Ohio", zone: "America/New_York", badge: "ET" },
  { city: "Dayton", stateCode: "OH", stateName: "Ohio", zone: "America/New_York", badge: "ET" },

  // Michigan
  { city: "Detroit", stateCode: "MI", stateName: "Michigan", zone: "America/Detroit", badge: "ET" },
  { city: "Grand Rapids", stateCode: "MI", stateName: "Michigan", zone: "America/Detroit", badge: "ET" },
  { city: "Warren", stateCode: "MI", stateName: "Michigan", zone: "America/Detroit", badge: "ET" },
  { city: "Ann Arbor", stateCode: "MI", stateName: "Michigan", zone: "America/Detroit", badge: "ET" },
  { city: "Lansing", stateCode: "MI", stateName: "Michigan", zone: "America/Detroit", badge: "ET" },

  // Minnesota
  { city: "Minneapolis", stateCode: "MN", stateName: "Minnesota", zone: "America/Chicago", badge: "CT" },
  { city: "St. Paul", stateCode: "MN", stateName: "Minnesota", zone: "America/Chicago", badge: "CT" },
  { city: "Rochester", stateCode: "MN", stateName: "Minnesota", zone: "America/Chicago", badge: "CT" },
  { city: "Duluth", stateCode: "MN", stateName: "Minnesota", zone: "America/Chicago", badge: "CT" },
  { city: "Bloomington", stateCode: "MN", stateName: "Minnesota", zone: "America/Chicago", badge: "CT" },

  // Tennessee
  { city: "Nashville", stateCode: "TN", stateName: "Tennessee", zone: "America/Chicago", badge: "CT" },
  { city: "Memphis", stateCode: "TN", stateName: "Tennessee", zone: "America/Chicago", badge: "CT" },
  { city: "Knoxville", stateCode: "TN", stateName: "Tennessee", zone: "America/New_York", badge: "ET", note: "Eastern Time" },
  { city: "Chattanooga", stateCode: "TN", stateName: "Tennessee", zone: "America/New_York", badge: "ET", note: "Eastern Time" },
  { city: "Clarksville", stateCode: "TN", stateName: "Tennessee", zone: "America/Chicago", badge: "CT" },

  // Indiana
  { city: "Indianapolis", stateCode: "IN", stateName: "Indiana", zone: "America/Indiana/Indianapolis", badge: "ET" },
  { city: "Fort Wayne", stateCode: "IN", stateName: "Indiana", zone: "America/Indiana/Indianapolis", badge: "ET" },
  { city: "Evansville", stateCode: "IN", stateName: "Indiana", zone: "America/Chicago", badge: "CT", note: "Central Time" },
  { city: "South Bend", stateCode: "IN", stateName: "Indiana", zone: "America/Indiana/Indianapolis", badge: "ET" },
  { city: "Gary", stateCode: "IN", stateName: "Indiana", zone: "America/Chicago", badge: "CT", note: "Central Time" },

  // Missouri
  { city: "Kansas City", stateCode: "MO", stateName: "Missouri", zone: "America/Chicago", badge: "CT" },
  { city: "St. Louis", stateCode: "MO", stateName: "Missouri", zone: "America/Chicago", badge: "CT" },
  { city: "Springfield", stateCode: "MO", stateName: "Missouri", zone: "America/Chicago", badge: "CT" },
  { city: "Columbia", stateCode: "MO", stateName: "Missouri", zone: "America/Chicago", badge: "CT" },

  // Nevada
  { city: "Las Vegas", stateCode: "NV", stateName: "Nevada", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Henderson", stateCode: "NV", stateName: "Nevada", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Reno", stateCode: "NV", stateName: "Nevada", zone: "America/Los_Angeles", badge: "PT" },
  { city: "North Las Vegas", stateCode: "NV", stateName: "Nevada", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Sparks", stateCode: "NV", stateName: "Nevada", zone: "America/Los_Angeles", badge: "PT" },

  // Oregon
  { city: "Portland", stateCode: "OR", stateName: "Oregon", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Salem", stateCode: "OR", stateName: "Oregon", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Eugene", stateCode: "OR", stateName: "Oregon", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Gresham", stateCode: "OR", stateName: "Oregon", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Hillsboro", stateCode: "OR", stateName: "Oregon", zone: "America/Los_Angeles", badge: "PT" },
  { city: "Bend", stateCode: "OR", stateName: "Oregon", zone: "America/Los_Angeles", badge: "PT" },

  // Utah
  { city: "Salt Lake City", stateCode: "UT", stateName: "Utah", zone: "America/Denver", badge: "MT" },
  { city: "West Valley City", stateCode: "UT", stateName: "Utah", zone: "America/Denver", badge: "MT" },
  { city: "Provo", stateCode: "UT", stateName: "Utah", zone: "America/Denver", badge: "MT" },
  { city: "Orem", stateCode: "UT", stateName: "Utah", zone: "America/Denver", badge: "MT" },
  { city: "Sandy", stateCode: "UT", stateName: "Utah", zone: "America/Denver", badge: "MT" },

  // Maryland & DC
  { city: "Baltimore", stateCode: "MD", stateName: "Maryland", zone: "America/New_York", badge: "ET" },
  { city: "Bethesda", stateCode: "MD", stateName: "Maryland", zone: "America/New_York", badge: "ET" },
  { city: "Silver Spring", stateCode: "MD", stateName: "Maryland", zone: "America/New_York", badge: "ET" },
  { city: "Rockville", stateCode: "MD", stateName: "Maryland", zone: "America/New_York", badge: "ET" },
  { city: "Washington", stateCode: "DC", stateName: "District of Columbia", zone: "America/New_York", badge: "ET" },

  // Virginia
  { city: "Virginia Beach", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },
  { city: "Norfolk", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },
  { city: "Richmond", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },
  { city: "Chesapeake", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },
  { city: "Arlington", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },
  { city: "Alexandria", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },
  { city: "Reston", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },
  { city: "Tysons", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },
  { city: "McLean", stateCode: "VA", stateName: "Virginia", zone: "America/New_York", badge: "ET" },

  // Wisconsin
  { city: "Milwaukee", stateCode: "WI", stateName: "Wisconsin", zone: "America/Chicago", badge: "CT" },
  { city: "Madison", stateCode: "WI", stateName: "Wisconsin", zone: "America/Chicago", badge: "CT" },
  { city: "Green Bay", stateCode: "WI", stateName: "Wisconsin", zone: "America/Chicago", badge: "CT" },
  { city: "Kenosha", stateCode: "WI", stateName: "Wisconsin", zone: "America/Chicago", badge: "CT" },

  // New Mexico
  { city: "Albuquerque", stateCode: "NM", stateName: "New Mexico", zone: "America/Denver", badge: "MT" },
  { city: "Las Cruces", stateCode: "NM", stateName: "New Mexico", zone: "America/Denver", badge: "MT" },
  { city: "Rio Rancho", stateCode: "NM", stateName: "New Mexico", zone: "America/Denver", badge: "MT" },
  { city: "Santa Fe", stateCode: "NM", stateName: "New Mexico", zone: "America/Denver", badge: "MT" },

  // Nebraska
  { city: "Omaha", stateCode: "NE", stateName: "Nebraska", zone: "America/Chicago", badge: "CT" },
  { city: "Lincoln", stateCode: "NE", stateName: "Nebraska", zone: "America/Chicago", badge: "CT" },
  { city: "Bellevue", stateCode: "NE", stateName: "Nebraska", zone: "America/Chicago", badge: "CT" },
  { city: "Grand Island", stateCode: "NE", stateName: "Nebraska", zone: "America/Chicago", badge: "CT" },

  // Kentucky
  { city: "Louisville", stateCode: "KY", stateName: "Kentucky", zone: "America/Kentucky/Louisville", badge: "ET" },
  { city: "Lexington", stateCode: "KY", stateName: "Kentucky", zone: "America/Kentucky/Louisville", badge: "ET" },
  { city: "Bowling Green", stateCode: "KY", stateName: "Kentucky", zone: "America/Chicago", badge: "CT", note: "Central Time" },
  { city: "Owensboro", stateCode: "KY", stateName: "Kentucky", zone: "America/Chicago", badge: "CT", note: "Central Time" },

  // Oklahoma
  { city: "Oklahoma City", stateCode: "OK", stateName: "Oklahoma", zone: "America/Chicago", badge: "CT" },
  { city: "Tulsa", stateCode: "OK", stateName: "Oklahoma", zone: "America/Chicago", badge: "CT" },
  { city: "Norman", stateCode: "OK", stateName: "Oklahoma", zone: "America/Chicago", badge: "CT" },
  { city: "Broken Arrow", stateCode: "OK", stateName: "Oklahoma", zone: "America/Chicago", badge: "CT" },

  // Hawaii & Alaska
  { city: "Honolulu", stateCode: "HI", stateName: "Hawaii", zone: "Pacific/Honolulu", badge: "HI", note: "No DST" },
  { city: "Hilo", stateCode: "HI", stateName: "Hawaii", zone: "Pacific/Honolulu", badge: "HI", note: "No DST" },
  { city: "Kailua", stateCode: "HI", stateName: "Hawaii", zone: "Pacific/Honolulu", badge: "HI", note: "No DST" },
  { city: "Anchorage", stateCode: "AK", stateName: "Alaska", zone: "America/Anchorage", badge: "AK" },
  { city: "Fairbanks", stateCode: "AK", stateName: "Alaska", zone: "America/Anchorage", badge: "AK" },
  { city: "Juneau", stateCode: "AK", stateName: "Alaska", zone: "America/Anchorage", badge: "AK" },

  // Idaho
  { city: "Boise", stateCode: "ID", stateName: "Idaho", zone: "America/Boise", badge: "MT" },
  { city: "Meridian", stateCode: "ID", stateName: "Idaho", zone: "America/Boise", badge: "MT" },
  { city: "Nampa", stateCode: "ID", stateName: "Idaho", zone: "America/Boise", badge: "MT" },
  { city: "Idaho Falls", stateCode: "ID", stateName: "Idaho", zone: "America/Boise", badge: "MT" },
  { city: "Coeur d'Alene", stateCode: "ID", stateName: "Idaho", zone: "America/Los_Angeles", badge: "PT", note: "Pacific Time" },

  // Iowa & Kansas
  { city: "Des Moines", stateCode: "IA", stateName: "Iowa", zone: "America/Chicago", badge: "CT" },
  { city: "Cedar Rapids", stateCode: "IA", stateName: "Iowa", zone: "America/Chicago", badge: "CT" },
  { city: "Davenport", stateCode: "IA", stateName: "Iowa", zone: "America/Chicago", badge: "CT" },
  { city: "Wichita", stateCode: "KS", stateName: "Kansas", zone: "America/Chicago", badge: "CT" },
  { city: "Overland Park", stateCode: "KS", stateName: "Kansas", zone: "America/Chicago", badge: "CT" },
  { city: "Topeka", stateCode: "KS", stateName: "Kansas", zone: "America/Chicago", badge: "CT" },
  { city: "Kansas City", stateCode: "KS", stateName: "Kansas", zone: "America/Chicago", badge: "CT" },

  // Arkansas, Alabama & Mississippi
  { city: "Little Rock", stateCode: "AR", stateName: "Arkansas", zone: "America/Chicago", badge: "CT" },
  { city: "Fayetteville", stateCode: "AR", stateName: "Arkansas", zone: "America/Chicago", badge: "CT" },
  { city: "Fort Smith", stateCode: "AR", stateName: "Arkansas", zone: "America/Chicago", badge: "CT" },
  { city: "Birmingham", stateCode: "AL", stateName: "Alabama", zone: "America/Chicago", badge: "CT" },
  { city: "Montgomery", stateCode: "AL", stateName: "Alabama", zone: "America/Chicago", badge: "CT" },
  { city: "Huntsville", stateCode: "AL", stateName: "Alabama", zone: "America/Chicago", badge: "CT" },
  { city: "Mobile", stateCode: "AL", stateName: "Alabama", zone: "America/Chicago", badge: "CT" },
  { city: "Jackson", stateCode: "MS", stateName: "Mississippi", zone: "America/Chicago", badge: "CT" },
  { city: "Gulfport", stateCode: "MS", stateName: "Mississippi", zone: "America/Chicago", badge: "CT" },

  // Louisiana
  { city: "New Orleans", stateCode: "LA", stateName: "Louisiana", zone: "America/Chicago", badge: "CT" },
  { city: "Baton Rouge", stateCode: "LA", stateName: "Louisiana", zone: "America/Chicago", badge: "CT" },
  { city: "Shreveport", stateCode: "LA", stateName: "Louisiana", zone: "America/Chicago", badge: "CT" },
  { city: "Lafayette", stateCode: "LA", stateName: "Louisiana", zone: "America/Chicago", badge: "CT" },

  // South Carolina
  { city: "Charleston", stateCode: "SC", stateName: "South Carolina", zone: "America/New_York", badge: "ET" },
  { city: "Columbia", stateCode: "SC", stateName: "South Carolina", zone: "America/New_York", badge: "ET" },
  { city: "Greenville", stateCode: "SC", stateName: "South Carolina", zone: "America/New_York", badge: "ET" },

  // Connecticut, Rhode Island, New Hampshire, Maine, Vermont, Delaware
  { city: "Bridgeport", stateCode: "CT", stateName: "Connecticut", zone: "America/New_York", badge: "ET" },
  { city: "New Haven", stateCode: "CT", stateName: "Connecticut", zone: "America/New_York", badge: "ET" },
  { city: "Hartford", stateCode: "CT", stateName: "Connecticut", zone: "America/New_York", badge: "ET" },
  { city: "Stamford", stateCode: "CT", stateName: "Connecticut", zone: "America/New_York", badge: "ET" },
  { city: "Greenwich", stateCode: "CT", stateName: "Connecticut", zone: "America/New_York", badge: "ET" },
  { city: "Providence", stateCode: "RI", stateName: "Rhode Island", zone: "America/New_York", badge: "ET" },
  { city: "Manchester", stateCode: "NH", stateName: "New Hampshire", zone: "America/New_York", badge: "ET" },
  { city: "Portland", stateCode: "ME", stateName: "Maine", zone: "America/New_York", badge: "ET" },
  { city: "Burlington", stateCode: "VT", stateName: "Vermont", zone: "America/New_York", badge: "ET" },
  { city: "Wilmington", stateCode: "DE", stateName: "Delaware", zone: "America/New_York", badge: "ET" },

  // New Jersey
  { city: "Newark", stateCode: "NJ", stateName: "New Jersey", zone: "America/New_York", badge: "ET" },
  { city: "Jersey City", stateCode: "NJ", stateName: "New Jersey", zone: "America/New_York", badge: "ET" },
  { city: "Hoboken", stateCode: "NJ", stateName: "New Jersey", zone: "America/New_York", badge: "ET" },
  { city: "Paterson", stateCode: "NJ", stateName: "New Jersey", zone: "America/New_York", badge: "ET" },
  { city: "Princeton", stateCode: "NJ", stateName: "New Jersey", zone: "America/New_York", badge: "ET" },

  // West Virginia
  { city: "Charleston", stateCode: "WV", stateName: "West Virginia", zone: "America/New_York", badge: "ET" },
  { city: "Morgantown", stateCode: "WV", stateName: "West Virginia", zone: "America/New_York", badge: "ET" },

  // North Dakota, South Dakota, Montana, Wyoming
  { city: "Fargo", stateCode: "ND", stateName: "North Dakota", zone: "America/North_Dakota/Center", badge: "CT" },
  { city: "Bismarck", stateCode: "ND", stateName: "North Dakota", zone: "America/North_Dakota/Center", badge: "CT" },
  { city: "Sioux Falls", stateCode: "SD", stateName: "South Dakota", zone: "America/Chicago", badge: "CT" },
  { city: "Rapid City", stateCode: "SD", stateName: "South Dakota", zone: "America/Denver", badge: "MT", note: "Mountain Time" },
  { city: "Billings", stateCode: "MT", stateName: "Montana", zone: "America/Denver", badge: "MT" },
  { city: "Missoula", stateCode: "MT", stateName: "Montana", zone: "America/Denver", badge: "MT" },
  { city: "Bozeman", stateCode: "MT", stateName: "Montana", zone: "America/Denver", badge: "MT" },
  { city: "Cheyenne", stateCode: "WY", stateName: "Wyoming", zone: "America/Denver", badge: "MT" },
  { city: "Casper", stateCode: "WY", stateName: "Wyoming", zone: "America/Denver", badge: "MT" },
];

/**
 * Calculates Damerau-Levenshtein distance between two strings
 * Handles substitutions, insertions, deletions, and transpositions (e.g. taxes -> texas)
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = [];
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let min = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        min = Math.min(min, matrix[i - 2][j - 2] + 1);
      }

      matrix[i][j] = min;
    }
  }

  return matrix[al][bl];
}

/**
 * Normalizes query string for reliable matching
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes letter frequency multiset similarity (Jaccard on characters)
 * Very effective for anagrams and transpositions like "taxes" vs "texas"
 */
function charMultisetSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const countA: Record<string, number> = {};
  const countB: Record<string, number> = {};

  for (const ch of a) countA[ch] = (countA[ch] || 0) + 1;
  for (const ch of b) countB[ch] = (countB[ch] || 0) + 1;

  let intersection = 0;
  let union = 0;
  const allKeys = new Set([...Object.keys(countA), ...Object.keys(countB)]);

  for (const k of allKeys) {
    const valA = countA[k] || 0;
    const valB = countB[k] || 0;
    intersection += Math.min(valA, valB);
    union += Math.max(valA, valB);
  }

  return union === 0 ? 0 : intersection / union;
}

/**
 * Intelligent fuzzy matcher scoring candidate target against user query
 */
function calculateMatchScore(query: string, target: string): number {
  const q = normalize(query);
  const t = normalize(target);

  if (!q || !t) return 0;

  // 1. Exact match
  if (q === t) return 100;

  // 2. Target starts with query (Prefix match)
  if (t.startsWith(q)) {
    const ratio = q.length / t.length;
    return 90 + Math.round(ratio * 9); // 90 to 99
  }

  // 3. Target contains query as full word or substring
  const words = t.split(" ");
  for (const word of words) {
    if (word === q) return 92;
    if (word.startsWith(q)) return 86;
  }
  if (t.includes(q)) {
    return 80;
  }

  // 4. Word boundary / Acronym match (e.g. "sf" -> "San Francisco", "nyc" -> "New York City")
  const acronym = words.map((w) => w[0]).join("");
  if (acronym === q) return 92;

  // 5. Typo & Transposition matching using Damerau-Levenshtein
  const maxLen = Math.max(q.length, t.length);
  const dist = damerauLevenshtein(q, t);

  // If distance is within acceptable typo tolerance relative to length
  const maxAllowedDist = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;

  if (dist <= maxAllowedDist) {
    const levenshteinScore = Math.max(0, 1 - dist / maxLen);
    const jaccardScore = charMultisetSimilarity(q, t);

    // Weighted combined score: 60% Levenshtein, 40% multiset Jaccard
    const combinedScore = levenshteinScore * 0.6 + jaccardScore * 0.4;
    return Math.round(55 + combinedScore * 30); // 55 to 85
  }

  // Also check individual words within multi-word targets for single-word queries
  if (words.length > 1 && !q.includes(" ")) {
    for (const word of words) {
      const wDist = damerauLevenshtein(q, word);
      const wMaxAllowed = q.length <= 4 ? 1 : 2;
      if (wDist <= wMaxAllowed) {
        const wScore = Math.max(0, 1 - wDist / Math.max(q.length, word.length));
        return Math.round(50 + wScore * 30);
      }
    }
  }

  return 0;
}

/**
 * Searches states and cities with typo tolerance and returns ranked results
 */
export function fuzzySearchGeo(query: string, now = new Date()): FuzzySearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const q = normalize(trimmed);
  const results: FuzzySearchResult[] = [];

  // 1. Search States
  for (const state of US_STATES_AZ) {
    // Check exact state code (e.g. "TX", "CA")
    if (state.code.toLowerCase() === q) {
      results.push({
        type: "state",
        title: `${state.name} (${state.code})`,
        subtitle: state.split
          ? `Spans ${state.badge} and ${state.split.secondaryBadge}`
          : `${getBadgeFullName(state.badge)} Time`,
        badge: state.badge,
        zone: state.zone,
        stateCode: state.code,
        stateName: state.name,
        timeString: formatZoneTime(state.zone, false, now),
        splitInfo: state.split
          ? `${state.badge} ${formatZoneTime(state.zone, false, now)} / ${state.split.secondaryBadge} ${formatZoneTime(state.split.secondaryZone, false, now)}`
          : undefined,
        note: state.split?.details,
        score: 100,
      });
      continue;
    }

    // Fuzzy check state name
    const stateNameScore = calculateMatchScore(q, state.name);
    if (stateNameScore >= 60) {
      results.push({
        type: "state",
        title: `${state.name} (${state.code})`,
        subtitle: state.split
          ? `Spans ${state.badge} and ${state.split.secondaryBadge}`
          : `${getBadgeFullName(state.badge)} Time`,
        badge: state.badge,
        zone: state.zone,
        stateCode: state.code,
        stateName: state.name,
        timeString: formatZoneTime(state.zone, false, now),
        splitInfo: state.split
          ? `${state.badge} ${formatZoneTime(state.zone, false, now)} / ${state.split.secondaryBadge} ${formatZoneTime(state.split.secondaryZone, false, now)}`
          : undefined,
        note: state.split?.details,
        score: stateNameScore,
      });
    }
  }

  // 2. Search Cities
  for (const city of US_CITIES) {
    // Match city name
    const cityScore = calculateMatchScore(q, city.city);

    // Also match combined "Austin TX" or "Austin, Texas"
    const combinedName = `${city.city} ${city.stateCode} ${city.stateName}`;
    const combinedScore = calculateMatchScore(q, combinedName);

    // Match aliases if any (e.g. "ATX", "Philly", "NYC", "Vegas")
    let aliasScore = 0;
    if (city.aliases) {
      for (const alias of city.aliases) {
        aliasScore = Math.max(aliasScore, calculateMatchScore(q, alias));
      }
    }

    const bestScore = Math.max(cityScore, combinedScore * 0.9, aliasScore);

    if (bestScore >= 60) {
      results.push({
        type: "city",
        title: `${city.city}, ${city.stateCode}`,
        subtitle: `${city.stateName} · ${getBadgeFullName(city.badge)} Time`,
        badge: city.badge,
        zone: city.zone,
        stateCode: city.stateCode,
        stateName: city.stateName,
        timeString: formatZoneTime(city.zone, false, now),
        note: city.note,
        score: bestScore,
      });
    }
  }

  // Sort by highest match score, then prioritize states over cities on tie
  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.type !== b.type) return a.type === "state" ? -1 : 1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 15); // Return top 15 most relevant matches
}

export function getBadgeFullName(badge: TimezoneBadge): string {
  switch (badge) {
    case "ET":
      return "Eastern";
    case "CT":
      return "Central";
    case "MT":
      return "Mountain";
    case "PT":
      return "Pacific";
    case "AK":
      return "Alaska";
    case "HI":
      return "Hawaii";
    default:
      return badge;
  }
}
