import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginSchema, type Login, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SecureLoginFormProps {
  onLogin: (user: User, token: string) => void;
}

export function SecureLoginForm({ onLogin }: SecureLoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<Login>({
    resolver: zodResolver(loginSchema)
  });

  const loginMutation = useMutation({
    mutationFn: async (data: Login) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Store token in localStorage
      localStorage.setItem('usenaflow_token', data.token);
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${data.user.name}!`,
      });
      
      onLogin(data.user, data.token);
    },
    onError: (error: Error) => {
      if (error.message.includes('Invalid username or password')) {
        setError('password', { message: 'Invalid username or password' });
      } else {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  });

  const onSubmit = (data: Login) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <LogIn className="h-6 w-6 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            USENA FLOW
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            by Jepson Myles Studio
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Sign in to access your workflow dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                {...register("username")}
                className="mt-1"
                data-testid="input-username"
              />
              {errors.username && (
                <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  className="pr-10"
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending}
            data-testid="button-login"
          >
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="text-center">
          <Alert>
            <AlertDescription>
              New users: Your temporary password is <strong>TempPass123!</strong>
              <br />
              You'll be required to change it after logging in.
              <br />
              <br />
              <strong>Admin credentials:</strong>
              <br />
              Username: admin | Password: rEx-sPort-1996
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}