export interface User {
  role: string;
  name: string;
  value: string;
}

export const ROLE_MAPPINGS = {
  Admin: { role: "Admin", name: "Sales/Admin", value: "Admin" },
  LeadRetoucher: { role: "LeadRetoucher", name: "Lead Retoucher", value: "LeadRetoucher" },
  DataWrangler: { role: "DataWrangler", name: "Data Wrangler", value: "DataWrangler" },
  Retoucher1: { role: "Retoucher", name: "EC", value: "Retoucher1" },
  Retoucher2: { role: "Retoucher", name: "ASA", value: "Retoucher2" },
  Retoucher3: { role: "Retoucher", name: "LM", value: "Retoucher3" },
};

// Helper function to format retoucher names for display
export const formatRetoucher = (name: string | null) => {
  if (name === "Retoucher 1") return "EC";
  if (name === "Retoucher 2") return "ASA";
  if (name === "Retoucher 3") return "LM";
  if (name === "EC") return "EC";
  if (name === "ASA") return "ASA";
  if (name === "LM") return "LM";
  return name || "R?";
};
