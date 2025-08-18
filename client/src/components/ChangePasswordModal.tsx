import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock } from "lucide-react";
import { changePasswordSchema, type ChangePassword } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mustChange?: boolean;
  onPasswordChanged?: () => void;
}

export function ChangePasswordModal({ 
  open, 
  onOpenChange, 
  mustChange = false,
  onPasswordChanged 
}: ChangePasswordModalProps) {
  const [showPasswords, setShowPasswords] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError
  } = useForm<ChangePassword>({
    resolver: zodResolver(changePasswordSchema)
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePassword) => {
      const token = localStorage.getItem('usenaflow_token');
      const response = await apiRequest("POST", "/api/auth/change-password", data, {
        'Authorization': `Bearer ${token}`
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change password');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully!",
      });
      reset();
      onOpenChange(false);
      onPasswordChanged?.();
    },
    onError: (error: Error) => {
      if (error.message.includes('current password')) {
        setError('currentPassword', { message: 'Current password is incorrect' });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  });

  const onSubmit = (data: ChangePassword) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={!mustChange ? onOpenChange : undefined}>
      <DialogContent className="sm:max-w-md" hideCloseButton={mustChange}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {mustChange ? "Password Change Required" : "Change Password"}
          </DialogTitle>
        </DialogHeader>

        {mustChange && (
          <Alert>
            <AlertDescription>
              You must change your password before continuing to use the application.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showPasswords ? "text" : "password"}
                {...register("currentPassword")}
                className="pr-10"
                data-testid="input-current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPasswords(!showPasswords)}
                data-testid="button-toggle-password-visibility"
              >
                {showPasswords ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-red-600">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type={showPasswords ? "text" : "password"}
              {...register("newPassword")}
              data-testid="input-new-password"
            />
            {errors.newPassword && (
              <p className="text-sm text-red-600">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type={showPasswords ? "text" : "password"}
              {...register("confirmPassword")}
              data-testid="input-confirm-password"
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="flex-1"
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            </Button>
            {!mustChange && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}