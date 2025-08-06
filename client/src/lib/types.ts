export interface User {
  role: string;
  name: string;
  value: string;
}

export const ROLE_MAPPINGS = {
  Admin: { role: "Admin", name: "Sales/Admin", value: "Admin" },
  LeadRetoucher: { role: "LeadRetoucher", name: "Lead Retoucher", value: "LeadRetoucher" },
  DataWrangler: { role: "DataWrangler", name: "Data Wrangler", value: "DataWrangler" },
  Retoucher1: { role: "Retoucher", name: "Retoucher 1", value: "Retoucher1" },
  Retoucher2: { role: "Retoucher", name: "Retoucher 2", value: "Retoucher2" },
  Retoucher3: { role: "Retoucher", name: "Retoucher 3", value: "Retoucher3" },
};
