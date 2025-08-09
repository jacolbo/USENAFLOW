import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { User } from "@/lib/types";
import { format, startOfWeek, startOfMonth, startOfDay, subDays, parseISO, isWithinInterval } from "date-fns";
import { TrendingUp, BarChart3, Calendar, Users } from "lucide-react";
import { AnalyticsHeader } from "@/components/analytics-header";

type Granularity = "daily" | "weekly" | "monthly";

interface ChartDataPoint {
  period: string;
  photos: number;
  fullDate: string;
}

export default function TeamProgress() {
  // Get user from localStorage (same pattern as dashboard)
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // If no user logged in, redirect to dashboard
  if (!user) {
    window.location.href = '/';
    return null;
  }
  // Role-based access control
  const allowedRoles = ["Admin", "Sales", "LeadRetoucher"];
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="bg-gray-900 border-gray-800 max-w-md">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-gray-400">
              Team Progress analytics are only available to Admin, Sales, and Lead Retoucher roles.
            </p>
          </CardContent>
        </Card>
      </div>
    );
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

    // Convert to chart data
    const chartData: ChartDataPoint[] = Array.from(buckets.entries())
      .map(([period, photos]) => {
        let displayPeriod: string;
        
        switch (granularity) {
          case "daily":
            displayPeriod = format(parseISO(period + "T00:00:00"), "MMM d");
            break;
          case "weekly":
            displayPeriod = format(parseISO(period + "T00:00:00"), "MMM d");
            break;
          case "monthly":
            displayPeriod = format(parseISO(period + "-01T00:00:00"), "MMM yyyy");
            break;
        }
        
        return {
          period: displayPeriod,
          photos,
          fullDate: period
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AnalyticsHeader user={user} />
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="h-8 w-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Team Progress Analytics</h1>
        </div>

        {/* Controls */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filters & Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <Label htmlFor="fromDate" className="text-gray-300">From Date</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate" className="text-gray-300">To Date</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              {/* Granularity */}
              <div className="space-y-2">
                <Label className="text-gray-300">Granularity</Label>
                <Select value={granularity} onValueChange={(value: Granularity) => setGranularity(value)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Button */}
              <div className="space-y-2">
                <Label className="text-gray-300">&nbsp;</Label>
                <Button 
                  onClick={handleDateReset}
                  variant="outline" 
                  className="w-full bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                >
                  Last 30 Days
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Photos Delivered</p>
                  <p className="text-3xl font-bold text-white">{analyticsData.totalPhotos.toLocaleString()}</p>
                </div>
                <div className="bg-blue-500/20 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Time Periods</p>
                  <p className="text-3xl font-bold text-white">{analyticsData.bucketsCount}</p>
                </div>
                <div className="bg-green-500/20 p-3 rounded-full">
                  <Calendar className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Average Per Period</p>
                  <p className="text-3xl font-bold text-white">{analyticsData.avgPhotos.toFixed(1)}</p>
                </div>
                <div className="bg-purple-500/20 p-3 rounded-full">
                  <BarChart3 className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {analyticsData.chartData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
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
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#FFFFFF'
                        }}
                        labelStyle={{ color: '#9CA3AF' }}
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

            {/* Bar Chart */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Distribution Histogram
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.chartData}>
                      <XAxis 
                        dataKey="period" 
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#FFFFFF'
                        }}
                        labelStyle={{ color: '#9CA3AF' }}
                      />
                      <Bar 
                        dataKey="photos" 
                        fill="#10B981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <BarChart3 className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                No delivered projects found in the selected date range. 
                Try adjusting your filters or check if projects have been marked as delivered.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}