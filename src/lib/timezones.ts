export interface ZoneState {
  code: string;
  name: string;
  split?: boolean;
}

export interface ZoneMeta {
  zone: string;
  shortLabel: string;
  badge: string;
  states: ZoneState[];
  summary: string;
  note?: string;
}

export const US_ZONE_METAS: Record<string, ZoneMeta> = {
  "America/New_York": {
    zone: "America/New_York",
    shortLabel: "Eastern",
    badge: "ET",
    summary: "22 States & DC",
    note: "*State spans multiple time zones",
    states: [
      { code: "CT", name: "Connecticut" },
      { code: "DE", name: "Delaware" },
      { code: "DC", name: "District of Columbia" },
      { code: "FL", name: "Florida", split: true },
      { code: "GA", name: "Georgia" },
      { code: "IN", name: "Indiana", split: true },
      { code: "KY", name: "Kentucky", split: true },
      { code: "ME", name: "Maine" },
      { code: "MD", name: "Maryland" },
      { code: "MA", name: "Massachusetts" },
      { code: "MI", name: "Michigan", split: true },
      { code: "NH", name: "New Hampshire" },
      { code: "NJ", name: "New Jersey" },
      { code: "NY", name: "New York" },
      { code: "NC", name: "North Carolina" },
      { code: "OH", name: "Ohio" },
      { code: "PA", name: "Pennsylvania" },
      { code: "RI", name: "Rhode Island" },
      { code: "SC", name: "South Carolina" },
      { code: "TN", name: "Tennessee", split: true },
      { code: "VT", name: "Vermont" },
      { code: "VA", name: "Virginia" },
      { code: "WV", name: "West Virginia" },
    ],
  },
  "America/Chicago": {
    zone: "America/Chicago",
    shortLabel: "Central",
    badge: "CT",
    summary: "20 States",
    note: "*State spans multiple time zones",
    states: [
      { code: "AL", name: "Alabama" },
      { code: "AR", name: "Arkansas" },
      { code: "FL", name: "Florida", split: true },
      { code: "IL", name: "Illinois" },
      { code: "IN", name: "Indiana", split: true },
      { code: "IA", name: "Iowa" },
      { code: "KS", name: "Kansas", split: true },
      { code: "KY", name: "Kentucky", split: true },
      { code: "LA", name: "Louisiana" },
      { code: "MI", name: "Michigan", split: true },
      { code: "MN", name: "Minnesota" },
      { code: "MS", name: "Mississippi" },
      { code: "MO", name: "Missouri" },
      { code: "NE", name: "Nebraska", split: true },
      { code: "ND", name: "North Dakota", split: true },
      { code: "OK", name: "Oklahoma" },
      { code: "SD", name: "South Dakota", split: true },
      { code: "TN", name: "Tennessee", split: true },
      { code: "TX", name: "Texas", split: true },
      { code: "WI", name: "Wisconsin" },
    ],
  },
  "America/Denver": {
    zone: "America/Denver",
    shortLabel: "Mountain",
    badge: "MT",
    summary: "14 States",
    note: "*State spans multiple time zones",
    states: [
      { code: "AZ", name: "Arizona" },
      { code: "CO", name: "Colorado" },
      { code: "ID", name: "Idaho", split: true },
      { code: "KS", name: "Kansas", split: true },
      { code: "MT", name: "Montana" },
      { code: "NE", name: "Nebraska", split: true },
      { code: "NV", name: "Nevada", split: true },
      { code: "NM", name: "New Mexico" },
      { code: "ND", name: "North Dakota", split: true },
      { code: "OR", name: "Oregon", split: true },
      { code: "SD", name: "South Dakota", split: true },
      { code: "TX", name: "Texas", split: true },
      { code: "UT", name: "Utah" },
      { code: "WY", name: "Wyoming" },
    ],
  },
  "America/Los_Angeles": {
    zone: "America/Los_Angeles",
    shortLabel: "Pacific",
    badge: "PT",
    summary: "5 States",
    note: "*State spans multiple time zones",
    states: [
      { code: "CA", name: "California" },
      { code: "ID", name: "Idaho", split: true },
      { code: "NV", name: "Nevada", split: true },
      { code: "OR", name: "Oregon", split: true },
      { code: "WA", name: "Washington" },
    ],
  },
  "America/Anchorage": {
    zone: "America/Anchorage",
    shortLabel: "Alaska",
    badge: "AK",
    summary: "1 State",
    states: [{ code: "AK", name: "Alaska" }],
  },
  "Pacific/Honolulu": {
    zone: "Pacific/Honolulu",
    shortLabel: "Hawaii",
    badge: "HI",
    summary: "1 State",
    states: [{ code: "HI", name: "Hawaii" }],
  },
};

export function getZoneMeta(zone: string): ZoneMeta {
  if (US_ZONE_METAS[zone]) {
    return US_ZONE_METAS[zone];
  }

  // Graceful handling for non-US or custom entries without showing raw IANA path
  if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") {
    return {
      zone,
      shortLabel: "India",
      badge: "IST",
      summary: "India Standard Time",
      states: [],
    };
  }

  if (zone === "UTC") {
    return {
      zone,
      shortLabel: "UTC",
      badge: "UTC",
      summary: "Universal Time",
      states: [],
    };
  }

  const cleanName = (zone.split("/")[1] || zone).replace(/_/g, " ");
  return {
    zone,
    shortLabel: cleanName,
    badge: cleanName.slice(0, 3).toUpperCase(),
    summary: cleanName,
    states: [],
  };
}
