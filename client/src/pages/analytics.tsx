import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, TrendingUp, BarChart3 } from "lucide-react";
import { Project } from "@shared/schema";
import { User } from "@/lib/types";
import { AnalyticsHeader } from "@/components/analytics-header";
import { Link } from "wouter";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function Analytics() {
  // Get user from localStorage
  const getStoredSession = () => {
    try {
      const storedData = localStorage.getItem('userSession');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        const now = new Date();
        const sessionTime = new Date(parsedData.timestamp);
        const timeDiff = now.getTime() - sessionTime.getTime();
        const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
        
        if (timeDiff < SESSION_TIMEOUT) {
          return parsedData.user;
        } else {
          localStorage.removeItem('userSession');
        }
      }
    } catch (error) {
      console.error('Error retrieving stored session:', error);
      localStorage.removeItem('userSession');
    }
    return null;
  };

  const user = getStoredSession();
  // Check if user is logged in and has permission
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Please Log In</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You need to be logged in to access analytics.
            </p>
            <Link href="/">
              <Button>Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!['Admin', 'Sales', 'WorkflowManager'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <AnalyticsHeader user={user} />
          <div className="flex items-center justify-center">
            <Card className="w-96">
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  You don't have permission to access team analytics.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [customStartDate, setCustomStartDate] = useState(
    format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  // Fetch all projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    // Only include delivered projects with deliveredAt date
    const deliveredProjects = projects.filter(p => 
      p.status === 'Delivered' && p.deliveredAt
    );

    if (deliveredProjects.length === 0) {
      return { chartData: null, histogramData: null, totalPhotos: 0, totalProjects: 0 };
    }

    // Determine date range
    let startDate: Date;
    let endDate: Date;
    
    if (timeRange === 'custom') {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else {
      const now = new Date();
      switch (timeRange) {
        case 'daily':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks
          break;
        case 'monthly':
          startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      endDate = now;
    }

    // Filter projects by date range
    const filteredProjects = deliveredProjects.filter(p => {
      const deliveredDate = new Date(p.deliveredAt!);
      return deliveredDate >= startDate && deliveredDate <= endDate;
    });

    // Generate time intervals
    let intervals: Date[];
    let formatString: string;
    
    switch (timeRange) {
      case 'daily':
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
        formatString = 'MMM dd';
        break;
      case 'weekly':
        intervals = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
        formatString = 'MMM dd';
        break;
      case 'monthly':
        intervals = eachMonthOfInterval({ start: startDate, end: endDate });
        formatString = 'MMM yyyy';
        break;
      case 'custom':
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 31) {
          intervals = eachDayOfInterval({ start: startDate, end: endDate });
          formatString = 'MMM dd';
        } else if (daysDiff <= 365) {
          intervals = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
          formatString = 'MMM dd';
        } else {
          intervals = eachMonthOfInterval({ start: startDate, end: endDate });
          formatString = 'MMM yyyy';
        }
        break;
    }

    // Group projects by time interval
    const dataPoints = intervals.map(intervalStart => {
      let intervalEnd: Date;
      
      switch (timeRange) {
        case 'daily':
          intervalEnd = new Date(intervalStart.getTime() + 24 * 60 * 60 * 1000 - 1);
          break;
        case 'weekly':
          intervalEnd = new Date(intervalStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
          break;
        case 'monthly':
          intervalEnd = new Date(intervalStart.getFullYear(), intervalStart.getMonth() + 1, 0, 23, 59, 59);
          break;
        case 'custom':
          const daysDiffCheck = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiffCheck <= 31) {
            intervalEnd = new Date(intervalStart.getTime() + 24 * 60 * 60 * 1000 - 1);
          } else if (daysDiffCheck <= 365) {
            intervalEnd = new Date(intervalStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
          } else {
            intervalEnd = new Date(intervalStart.getFullYear(), intervalStart.getMonth() + 1, 0, 23, 59, 59);
          }
          break;
      }

      const projectsInInterval = filteredProjects.filter(p => {
        const deliveredDate = new Date(p.deliveredAt!);
        return deliveredDate >= intervalStart && deliveredDate <= intervalEnd;
      });

      const photosInInterval = projectsInInterval.reduce((sum, p) => sum + (p.selectedCount || 0), 0);

      return {
        label: format(intervalStart, formatString),
        photos: photosInInterval,
        projects: projectsInInterval.length
      };
    });

    // Line chart data
    const chartData = {
      labels: dataPoints.map(d => d.label),
      datasets: [
        {
          label: 'Photos Edited',
          data: dataPoints.map(d => d.photos),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1,
        },
        {
          label: 'Projects Completed',
          data: dataPoints.map(d => d.projects),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.1,
          yAxisID: 'y1',
        }
      ],
    };

    // Histogram data - distribution of photos per project
    const photoCounts = filteredProjects.map(p => p.selectedCount || 0);
    const maxPhotos = Math.max(...photoCounts);
    const bins = 10;
    const binSize = Math.ceil(maxPhotos / bins);
    
    const histogram = Array(bins).fill(0);
    const binLabels = [];
    
    for (let i = 0; i < bins; i++) {
      const start = i * binSize;
      const end = (i + 1) * binSize - 1;
      binLabels.push(`${start}-${end}`);
    }
    
    photoCounts.forEach(count => {
      const binIndex = Math.min(Math.floor(count / binSize), bins - 1);
      histogram[binIndex]++;
    });

    const histogramData = {
      labels: binLabels,
      datasets: [
        {
          label: 'Number of Projects',
          data: histogram,
          backgroundColor: 'rgba(147, 51, 234, 0.6)',
          borderColor: 'rgba(147, 51, 234, 1)',
          borderWidth: 1,
        },
      ],
    };

    const totalPhotos = filteredProjects.reduce((sum, p) => sum + (p.selectedCount || 0), 0);
    const totalProjects = filteredProjects.length;

    return { chartData, histogramData, totalPhotos, totalProjects };
  }, [projects, timeRange, customStartDate, customEndDate]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Photos Edited Over Time',
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Photos Edited'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Projects Completed'
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const histogramOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Distribution of Photos per Project',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Photos per Project'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Number of Projects'
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <AnalyticsHeader user={user} />
        
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Progress Analytics</h1>
          </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Time Range Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="timeRange">Time Range</Label>
              <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (30 days)</SelectItem>
                  <SelectItem value="weekly">Weekly (12 weeks)</SelectItem>
                  <SelectItem value="monthly">Monthly (12 months)</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {timeRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Photos Edited</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analyticsData.totalPhotos.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Projects Completed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analyticsData.totalProjects.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Photos/Project</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analyticsData.totalProjects > 0 
                    ? Math.round(analyticsData.totalPhotos / analyticsData.totalProjects)
                    : 0
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {analyticsData.chartData && analyticsData.histogramData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Photos Edited Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Line data={analyticsData.chartData} options={chartOptions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <Bar data={analyticsData.histogramData} options={histogramOptions} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Data Available</h3>
            <p className="text-gray-600 dark:text-gray-400">
              No delivered projects found in the selected time range. Projects must be marked as "Delivered" with a delivery date to appear in analytics.
            </p>
          </CardContent>
        </Card>
      )}
        </div>
      </div>
    </div>
  );
}