import { Quote } from "lucide-react";
import { getCurrentDailyQuote } from "@/quotes/dailyQuotes";
import { Card, CardContent } from "@/components/ui/card";

interface DailyQuoteProps {
  userId: string;
  className?: string;
}

export function DailyQuote({ userId, className = "" }: DailyQuoteProps) {
  const quote = getCurrentDailyQuote(userId);

  return (
    <Card className={`bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Quote className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 leading-relaxed">
              {quote}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
              Daily Inspiration
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}