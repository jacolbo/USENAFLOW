import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronRight, Calendar, AlertTriangle, Search, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import type { Complaint } from "@shared/schema";

interface User {
  id: string;
  name: string;
  role: string;
  value?: string;
  abbr?: string;
}

interface ComplaintsCalendarProps {
  complaints: Complaint[];
  user: User;
  onUpdateComplaint?: (complaintId: string, status: 'open' | 'in_progress' | 'resolved') => void;
}

export function ComplaintsCalendar({ complaints, user, onUpdateComplaint }: ComplaintsCalendarProps) {
  const [collapsedWeeks, setCollapsedWeeks] = useState<{ [key: string]: boolean }>({});
  const [searchTerms, setSearchTerms] = useState<{ [key: string]: string }>({});

  // Only show for Evans role
  if (user.role !== "Evans") {
    return null;
  }

  const getWeekStart = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    // Sunday starts the week (day 0 = Sunday)
    const diff = day === 0 ? 0 : -day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const formatWeekRange = (weekStart: Date) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
  };

  const toggleWeek = (weekKey: string) => {
    setCollapsedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  const filterComplaintsBySearch = (complaints: Complaint[], weekKey: string) => {
    const searchTerm = searchTerms[weekKey]?.toLowerCase() || '';
    if (!searchTerm) return complaints;
    
    return complaints.filter(complaint => 
      complaint.issueDescription?.toLowerCase().includes(searchTerm) ||
      complaint.reportedBy?.toLowerCase().includes(searchTerm)
    );
  };

  // Group complaints by weeks based on due date
  const visibleGroups: { key: number; weekStart: Date; complaints: Complaint[] }[] = [];
  
  complaints.forEach(complaint => {
    const weekStart = getWeekStart(new Date(complaint.requestedDueDate));
    const key = weekStart.getTime();
    let group = visibleGroups.find(g => g.key === key);
    if (!group) {
      group = { key: key, weekStart: weekStart, complaints: [] };
      visibleGroups.push(group);
    }
    group.complaints.push(complaint);
  });

  // Sort groups by week start date (most recent first)
  visibleGroups.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());

  const getComplaintStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getComplaintStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertTriangle className="h-3 w-3" />;
      case 'in_progress': return <Clock className="h-3 w-3" />;
      case 'resolved': return <CheckCircle className="h-3 w-3" />;
      default: return <XCircle className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-5 w-5 text-blue-600" />
        <h2 className="text-2xl font-bold">Complaints Calendar</h2>
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          Evans View
        </Badge>
      </div>

      {visibleGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-400">No complaints to manage</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">All issues have been resolved!</p>
          </CardContent>
        </Card>
      ) : (
        visibleGroups.map(group => {
          const monday = group.weekStart;
          const weekLabel = formatWeekRange(monday);
          const weekKey = monday.toISOString().split('T')[0];
          const isCollapsed = collapsedWeeks[weekKey];
          
          // Sort complaints by due date within the week
          group.complaints.sort((a, b) => {
            const dateComparison = new Date(a.requestedDueDate).getTime() - new Date(b.requestedDueDate).getTime();
            if (dateComparison !== 0) return dateComparison;
            return a.id.localeCompare(b.id);
          });
          
          const filteredComplaints = filterComplaintsBySearch(group.complaints, weekKey);
          const assignedCount = filteredComplaints.filter(c => c.status === 'in_progress').length;
          const totalCount = filteredComplaints.length;
          
          return (
            <motion.div
              key={group.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              layout
            >
              <Card>
                <motion.div
                  whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}
                  transition={{ duration: 0.2 }}
                >
                  <CardHeader 
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleWeek(weekKey)}
                  >
                    <CardTitle className="flex items-center justify-between">
                      <motion.div 
                        className="flex items-center gap-2"
                        whileHover={{ x: 4 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      >
                        <motion.div
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                        >
                          <ChevronRight className="h-5 w-5 text-gray-600" />
                        </motion.div>
                        <span className="text-lg font-semibold">{weekLabel}</span>
                        <Badge variant="outline" className="ml-2">
                          <span className="text-yellow-600">{assignedCount}</span>
                          /
                          <span className="text-red-600">{totalCount}</span>
                          {" complaints"}
                        </Badge>
                      </motion.div>
                    </CardTitle>
                  </CardHeader>
                </motion.div>

                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <CardContent>
                        {/* Search input */}
                        <div className="mb-4">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                              placeholder="Search complaints by client, issue, or submitter..."
                              value={searchTerms[weekKey] || ''}
                              onChange={(e) => setSearchTerms(prev => ({
                                ...prev,
                                [weekKey]: e.target.value
                              }))}
                              className="pl-8"
                              data-testid={`search-complaints-${weekKey}`}
                            />
                          </div>
                        </div>

                        {/* Calendar grid */}
                        <div className="mb-6 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                          <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 7 }).map((_, dayIndex) => {
                              const dayDate = new Date(monday);
                              dayDate.setDate(monday.getDate() + dayIndex);
                              const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                              const dayNumber = dayDate.getDate();
                              
                              const dayComplaints = filteredComplaints.filter(complaint => {
                                const complaintDate = new Date(complaint.requestedDueDate);
                                return complaintDate.toDateString() === dayDate.toDateString();
                              });

                              return (
                                <div key={dayIndex} className="min-h-[120px]">
                                  <div className="text-center mb-2 p-2 bg-white dark:bg-gray-800 rounded shadow-sm">
                                    <div className="font-medium text-sm">{dayName}</div>
                                    <div className="text-xs text-gray-500">{dayNumber}</div>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    {dayComplaints.map((complaint) => (
                                      <motion.div
                                        key={complaint.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileHover={{ scale: 1.02 }}
                                        transition={{ duration: 0.2 }}
                                        className="group"
                                      >
                                        <Badge 
                                          className={`w-full justify-start text-xs cursor-pointer ${getComplaintStatusColor(complaint.status)}`}
                                          onClick={() => {
                                            // Cycle through statuses
                                            const nextStatus = complaint.status === 'open' ? 'in_progress' : 
                                                             complaint.status === 'in_progress' ? 'resolved' : 'open';
                                            onUpdateComplaint?.(complaint.id, nextStatus);
                                          }}
                                          data-testid={`complaint-badge-${complaint.id}`}
                                        >
                                          <motion.div className="flex items-center gap-1 w-full">
                                            {getComplaintStatusIcon(complaint.status)}
                                            <span className="truncate flex-1">
                                              Issue #{complaint.id.slice(-6)}
                                            </span>
                                          </motion.div>
                                        </Badge>
                                      </motion.div>
                                    ))}
                                  </div>
                                  
                                  {dayComplaints.length === 0 && (
                                    <div className="text-xs text-gray-400 dark:text-gray-600 opacity-50 h-[60px] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded">
                                      No complaints
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })
      )}
    </div>
  );
}