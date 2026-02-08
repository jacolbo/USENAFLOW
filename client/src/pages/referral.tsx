import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Loader2 } from "lucide-react";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";

export default function ReferralPage() {
  const [, params] = useRoute("/refer/:code");
  const code = params?.code || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: referral, isLoading, error } = useQuery({
    queryKey: ["/api/referral", code],
    enabled: !!code,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/referral/${code}/submit`, {
        name,
        email,
        interest,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  if (error || !referral) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500">This referral link is not valid.</p>
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
            <Heart className="h-12 w-12 text-pink-500 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
            <p className="text-gray-600">
              We've received your details and will be in touch soon. We can't wait to work with you!
            </p>
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
          <div className="flex items-center justify-center gap-2 mb-2">
            <Heart className="h-5 w-5 text-pink-500" />
            <span className="text-pink-600 font-medium">Referral</span>
          </div>
          <CardTitle className="text-2xl text-gray-900">
            You've been referred by {(referral as any).referrerName}!
          </CardTitle>
          <p className="text-gray-500 mt-2">
            We'd love to capture your special moments. Fill in your details and we'll get in touch.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Your Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Your Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              What are you interested in? (optional)
            </label>
            <Textarea
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="e.g., Portrait session, Wedding, Family photos..."
              rows={3}
            />
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!name || !email || submitMutation.isPending}
            className="w-full bg-pink-600 hover:bg-pink-700"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Get in Touch"
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
