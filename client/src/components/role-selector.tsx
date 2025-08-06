import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User } from "@/lib/types";

interface RoleSelectorProps {
  user: User | null;
  onChangeRole: (roleValue: string) => void;
}

export function RoleSelector({ user, onChangeRole }: RoleSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <Label className="text-sm font-medium text-gray-700">Role:</Label>
      <Select value={user?.value || ""} onValueChange={onChangeRole}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Admin">Sales/Admin</SelectItem>
          <SelectItem value="LeadRetoucher">Lead Retoucher</SelectItem>
          <SelectItem value="DataWrangler">Data Wrangler</SelectItem>
          <SelectItem value="Retoucher1">Earl (Retoucher 1)</SelectItem>
          <SelectItem value="Retoucher2">Dr Asa (Retoucher 2)</SelectItem>
          <SelectItem value="Retoucher3">Lucky (Retoucher 3)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
