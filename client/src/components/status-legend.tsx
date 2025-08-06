import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export function StatusLegend() {
  const statuses = [
    { name: "Awaiting Payment", className: "bg-orange-500 text-white hover:bg-orange-600" },
    { name: "Ready for Retouching", className: "bg-blue-500 text-white hover:bg-blue-600" },
    { name: "Assigned", className: "bg-purple-500 text-white hover:bg-purple-600" },
    { name: "Review", className: "bg-red-500 text-white hover:bg-red-600" },
    { name: "Delivered", className: "bg-green-500 text-white hover:bg-green-600" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          Status Legend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statuses.map((status) => (
            <div key={status.name} className="flex items-center space-x-2">
              <Badge variant="secondary" className={status.className}>
                {status.name}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
