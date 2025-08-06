import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User } from "@/lib/types";

interface RoleSelectorProps {
  user: User | null;
  onChangeRole: (roleValue: string) => void;
  allUsers: User[];
}

export function RoleSelector({ user, onChangeRole, allUsers }: RoleSelectorProps) {
  const getDisplayName = (user: User) => {
    // Default users with special formatting
    if (user.value === "Admin") return "Sales/Admin";
    if (user.value === "LeadRetoucher") return "Lead Retoucher";
    if (user.value === "DataWrangler") return "Data Wrangler";
    if (user.value === "Retoucher1") return "Earl (Retoucher 1)";
    if (user.value === "Retoucher2") return "Dr Asa (Retoucher 2)";
    if (user.value === "Retoucher3") return "Lucky (Retoucher 3)";
    
    // Custom users
    if (user.role === "Retoucher") return `${user.name} (${user.role})`;
    return `${user.name} (${user.role})`;
  };

  return (
    <div className="flex items-center space-x-2">
      <Label className="text-sm font-medium text-gray-700">Role:</Label>
      <Select value={user?.value || ""} onValueChange={onChangeRole}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          {allUsers.map((userOption) => (
            <SelectItem key={userOption.value} value={userOption.value}>
              {getDisplayName(userOption)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
