import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Loader2, ExternalLink } from "lucide-react";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";

const LINKTREE_URL = "https://linktr.ee/jepsonmyles.photography";

export default function ReferralPage() {
  const [, params] = useRoute("/refer/:code");
  const code = params?.code || "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: referral, isLoading, error } = useQuery({
    queryKey: ["/api/referral", code],
    enabled: !!code,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/referral/${code}/submit`, {
        firstName,
        lastName,
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
            <h2 className="text-2xl font-bold text-gray-900">Thank You, {firstName}!</h2>
            <p className="text-gray-600">
              We're so glad {(referral as any).referrerName} told you about us. 
              We can't wait to capture your special moments!
            </p>
            <p className="text-gray-500 text-sm">
              When you're ready to book, check out our services below.
            </p>
            <Button
              asChild
              className="w-full bg-pink-600 hover:bg-pink-700 mt-4"
            >
              <a href={LINKTREE_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Our Services
              </a>
            </Button>
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
            We'd love to capture your special moments. Enter your name below so we can keep track of your referral.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">First Name</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Last Name</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!firstName.trim() || !lastName.trim() || submitMutation.isPending}
            className="w-full bg-pink-600 hover:bg-pink-700"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit"
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
