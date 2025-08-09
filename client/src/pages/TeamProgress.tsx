import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, startOfWeek, startOfMonth, isWithinInterval, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { Line, Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend } from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnalyticsHeader } from "@/components/analytics-header";
import { Link } from "wouter";
import { User } from "@/lib/types";
import { Project } from "@shared/schema";

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const ROLES_OK = new Set(['Admin','WorkflowManager','Sales']);
const toDate = (v?: string | Date) => {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
};

const photosInProject = (p: Project) => {
  if (typeof p.selectedCount === 'number') return Math.max(0, p.selectedCount);
  const pkg = typeof p.packageCount === 'number' ? p.packageCount : 0;
  const ex  = typeof p.extras === 'number' ? p.extras : 0;
  return Math.max(0, pkg + ex);
};

type Granularity = 'daily' | 'weekly' | 'monthly';

export default function TeamProgress(){
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
  
  const [gran, setGran] = useState<Granularity>('daily');
  const [range, setRange] = useState<{from: string; to: string}>(() => {
    const to = new Date();
    const from = new Date(); 
    from.setMonth(to.getMonth()-1);
    return { 
      from: from.toISOString().slice(0,10), 
      to: to.toISOString().slice(0,10) 
    };
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const filtered = useMemo(() => {
    const from = new Date(range.from + 'T00:00:00');
    const to   = new Date(range.to   + 'T23:59:59');
    return projects.filter(p => {
      if (p.status !== 'Delivered') return false;
      const d = toDate(p.deliveredAt);
      if (!d) return false;
      return isWithinInterval(d, { start: from, end: to });
    });
  }, [projects, range.from, range.to]);

  // Build buckets by granularity
  const series = useMemo(() => {
    const from = new Date(range.from + 'T00:00:00');
    const to   = new Date(range.to   + 'T23:59:59');

    let buckets: Date[] = [];
    let labeler: (d: Date)=>string;
    let keyer:   (d: Date)=>number;

    if (gran === 'daily') {
      buckets = eachDayOfInterval({ start: from, end: to }).map(d => startOfDay(d));
      labeler = d => format(d, 'EEE d MMM');
      keyer   = d => startOfDay(d).getTime();
    } else if (gran === 'weekly') {
      buckets = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map(d => startOfWeek(d, { weekStartsOn: 1 }));
      labeler = d => `Wk ${format(d,'d MMM')}`;
      keyer   = d => startOfWeek(d, { weekStartsOn: 1 }).getTime();
    } else {
      buckets = eachMonthOfInterval({ start: from, end: to }).map(d => startOfMonth(d));
      labeler = d => format(d, 'MMM yyyy');
      keyer   = d => startOfMonth(d).getTime();
    }

    const map = new Map<number, number>(); // key -> photos
    for (const b of buckets) map.set(keyer(b), 0);

    for (const p of filtered) {
      const deliveryDate = toDate(p.deliveredAt);
      if (!deliveryDate) continue; // Skip if no delivery date
      const photos = photosInProject(p);
      let bin: Date;
      if (gran === 'daily') bin = startOfDay(deliveryDate);
      else if (gran === 'weekly') bin = startOfWeek(deliveryDate, { weekStartsOn: 1 });
      else bin = startOfMonth(deliveryDate);
      const key = keyer(bin);
      map.set(key, (map.get(key) || 0) + photos);
    }

    const labels = buckets.map(b => labeler(b));
    const values = buckets.map(b => map.get(keyer(b)) || 0);
    return { labels, values };
  }, [filtered, gran, range.from, range.to]);

  // Check if user is logged in and has permission
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Please Log In</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You need to be logged in to access team progress.
            </p>
            <Link href="/">
              <Button>Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ROLES_OK.has(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <AnalyticsHeader user={user} />
          <div className="flex items-center justify-center">
            <Card className="w-96">
              <CardContent className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  You don't have access to Team Progress.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const total = series.values.reduce((a,b)=>a+b,0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <AnalyticsHeader user={user} />
        
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Team Progress</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Photos counted only when Sales/Admin mark the project as <strong>Delivered</strong>.
            </p>
          </div>

          {/* Controls */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="from-date">From</Label>
                  <Input 
                    id="from-date"
                    type="date" 
                    value={range.from} 
                    onChange={e=>setRange(r=>({...r, from:e.target.value}))}
                    className="w-auto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to-date">To</Label>
                  <Input 
                    id="to-date"
                    type="date" 
                    value={range.to} 
                    onChange={e=>setRange(r=>({...r, to:e.target.value}))}
                    className="w-auto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="granularity">View</Label>
                  <Select value={gran} onValueChange={(value: Granularity) => setGran(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-8 flex-wrap">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{total}</div>
                  <div className="text-sm text-gray-600">Total Photos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{series.values.length}</div>
                  <div className="text-sm text-gray-600">Time Periods</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {series.values.length ? (total/series.values.length).toFixed(1) : '0.0'}
                  </div>
                  <div className="text-sm text-gray-600">Avg per Period</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line chart: photos over time */}
          <Card>
            <CardHeader>
              <CardTitle>Photos Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: '400px' }}>
                <Line 
                  data={{
                    labels: series.labels,
                    datasets: [{ 
                      label: 'Photos', 
                      data: series.values,
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true
                    }]
                  }} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                      }
                    },
                    elements: { point: { radius: 4, hoverRadius: 6 } },
                    scales: { 
                      x: { 
                        ticks: { maxRotation:45, autoSkip:true },
                        grid: { display: false }
                      },
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.1)' }
                      }
                    }
                  }} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Histogram: distribution of photos per bucket */}
          <Card>
            <CardHeader>
              <CardTitle>Distribution Histogram</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: '400px' }}>
                <Bar 
                  data={{
                    labels: series.labels,
                    datasets: [{ 
                      label: 'Photos', 
                      data: series.values,
                      backgroundColor: 'rgba(34, 197, 94, 0.8)',
                      borderColor: 'rgb(34, 197, 94)',
                      borderWidth: 1
                    }]
                  }} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                      }
                    },
                    scales: { 
                      x: { 
                        ticks: { maxRotation:45, autoSkip:true },
                        grid: { display: false }
                      },
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.1)' }
                      }
                    }
                  }} 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}