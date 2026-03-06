import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ExternalLink, Loader2, Copy, Check } from "lucide-react";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";

export default function SurveyPage() {
  const [, params] = useRoute("/survey/:token");
  const token = params?.token || "";

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [hoveredCommRating, setHoveredCommRating] = useState(0);
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
        communicationRating: communicationRating || undefined,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
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
              <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-5 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-amber-900">
                    We'd love this on Google—just copy below and paste there, takes 30 seconds.
                  </p>
                </div>
                {feedback && (
                  <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
                    <p className="text-sm text-gray-700 italic leading-relaxed">"{feedback}"</p>
                  </div>
                )}
                {feedback && (
                  <Button
                    variant="outline"
                    className={`w-full border-2 transition-all ${copied ? "border-green-500 text-green-700 bg-green-50" : "border-amber-400 text-amber-800 hover:bg-amber-100"}`}
                    onClick={() => {
                      navigator.clipboard.writeText(feedback);
                      setCopied(true);
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Review
                      </>
                    )}
                  </Button>
                )}
                <Button
                  className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={feedback ? !copied : false}
                  onClick={() => {
                    window.open("https://www.google.com/search?q=Jepson+Myles+Studio+reviews", "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Paste review on Google
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mb-4">
            <img src={logoImage} alt="Jepson Myles Studio" className="h-16 mx-auto" />
          </div>
          <CardTitle className="text-2xl text-gray-900">How Was Your Experience?</CardTitle>
          <p className="text-gray-500 mt-2">
            Hi {(survey as any).clientName}, we'd love to hear your feedback!
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Quality of work</label>
            <p className="text-xs text-gray-500">How would you rate the quality of your photos?</p>
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
            <label className="text-sm font-medium text-gray-700">Communication</label>
            <p className="text-xs text-gray-500">How was the communication with your retoucher?</p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setCommunicationRating(star)}
                  onMouseEnter={() => setHoveredCommRating(star)}
                  onMouseLeave={() => setHoveredCommRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= (hoveredCommRating || communicationRating)
                        ? "fill-blue-400 text-blue-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {communicationRating > 0 && (
              <p className="text-center text-sm text-gray-500">
                {communicationRating === 1 && "Poor"}
                {communicationRating === 2 && "Fair"}
                {communicationRating === 3 && "Good"}
                {communicationRating === 4 && "Great"}
                {communicationRating === 5 && "Excellent!"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Tell us more about your experience (optional)
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What did you love? What could we improve?"
              rows={4}
            />
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
                className={wouldRecommend === true ? "bg-green-600 hover:bg-green-700" : ""}
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
            disabled={rating === 0 || submitMutation.isPending}
            className="w-full bg-pink-600 hover:bg-pink-700"
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
              Failed to submit. Please try again.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
