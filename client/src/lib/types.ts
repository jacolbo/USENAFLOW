export interface User {
  role: string;
  name: string;
  value: string;
  id?: string;
  abbr?: string;
}

export const ROLE_MAPPINGS = {
  Admin: { role: "Admin", name: "Sales/Admin", value: "Admin" },
  LeadRetoucher: { role: "LeadRetoucher", name: "Lead Retoucher", value: "LeadRetoucher" },
  DataWrangler: { role: "DataWrangler", name: "Data Wrangler", value: "DataWrangler" },
  Retoucher1: { role: "Retoucher", name: "Retoucher 1", value: "Retoucher1" },
  Retoucher2: { role: "Retoucher", name: "Retoucher 2", value: "Retoucher2" },
  Retoucher3: { role: "Retoucher", name: "Retoucher 3", value: "Retoucher3" },
};

// Helper function to format retoucher abbreviations for calendar display
export const formatRetoucherAbbr = (name: string | null) => {
  if (name === "Retoucher 1") return "EC";
  if (name === "Retoucher 2") return "ASA";
  if (name === "Retoucher 3") return "LM";
  return "R?";
};

// Helper function to get full retoucher names for display
export const getRetoucherFullName = (name: string | null) => {
  if (name === "Retoucher 1") return "Earl";
  if (name === "Retoucher 2") return "Dr Asa";
  if (name === "Retoucher 3") return "Lucky";
  return name || "-";
};
