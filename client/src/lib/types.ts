export interface User {
  role: string;
  name: string;
  value: string;
  id?: string;
  abbr?: string;
}

export const ROLE_MAPPINGS = {
  Admin: { role: "Admin", name: "Admin", value: "Admin" },
  Sales: { role: "Sales", name: "Sales", value: "Sales" },
  LeadRetoucher: { role: "LeadRetoucher", name: "Lead Retoucher", value: "LeadRetoucher" },
  DataWrangler: { role: "DataWrangler", name: "Data Wrangler", value: "DataWrangler" },
  Retoucher1: { role: "Retoucher1", name: "Retoucher 1", value: "Retoucher1" },
  Retoucher2: { role: "Retoucher2", name: "Retoucher 2", value: "Retoucher2" },
  Retoucher3: { role: "Retoucher3", name: "Retoucher 3", value: "Retoucher3" },
  Evans: { role: "Evans", name: "Evans", value: "Evans" },
};

export const RETOUCHER_ROLES = ["Retoucher1", "Retoucher2", "Retoucher3", "Retoucher"];

export function isRetoucherRole(role: string | undefined): boolean {
  return role ? RETOUCHER_ROLES.includes(role) : false;
}

// Helper function to format retoucher abbreviations for calendar display
export const formatRetoucherAbbr = (name: string | null) => {
  if (name === "Retoucher 1") return "EC";
  if (name === "Retoucher 2") return "ASA";
  if (name === "Retoucher 3") return "LM";
  if (name === "Anesu's Pops") return "AP";
  return "R?";
};

// Helper function to get full retoucher names for display
export const getRetoucherFullName = (name: string | null) => {
  if (name === "Retoucher 1") return "Earl";
  if (name === "Retoucher 2") return "Dr Asa";
  if (name === "Retoucher 3") return "Lucky";
  if (name === "Anesu's Pops") return "Anesu's Pops";
  return name || "-";
};
