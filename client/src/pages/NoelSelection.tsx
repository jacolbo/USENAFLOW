import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  ExternalLink,
  AlertCircle,
  Loader2,
  Camera,
  MessageCircle,
  Package,
} from "lucide-react";
import { useState } from "react";

interface SelectionData {
  clientName: string;
  selectionAllowance: number;
  pixiesetLink: string | null;
  extraPhotoPrice: number;
  whatsappAdminNumber: string;
  clientSelectionCount: number | null;
  clientSelectionDoneAt: string | null;
}

export default function NoelSelection() {
  const { token } = useParams();
  const [photoCount, setPhotoCount] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<SelectionData>({
    queryKey: ["/api/noel-selection", token],
    queryFn: async () => {
      const res = await fetch(`/api/noel-selection/${token}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to load");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const submitMutation = useMutation({
    mutationFn: async (count: number) => {
      const res = await fetch(`/api/noel-selection/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientSelectionCount: count }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
  });

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-green-700" />
          <span className="text-gray-600">Loading your gallery…</span>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Invalid Link</CardTitle>
            <CardDescription>
              This link is invalid or has expired. Please contact Jepson Myles Studio for assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const firstName = data.clientName.split(" ")[0];
  const allowance = data.selectionAllowance;
  const pricePerExtra = data.extraPhotoPrice ?? 0;
  const countNum = parseInt(photoCount, 10);
  const isValidCount = !isNaN(countNum) && countNum >= 0;
  const extras = isValidCount ? Math.max(0, countNum - allowance) : 0;
  const extrasTotal = extras * pricePerExtra;
  const isWithin = isValidCount && countNum <= allowance;
  const isOver = isValidCount && countNum > allowance;

  // Already submitted (from server or this session)
  const alreadyDone = submitted || !!data.clientSelectionDoneAt;
  const finalCount = submitted ? parseInt(photoCount, 10) : data.clientSelectionCount;
  const finalExtras = finalCount != null ? Math.max(0, finalCount - allowance) : 0;
  const finalTotal = finalExtras * pricePerExtra;

  // Build WhatsApp message after submission
  const buildWaUrl = (count: number) => {
    const extCount = Math.max(0, count - allowance);
    const total = extCount * pricePerExtra;
    const msg = extCount > 0
      ? `Hi, I have selected ${count} photos for my Noël shoot. I have ${extCount} extra photo(s), total extras: R${total}.`
      : `Hi, I have selected ${count} photos for my Noël shoot. All within my package.`;
    const clean = data.whatsappAdminNumber.replace(/\D/g, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  };

  // ── Already submitted state ──────────────────────────────────────────────────
  if (alreadyDone && finalCount != null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-green-700">Selection received!</CardTitle>
            <CardDescription className="text-base mt-2">
              Thank you, <strong>{firstName}</strong>! You've selected <strong>{finalCount}</strong> photo
              {finalCount !== 1 ? "s" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Photos selected</span>
                <span className="font-semibold">{finalCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Package allowance</span>
                <span className="font-semibold">{allowance}</span>
              </div>
              {finalExtras > 0 && (
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-orange-600 font-medium">Extra photos × R{pricePerExtra}</span>
                  <span className="text-orange-600 font-bold">R{finalTotal}</span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 text-center">
              We'll be in touch once your gallery is ready.
            </p>

            <a
              href={buildWaUrl(finalCount)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25d366] hover:bg-[#1fba5a] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              Notify studio via WhatsApp
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main selection page ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-start justify-center pt-12">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
            <Camera className="h-7 w-7 text-green-700" />
          </div>
          <CardTitle className="text-xl">Hi {firstName}! 🎄</CardTitle>
          <CardDescription className="text-base mt-1">
            Your Noël Set gallery is ready. Browse your photos and let us know how many you've selected.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-4">
          {/* Pixieset gallery button */}
          {data.pixiesetLink ? (
            <a
              href={data.pixiesetLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-black hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open Your Gallery
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full bg-gray-200 text-gray-500 font-semibold py-3 px-4 rounded-lg cursor-not-allowed">
              <ExternalLink className="h-4 w-4" />
              Gallery link coming soon
            </div>
          )}

          {/* Package info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Your Package</span>
            </div>
            <p className="text-sm text-blue-700">
              Your package includes <strong>{allowance}</strong> retouched photo{allowance !== 1 ? "s" : ""}.
              {pricePerExtra > 0 && (
                <> Additional photos are R{pricePerExtra} each.</>
              )}
            </p>
          </div>

          {/* Selection instructions */}
          <div className="text-sm text-gray-600 space-y-1">
            <p className="font-medium text-gray-800">How to select:</p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>Open your gallery using the button above.</li>
              <li>Browse and favourite the photos you love.</li>
              <li>Come back here and enter the total number you selected below.</li>
              <li>Tap <strong>Done</strong> — we'll take it from there!</li>
            </ol>
          </div>

          {/* Count input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800 block">
              How many photos did you select?
            </label>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 25"
              value={photoCount}
              onChange={(e) => setPhotoCount(e.target.value)}
              className="text-lg h-12"
            />

            {/* Live feedback */}
            {isValidCount && (
              <div
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  isWithin
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-orange-50 text-orange-700 border border-orange-200"
                }`}
              >
                {isWithin ? (
                  <span>✓ Within your package ({countNum} / {allowance})</span>
                ) : (
                  <span>
                    {extras} extra photo{extras !== 1 ? "s" : ""} × R{pricePerExtra} = <strong>R{extrasTotal}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submit button */}
          <Button
            className="w-full h-12 bg-green-700 hover:bg-green-800 text-white text-base font-semibold"
            disabled={!isValidCount || submitMutation.isPending}
            onClick={() => isValidCount && submitMutation.mutate(countNum)}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Done — I've finished selecting
              </>
            )}
          </Button>

          {submitMutation.error && (
            <p className="text-sm text-red-600 text-center">
              {(submitMutation.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
