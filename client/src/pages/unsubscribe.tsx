import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "confirming" | "success" | "error">("confirming");
  const [errorMsg, setErrorMsg] = useState("");

  const handleUnsubscribe = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/rewards/unsubscribe?token=${encodeURIComponent(token || "")}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unsubscribe");
      }
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="p-8 text-center">
          {status === "confirming" && (
            <>
              <div className="text-4xl mb-4">📧</div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Unsubscribe</h1>
              <p className="text-gray-600 mb-6">
                Are you sure you want to unsubscribe? Your email address will be removed from our mailing list.
              </p>
              <Button
                onClick={handleUnsubscribe}
                className="bg-red-600 hover:bg-red-700 text-white w-full"
              >
                Yes, Unsubscribe Me
              </Button>
              <p className="text-xs text-gray-400 mt-4">Jepson Myles Studio</p>
            </>
          )}

          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Processing your request...</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 mb-2">Unsubscribed</h1>
              <p className="text-gray-600">
                Your email has been removed. You will no longer receive promotional emails from us.
              </p>
              <p className="text-xs text-gray-400 mt-6">Jepson Myles Studio</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
              <p className="text-gray-600 mb-4">{errorMsg || "We couldn't process your request. Please try again."}</p>
              <Button
                onClick={handleUnsubscribe}
                variant="outline"
              >
                Try Again
              </Button>
              <p className="text-xs text-gray-400 mt-6">Jepson Myles Studio</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
