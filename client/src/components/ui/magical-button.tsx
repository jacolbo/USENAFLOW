import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";

interface MagicalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  magicalEffect?: "glow" | "pulse" | "bounce" | "sparkle" | "gradient";
  isLoading?: boolean;
  loadingText?: string;
}

export function MagicalButton({
  children,
  variant = "default",
  size = "default",
  magicalEffect = "glow",
  isLoading = false,
  loadingText = "Loading...",
  className = "",
  ...props
}: MagicalButtonProps) {
  const effects = {
    glow: {
      whileHover: {
        boxShadow: "0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3)",
        scale: 1.05,
        transition: { duration: 0.3 }
      },
      whileTap: { scale: 0.95 }
    },
    pulse: {
      animate: {
        scale: [1, 1.05, 1],
        opacity: [1, 0.9, 1]
      },
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    bounce: {
      whileHover: {
        y: [-2, -8, -2],
        transition: {
          duration: 0.4,
          ease: "easeInOut"
        }
      },
      whileTap: { y: 0 }
    },
    sparkle: {
      whileHover: {
        background: [
          "linear-gradient(45deg, #3b82f6, #8b5cf6, #06b6d4, #3b82f6)",
          "linear-gradient(45deg, #8b5cf6, #06b6d4, #3b82f6, #8b5cf6)",
          "linear-gradient(45deg, #06b6d4, #3b82f6, #8b5cf6, #06b6d4)"
        ],
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: "linear"
        }
      }
    },
    gradient: {
      animate: {
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
      },
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "linear"
      }
    }
  };

  const sparkleVariants = {
    hidden: { opacity: 0, scale: 0, rotate: 0 },
    visible: {
      opacity: [0, 1, 0],
      scale: [0, 1, 0],
      rotate: [0, 180, 360],
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div className="relative inline-block">
      <motion.div
        {...effects[magicalEffect]}
        className="relative"
      >
        <Button
          variant={variant}
          size={size}
          className={`relative overflow-hidden ${className}`}
          disabled={isLoading}
          {...props}
        >
          {/* Background animations for sparkle effect */}
          {magicalEffect === "sparkle" && (
            <>
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 opacity-30"
                  animate={{
                    background: [
                      `linear-gradient(${45 + i * 60}deg, transparent, rgba(255,255,255,0.3), transparent)`,
                      `linear-gradient(${45 + i * 60}deg, transparent, rgba(255,255,255,0.1), transparent)`
                    ]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </>
          )}

          {/* Floating sparkles for sparkle effect */}
          {magicalEffect === "sparkle" && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={`sparkle-${i}`}
                  className="absolute w-1 h-1 bg-white rounded-full"
                  style={{
                    left: `${20 + i * 20}%`,
                    top: `${20 + (i % 2) * 40}%`
                  }}
                  variants={sparkleVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: i * 0.2 }}
                />
              ))}
            </div>
          )}

          {/* Content */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2"
              >
                <motion.div
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                {loadingText}
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2"
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      {/* Glow effect for glow variant */}
      {magicalEffect === "glow" && (
        <motion.div
          className="absolute inset-0 rounded-lg blur-lg opacity-0"
          style={{
            background: "linear-gradient(45deg, #3b82f6, #8b5cf6)",
            zIndex: -1
          }}
          whileHover={{ opacity: 0.3 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.div>
  );
}

interface FloatingActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  className?: string;
}

export function FloatingActionButton({
  children,
  position = "bottom-right",
  className = "",
  ...props
}: FloatingActionButtonProps) {
  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "top-right": "top-6 right-6",
    "top-left": "top-6 left-6"
  };

  return (
    <motion.div
      className={`fixed ${positionClasses[position]} z-50`}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ 
        scale: 1.1,
        rotate: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
      }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Button
        className={`rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}
        {...props}
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          {children}
        </motion.div>
      </Button>
    </motion.div>
  );
}