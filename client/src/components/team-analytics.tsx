import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { User } from "@/lib/types";
import { format, startOfWeek, startOfMonth, startOfDay, parseISO, isWithinInterval } from "date-fns";
import { TrendingUp, BarChart3, Calendar } from "lucide-react";

interface TeamAnalyticsProps {
  user: User;
}

type Granularity = "daily" | "weekly" | "monthly";

interface ChartDataPoint {
  period: string;
  photos: number;
  fullDate: string;
}

export function TeamAnalytics({ user }: TeamAnalyticsProps) {
  // Only show for allowed roles
  const allowedRoles = ["Admin", "Sales", "LeadRetoucher"];
  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  // State for filters
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return format(date, "yyyy-MM-dd");
  });
  const [toDate, setToDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["/api/projects"],
  });

  // Process analytics data
  const analyticsData = useMemo(() => {
    if (!projects.length) return { chartData: [], totalPhotos: 0, bucketsCount: 0, avgPhotos: 0 };

    const from = parseISO(fromDate + "T00:00:00");
    const to = parseISO(toDate + "T23:59:59");

    // Filter delivered projects within date range
    const deliveredProjects = (projects as Project[]).filter(project => {
      if (project.status !== "Delivered" || !project.deliveredAt) return false;
      
      const deliveredDate = parseISO(project.deliveredAt);
      return isWithinInterval(deliveredDate, { start: from, end: to });
    });

    // Create buckets based on granularity
    const buckets = new Map<string, number>();
    
    // Initialize buckets
    const current = new Date(from);
    const end = new Date(to);
    
    while (current <= end) {
      let bucketKey: string;
      let bucketDate: Date;
      
      switch (granularity) {
        case "daily":
          bucketDate = startOfDay(current);
          bucketKey = format(bucketDate, "yyyy-MM-dd");
          current.setDate(current.getDate() + 1);
          break;
        case "weekly":
          bucketDate = startOfWeek(current, { weekStartsOn: 1 });
          bucketKey = format(bucketDate, "yyyy-MM-dd");
          current.setDate(current.getDate() + 7);
          break;
        case "monthly":
          bucketDate = startOfMonth(current);
          bucketKey = format(bucketDate, "yyyy-MM");
          current.setMonth(current.getMonth() + 1);
          break;
      }
      
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, 0);
      }
    }

    // Aggregate photos by bucket
    deliveredProjects.forEach(project => {
      const deliveredDate = parseISO(project.deliveredAt!);
      let bucketKey: string;
      
      switch (granularity) {
        case "daily":
          bucketKey = format(startOfDay(deliveredDate), "yyyy-MM-dd");
          break;
        case "weekly":
          bucketKey = format(startOfWeek(deliveredDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
          break;
        case "monthly":
          bucketKey = format(startOfMonth(deliveredDate), "yyyy-MM");
          break;
      }

      // Calculate photo count: selectedCount or packageCount + extras
      const photoCount = project.selectedCount || (project.packageCount + Math.max(0, project.extras || 0));
      
      if (buckets.has(bucketKey)) {
        buckets.set(bucketKey, buckets.get(bucketKey)! + photoCount);
      }
    });

    // Convert to chart data with proper sorting
    const chartData: ChartDataPoint[] = Array.from(buckets.entries())
      .map(([period, photos]) => {
        // Create a full date for sorting
        let fullDate: string;
        if (granularity === "daily") {
          fullDate = period; // already in yyyy-MM-dd format
        } else if (granularity === "weekly") {
          fullDate = period; // already in yyyy-MM-dd format
        } else {
          fullDate = period + "-01"; // yyyy-MM-01 format for months
        }
        
        return {
          period: granularity === "daily" ? format(parseISO(fullDate), "MMM dd") :
                  granularity === "weekly" ? format(parseISO(fullDate), "MMM dd") :
                  format(parseISO(fullDate), "MMM yyyy"),
          photos,
          fullDate
        };
      })
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    const totalPhotos = Array.from(buckets.values()).reduce((sum, count) => sum + count, 0);
    const bucketsCount = buckets.size;
    const avgPhotos = bucketsCount > 0 ? totalPhotos / bucketsCount : 0;

    return { chartData, totalPhotos, bucketsCount, avgPhotos };
  }, [projects, fromDate, toDate, granularity]);

  const handleDateReset = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    setFromDate(format(date, "yyyy-MM-dd"));
    setToDate(format(new Date(), "yyyy-MM-dd"));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-blue-500" />
          <h2 className="text-xl font-semibold">Team Progress Analytics</h2>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-blue-500" />
        <h2 className="text-xl font-semibold">Team Progress Analytics</h2>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Filters & Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            
            {/* Granularity */}
            <div className="space-y-2">
              <Label>Granularity</Label>
              <Select value={granularity} onValueChange={(value: Granularity) => setGranularity(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Button */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={handleDateReset} variant="outline" className="w-full">
                Last 30 Days
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Photos Delivered</p>
                <p className="text-3xl font-bold text-blue-600">{analyticsData.totalPhotos}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Time Periods</p>
                <p className="text-3xl font-bold text-green-600">{analyticsData.bucketsCount}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Per Period</p>
                <p className="text-3xl font-bold text-purple-600">{analyticsData.avgPhotos.toFixed(1)}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {analyticsData.chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Photos Delivered Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData.chartData}>
                  <XAxis 
                    dataKey="period" 
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="photos" 
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#3B82F6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              No delivered projects found in the selected date range. 
              Try adjusting your date filters or check that projects are marked as "Delivered".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}