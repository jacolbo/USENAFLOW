import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "@/lib/types";
import { AlertCircle } from "lucide-react";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface UserCredentials {
  id: string;
  username: string;
  password: string;
  name: string;
  role: string;
  abbreviation: string;
}

interface LoginFormProps {
  onLogin: (user: User) => void;
  onShowRegister: () => void;
  userCredentials: UserCredentials[];
}

export function LoginForm({ onLogin, onShowRegister, userCredentials }: LoginFormProps) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationText, setAnimationText] = useState("");
  const [currentIteration, setCurrentIteration] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const triggerNoFriendsAnimation = () => {
    setShowAnimation(true);
    setCurrentIteration(0);
    setAnimationText("");
  };

  useEffect(() => {
    if (!showAnimation) return;

    const fullText = "No new friends. No new friends. No, no, no.";
    
    const runTypewriter = (iteration: number) => {
      let currentText = "";
      let charIndex = 0;
      
      const typewriterInterval = setInterval(() => {
        if (charIndex < fullText.length) {
          currentText += fullText[charIndex];
          setAnimationText(currentText);
          charIndex++;
        } else {
          clearInterval(typewriterInterval);
          
          setTimeout(() => {
            if (iteration < 3) {
              setAnimationText("");
              setTimeout(() => runTypewriter(iteration + 1), 200);
            } else {
              setTimeout(() => {
                setShowAnimation(false);
                setAnimationText("");
                setCurrentIteration(0);
              }, 1500);
            }
          }, 800);
        }
      }, 50);
    };

    runTypewriter(1);
  }, [showAnimation]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    // Simulate a small delay for realistic login experience
    await new Promise(resolve => setTimeout(resolve, 500));

    const foundUser = userCredentials.find(
      u => u.username === data.username && u.password === data.password
    );

    if (foundUser) {
      const user: User = {
        id: foundUser.id || foundUser.username,
        name: foundUser.name,
        role: foundUser.role,
        value: foundUser.role === "Retoucher" ? `${foundUser.name}_${Date.now()}` : foundUser.role,
        abbr: foundUser.abbreviation
      };

      onLogin(user);
      toast({
        title: "Login Successful",
        description: `Welcome back, ${foundUser.name}!`,
      });
    } else {
      setError("Invalid username or password. Please try again.");
      toast({
        title: "Login Failed",
        description: "Invalid credentials provided.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={logoImage} 
              alt="USENA FLOW" 
              className="h-24"
            />
          </div>
          <p className="mt-1 text-sm text-gray-600">by Jepson Myles Studio</p>
          <p className="mt-1 text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Sign In</CardTitle>
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

              <Button
                type="submit"
                className="w-full bg-black hover:bg-gray-800 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <div className="text-center mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={triggerNoFriendsAnimation}
                  className="w-full"
                  disabled={showAnimation}
                >
                  Register Here
                </Button>
              </div>
            </form>

            {/* Animation Display */}
            {showAnimation && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="text-center">
                  <p className="text-lg font-bold text-red-800 min-h-[1.5rem] animate-pulse">
                    {animationText}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}