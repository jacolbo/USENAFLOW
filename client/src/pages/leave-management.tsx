import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAdminHeaders } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarDays, Clock, Loader2 } from "lucide-react";
import type { LeaveRequest } from "@shared/schema";

function getWeekdaysCount(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export default function LeaveManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userRole = localStorage.getItem("usena_role") || "";
  const userId = localStorage.getItem("usena_user_id") || "";
  const isAdmin = userRole === "Admin";

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState("annual");

  const headers = useMemo(() => getAdminHeaders(userRole, userId), [userRole, userId]);

  const { data: leaveRequests = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave/requests"],
    queryFn: async () => {
      const res = await fetch("/api/leave/requests", { headers });
      if (!res.ok) throw new Error("Failed to fetch leave requests");
      return res.json();
    },
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const weekdaysCount = getWeekdaysCount(start, end);

      if (weekdaysCount < 1) throw new Error("Please select valid dates with at least 1 weekday");

      const res = await fetch("/api/leave/request", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, weekdaysCount, reason, leaveType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave/requests"] });
      setStartDate("");
      setEndDate("");
      setReason("");
      setLeaveType("annual");
      toast({ title: "Leave Logged", description: "Your leave has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const weekdaysPreview = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    return getWeekdaysCount(start, end);
  }, [startDate, endDate]);

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500">Please log in from the dashboard first.</p>
            <Button className="mt-4" onClick={() => setLocation("/")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Leave Management
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Request Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="personal">Personal Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                {weekdaysPreview > 0 && (
                  <p className="text-sm text-gray-500">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {weekdaysPreview} weekday{weekdaysPreview !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Brief reason for leave..."
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={createMutation.isPending || !startDate || !endDate || !reason}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Log Leave
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? "All Leave Requests" : "My Leave Requests"}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : leaveRequests.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No leave requests found.</p>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map((req) => (
                  <div
                    key={req.id}
                    className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3"
                  >
                    <div className="flex-1 space-y-1">
                      {isAdmin && (
                        <p className="font-semibold text-sm">{req.username}</p>
                      )}
                      <p className="text-sm">
                        {new Date(req.startDate).toLocaleDateString()} — {new Date(req.endDate).toLocaleDateString()}
                        <span className="text-gray-500 ml-2">({req.weekdaysCount} day{req.weekdaysCount !== 1 ? "s" : ""})</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        <Badge variant="outline" className="mr-2 capitalize">{req.leaveType}</Badge>
                        {req.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">Logged</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
