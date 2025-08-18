import { motion } from 'framer-motion';
import { Loader2, Camera, Edit, Eye, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

// Generic animated loading spinner
export const LoadingSpinner = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    className={className}
  >
    <Loader2 size={size} />
  </motion.div>
);

// Project status-specific loading animations
export const ProjectStatusLoader = ({ status, size = 20 }: { status: string; size?: number }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'Awaiting Payment':
        return <Clock size={size} className="text-yellow-500" />;
      case 'Ready':
        return <Camera size={size} className="text-blue-500" />;
      case 'Assigned':
        return <Edit size={size} className="text-orange-500" />;
      case 'Review':
        return <Eye size={size} className="text-purple-500" />;
      case 'Delivered':
        return <CheckCircle size={size} className="text-green-500" />;
      default:
        return <AlertTriangle size={size} className="text-gray-500" />;
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="inline-flex items-center"
    >
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {getStatusIcon()}
      </motion.div>
    </motion.div>
  );
};

// Assignment loading animation
export const AssignmentLoader = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex items-center gap-2 text-blue-600 dark:text-blue-400"
  >
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <Edit size={16} />
    </motion.div>
    <motion.span
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="text-sm font-medium"
    >
      Assigning...
    </motion.span>
  </motion.div>
);

// Project badge loading skeleton
export const ProjectBadgeSkeleton = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="h-6 rounded px-2 py-1"
  >
    <motion.div
      animate={{ 
        background: [
          "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
          "linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)",
          "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)"
        ]
      }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="h-4 w-20 rounded"
    />
  </motion.div>
);

// Table row loading skeleton
export const TableRowSkeleton = () => (
  <motion.tr
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="border-b border-gray-200 dark:border-gray-700"
  >
    {Array.from({ length: 9 }).map((_, index) => (
      <td key={index} className="p-4">
        <motion.div
          animate={{ 
            background: [
              "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
              "linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)",
              "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)"
            ]
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: index * 0.1 
          }}
          className="h-4 rounded"
          style={{ width: `${60 + (index * 10)}%` }}
        />
      </td>
    ))}
  </motion.tr>
);

// Drag and drop loading indicator
export const DragDropLoader = ({ isDragging }: { isDragging: boolean }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ 
      scale: isDragging ? 1 : 0,
      opacity: isDragging ? 1 : 0
    }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center"
  >
    <motion.div
      animate={{ 
        scale: [1, 1.1, 1],
        opacity: [0.7, 1, 0.7]
      }}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      className="text-blue-600 dark:text-blue-400 font-medium text-sm"
    >
      Drop here
    </motion.div>
  </motion.div>
);

// Success animation for completed actions
export const SuccessAnimation = ({ show, message }: { show: boolean; message: string }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ 
      scale: show ? 1 : 0,
      opacity: show ? 1 : 0
    }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="fixed top-4 right-4 z-50"
  >
    <motion.div
      initial={{ y: -20 }}
      animate={{ y: 0 }}
      className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
      >
        <CheckCircle size={20} />
      </motion.div>
      <span className="font-medium">{message}</span>
    </motion.div>
  </motion.div>
);

// Loading overlay for forms and modals
export const LoadingOverlay = ({ show, message = "Loading..." }: { show: boolean; message?: string }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: show ? 1 : 0 }}
    transition={{ duration: 0.2 }}
    className={`absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10 ${
      show ? 'pointer-events-auto' : 'pointer-events-none'
    }`}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: show ? 1 : 0.9,
        opacity: show ? 1 : 0
      }}
      transition={{ duration: 0.2, delay: show ? 0.1 : 0 }}
      className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
    >
      <LoadingSpinner size={24} className="text-blue-500" />
      <span className="text-gray-600 dark:text-gray-300 font-medium">{message}</span>
    </motion.div>
  </motion.div>
);

// Pulse animation for interactive elements
export const PulseWrapper = ({ children, isActive }: { children: React.ReactNode; isActive: boolean }) => (
  <motion.div
    animate={{ 
      scale: isActive ? [1, 1.02, 1] : 1,
      boxShadow: isActive 
        ? ["0 0 0 0 rgba(59, 130, 246, 0.4)", "0 0 0 4px rgba(59, 130, 246, 0.1)", "0 0 0 0 rgba(59, 130, 246, 0)"]
        : "0 0 0 0 rgba(59, 130, 246, 0)"
    }}
    transition={{ 
      duration: isActive ? 1.5 : 0.2,
      repeat: isActive ? Infinity : 0,
      ease: "easeInOut"
    }}
  >
    {children}
  </motion.div>
);

// Floating action wrapper with hover animations
export const FloatingAction = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    className={className}
    whileHover={{ 
      y: -2, 
      transition: { type: "spring", stiffness: 300, damping: 20 } 
    }}
    whileTap={{ scale: 0.98 }}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 25 }}
  >
    {children}
  </motion.div>
);

// Staggered list animation wrapper
export const StaggeredList = ({ children, className = "" }: { children: React.ReactNode[]; className?: string }) => (
  <div className={className}>
    {children.map((child, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        {child}
      </motion.div>
    ))}
  </div>
);