import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, AlertCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().min(1, "Role is required"),
  abbreviation: z.string().min(1, "Abbreviation is required").max(4, "Abbreviation should be 4 characters or less"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface UserCredential {
  username: string;
  password: string;
  role: string;
  name: string;
  abbr: string;
  id?: string;
}

interface UserCredentials {
  id: string;
  username: string;
  password: string;
  name: string;
  role: string;
  abbreviation: string;
}

interface RegisterFormProps {
  onRegister: (user: UserCredential) => void;
  onBackToLogin: () => void;
  existingUsers: UserCredentials[];
}

export function RegisterForm({ onRegister, onBackToLogin, existingUsers }: RegisterFormProps) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    // Check if username already exists
    const existingUser = existingUsers.find(u => u.username === data.username);
    if (existingUser) {
      setError("Username already exists. Please choose a different username.");
      setIsLoading(false);
      return;
    }

    // Simulate a small delay for realistic registration experience
    await new Promise(resolve => setTimeout(resolve, 500));

    const newUser: UserCredential = {
      id: Date.now().toString(),
      username: data.username,
      password: data.password,
      name: data.username, // Use username as name for simplicity
      role: data.role,
      abbr: data.abbreviation
    };

    onRegister(newUser);
    
    toast({
      title: "Registration Successful",
      description: "Your account has been created successfully!",
    });

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Camera className="text-primary text-4xl mb-4" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">USENA FLOW</h2>
          <p className="mt-2 text-sm text-gray-600">by Jepson Myles Studio</p>
          <p className="mt-1 text-sm text-gray-600">
            Create your account to get started
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToLogin}
                className="flex items-center gap-1 p-0 h-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Button>
            </div>
            <CardTitle className="text-center">Register</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  {...register("username")}
                  placeholder="Enter your username"
                  className="mt-1"
                />
                {errors.username && (
                  <p className="text-sm text-red-600 mt-1">{errors.username.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="Enter your password"
                  className="mt-1"
                />
                {errors.password && (
                  <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select onValueChange={(value) => setValue("role", value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Retoucher">Retoucher</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="LeadRetoucher">Workflow Manager</SelectItem>
                    <SelectItem value="DataWrangler">Data Wrangler</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-red-600 mt-1">{errors.role.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="abbreviation">Abbreviation</Label>
                <Input
                  id="abbreviation"
                  type="text"
                  {...register("abbreviation")}
                  placeholder="e.g. LM, ASA"
                  maxLength={4}
                  className="mt-1"
                />
                {errors.abbreviation && (
                  <p className="text-sm text-red-600 mt-1">{errors.abbreviation.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Register"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}