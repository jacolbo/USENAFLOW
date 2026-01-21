import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Package, Camera, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";

export default function ApproveExtras() {
  const { token } = useParams();
  const [isApproved, setIsApproved] = useState(false);

  const { data, isLoading, error } = useQuery<{
    projectName: string;
    packageCount: number;
    selectedCount: number;
    extras: number;
    extrasApproved: boolean;
  }>({
    queryKey: ['/api/approve-extras', token],
    enabled: !!token,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/approve-extras/${token}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve extras');
      }
      return response.json();
    },
    onSuccess: () => {
      setIsApproved(true);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

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
              This approval link is invalid or has expired. Please contact Jepson Myles Studio for assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data.extrasApproved || isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Extras Approved!</CardTitle>
            <CardDescription className="text-base mt-2">
              Thank you for approving the extra photos for <strong>{data.projectName}</strong>.
              Our team will begin retouching them right away.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-green-800 font-medium">
                {data.extras} extra photo{data.extras !== 1 ? 's' : ''} approved
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center">
            <Camera className="h-8 w-8 text-pink-600" />
          </div>
          <CardTitle>Extra Photos Approval</CardTitle>
          <CardDescription className="text-base mt-2">
            Review and approve additional photos for <strong>{data.projectName}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-gray-600">
                <Package className="h-4 w-4" />
                <span>Package Photos</span>
              </div>
              <span className="font-semibold">{data.packageCount}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-gray-600">
                <Camera className="h-4 w-4" />
                <span>Photos Selected</span>
              </div>
              <span className="font-semibold">{data.selectedCount}</span>
            </div>
            
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-orange-600 font-medium">Extra Photos</span>
                <span className="text-orange-600 font-bold text-lg">+{data.extras}</span>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 text-center">
            By approving, you confirm that you want these extra photos retouched as part of your order.
          </p>
        </CardContent>
        
        <CardFooter>
          <Button 
            className="w-full bg-pink-600 hover:bg-pink-700"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Extra Photos
              </>
            )}
          </Button>
        </CardFooter>
        
        {approveMutation.error && (
          <div className="px-6 pb-4">
            <p className="text-sm text-red-600 text-center">
              {approveMutation.error.message}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
