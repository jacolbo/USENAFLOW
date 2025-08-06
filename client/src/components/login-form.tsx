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
import logoImage from "@assets/ChatGPT Image Aug 7, 2025 at 01_05_33 AM_1754521723298.png";
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
    <div className="luxury-login-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img 
              src={logoImage} 
              alt="USENA FLOW" 
              className="h-20 luxury-logo"
            />
          </div>
          <p className="mt-3 text-sm luxury-text-gold font-medium tracking-wide">by Jepson Myles Studio</p>
          <p className="mt-2 text-sm luxury-text-secondary">
            Sign in to your account to continue
          </p>
        </div>

        <div className="mt-8 luxury-login-card rounded-xl p-8">
          <div className="mb-8 text-center">
            <h2 className="luxury-heading text-2xl font-semibold tracking-wide">Sign In</h2>
            <div className="mt-2 h-px bg-gradient-to-r from-transparent via-yellow-600 to-transparent opacity-30"></div>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="luxury-error p-4 rounded-lg flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <Label htmlFor="username" className="luxury-text-primary text-sm font-medium block mb-2">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                {...register("username")}
                placeholder="Enter your username"
                disabled={isLoading}
                className="luxury-input h-12 rounded-lg px-4 text-base w-full"
              />
              {errors.username && (
                <p className="luxury-error text-sm mt-2 px-3 py-2 rounded-md">{errors.username.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="password" className="luxury-text-primary text-sm font-medium block mb-2">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
                placeholder="Enter your password"
                disabled={isLoading}
                className="luxury-input h-12 rounded-lg px-4 text-base w-full"
              />
              {errors.password && (
                <p className="luxury-error text-sm mt-2 px-3 py-2 rounded-md">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="luxury-button w-full h-12 rounded-lg text-base font-medium tracking-wide"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center mt-6">
              <button 
                type="button" 
                className="luxury-text-gold text-sm hover:underline transition-all duration-300"
              >
                Forgot your password?
              </button>
            </div>

            <div className="text-center mt-4">
              <Button
                type="button"
                onClick={triggerNoFriendsAnimation}
                className="luxury-button w-full h-12 rounded-lg text-base font-medium tracking-wide opacity-75 hover:opacity-100"
                disabled={showAnimation}
              >
                Register Here
              </Button>
            </div>
          </form>

          {/* Animation Display */}
          {showAnimation && (
            <div className="mt-6 p-6 bg-gradient-to-r from-yellow-900/20 to-yellow-800/20 border border-yellow-700/30 rounded-lg backdrop-blur-sm">
              <div className="text-center">
                <p className="luxury-animation-text text-xl font-semibold min-h-[1.5rem] tracking-wide">
                  {animationText}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}