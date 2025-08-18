import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, ReactNode } from "react";

interface AnimatedScrollProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedScrollContainer({ children, className = "" }: AnimatedScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "-10%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <motion.div
      ref={ref}
      style={{ y, opacity }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface FadeInViewProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeInView({ 
  children, 
  delay = 0, 
  duration = 0.6, 
  className = "" 
}: FadeInViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface SlideInViewProps {
  children: ReactNode;
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
  className?: string;
}

export function SlideInView({ 
  children, 
  direction = "up", 
  delay = 0, 
  className = "" 
}: SlideInViewProps) {
  const directionOffset = {
    left: { x: -50, y: 0 },
    right: { x: 50, y: 0 },
    up: { x: 0, y: 50 },
    down: { x: 0, y: -50 }
  };

  const initial = {
    opacity: 0,
    ...directionOffset[direction]
  };

  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface ScaleInViewProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function ScaleInView({ children, delay = 0, className = "" }: ScaleInViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ 
        delay, 
        duration: 0.5, 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggeredChildrenProps {
  children: ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export function StaggeredChildren({ 
  children, 
  staggerDelay = 0.1, 
  className = "" 
}: StaggeredChildrenProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay
          }
        }
      }}
      className={className}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { 
              opacity: 1, 
              y: 0,
              transition: { duration: 0.5, ease: "easeOut" }
            }
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

interface FloatingElementProps {
  children: ReactNode;
  intensity?: number;
  className?: string;
}

export function FloatingElement({ 
  children, 
  intensity = 1, 
  className = "" 
}: FloatingElementProps) {
  return (
    <motion.div
      animate={{
        y: [0, -10 * intensity, 0],
        rotate: [0, 2 * intensity, -2 * intensity, 0]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface PulsatingElementProps {
  children: ReactNode;
  scale?: number[];
  duration?: number;
  className?: string;
}

export function PulsatingElement({ 
  children, 
  scale = [1, 1.05, 1], 
  duration = 2,
  className = "" 
}: PulsatingElementProps) {
  return (
    <motion.div
      animate={{
        scale,
        boxShadow: [
          "0 0 0 0 rgba(59, 130, 246, 0.4)",
          "0 0 0 10px rgba(59, 130, 246, 0.1)",
          "0 0 0 0 rgba(59, 130, 246, 0)"
        ]
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface GlowEffectProps {
  children: ReactNode;
  color?: string;
  className?: string;
}

export function GlowEffect({ 
  children, 
  color = "rgba(59, 130, 246, 0.3)", 
  className = "" 
}: GlowEffectProps) {
  return (
    <motion.div
      whileHover={{
        boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
        scale: 1.02
      }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}