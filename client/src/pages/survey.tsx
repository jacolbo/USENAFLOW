import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ExternalLink, Loader2, Copy, Check } from "lucide-react";
import logoImage from "@assets/image_1778577290029.png";

function getFirstName(full: string): string {
  if (!full) return "";
  const cleaned = full.replace(/\([^)]*\)/g, "").trim();
  return cleaned.split(/\s+/)[0] || cleaned;
}

export default function SurveyPage() {
  const [, params] = useRoute("/survey/:token");
  const token = params?.token || "";

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showGoogleReview, setShowGoogleReview] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: survey, isLoading, error } = useQuery({
    queryKey: ["/api/survey", token],
    enabled: !!token,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/survey/${token}`, {
        rating,
        feedback,
        wouldRecommend,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setSubmitted(true);
      setShowGoogleReview(data.googleReviewPrompt === true);
    },
  });

  const firstName = getFirstName((survey as any)?.clientName || "");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf7f0] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#c9a961]" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-[#faf7f0] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500">Survey not found or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((survey as any).completedAt && !submitted) {
    return (
      <div className="min-h-screen bg-[#faf7f0] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mb-4">
              <img src={logoImage} alt="Jepson Myles Studio" className="h-16 mx-auto" />
            </div>
            <p className="text-gray-600 text-lg">Thank you! You've already completed this survey.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#faf7f0] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mb-4">
              <img src={logoImage} alt="Jepson Myles Studio" className="h-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
            <p className="text-gray-600">
              We truly appreciate your feedback. It helps us continue delivering the best experience possible.
            </p>
            {showGoogleReview && (
              <div className="mt-6 rounded-xl border border-[#e8dcc0] bg-white p-5 space-y-4 shadow-sm">
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-gray-800">
                    Would you mind sharing this on Google? It would mean the world to us.
                  </p>
                  <p className="text-xs text-gray-500">Takes 30 seconds.</p>
                </div>
                {feedback && (
                  <div className="bg-[#faf7f0] rounded-lg p-4 border-l-4 border-[#c9a961]">
                    <p className="text-sm text-gray-700 italic leading-relaxed">"{feedback}"</p>
                  </div>
                )}
                {feedback && (
                  <Button
                    variant="outline"
                    className={`w-full border-2 transition-all ${copied ? "border-[#4CAF7D] text-[#2f7f57] bg-[#eaf6ee]" : "border-[#4CAF7D] text-[#2f7f57] hover:bg-[#eaf6ee]"}`}
                    onClick={() => {
                      navigator.clipboard.writeText(feedback);
                      setCopied(true);
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy review
                      </>
                    )}
                  </Button>
                )}
                <Button
                  className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  onClick={() => {
                    window.location.href = `/r/google/${token}`;
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Leave Google review
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7f0] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mb-4">
            <img src={logoImage} alt="Jepson Myles Studio" className="h-16 mx-auto" />
          </div>
          <CardTitle className="text-2xl text-gray-900">How Was Your Experience?</CardTitle>
          <p className="text-gray-500 mt-2">
            Hi {firstName || "there"}, we'd love to hear your feedback!
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Rate our service</label>
            <p className="text-xs text-gray-500">How would you rate your overall experience with Jepson Myles Studio?</p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-gray-500">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Great"}
                {rating === 5 && "Excellent!"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Tell us more about your experience <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What did you love? What could we improve?"
              rows={4}
            />
            <p className="text-xs text-gray-500">
              Please share a few words about your experience — it's required.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Would you recommend us to friends or family?
            </label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={wouldRecommend === true ? "default" : "outline"}
                onClick={() => setWouldRecommend(true)}
                className={wouldRecommend === true ? "bg-[#4CAF7D] hover:bg-[#3f9669]" : ""}
              >
                Yes, definitely!
              </Button>
              <Button
                type="button"
                variant={wouldRecommend === false ? "default" : "outline"}
                onClick={() => setWouldRecommend(false)}
                className={wouldRecommend === false ? "bg-gray-600 hover:bg-gray-700" : ""}
              >
                Not right now
              </Button>
            </div>
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={rating === 0 || feedback.trim().length < 3 || submitMutation.isPending}
            className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>

          {submitMutation.isError && (
            <p className="text-red-500 text-sm text-center">
              {(() => {
                const raw = (submitMutation.error as Error)?.message || "";
                const body = raw.replace(/^\d+:\s*/, "");
                try {
                  const parsed = JSON.parse(body);
                  if (parsed?.error) return parsed.error;
                } catch {}
                return "Failed to submit. Please try again.";
              })()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
