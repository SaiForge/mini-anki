import React, { useState, useEffect } from "react";
import { Terminal, Lock, User as UserIcon, AtSign, AlignLeft, Image as ImageIcon, ArrowRight, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { Badge } from "./ui/Badge";
import { checkUsername } from "../api/authApi";

interface AuthViewProps {
  onLoginSuccess: (token: string) => void;
}

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup Wizard State
  const [signupStep, setSignupStep] = useState(1);
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    dob: "",
    gender: "",
    username: "",
    bio: "",
    profile_picture_url: "",
    role: ""
  });

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const handleSignupChange = (field: string, value: string) => {
    setSignupData(prev => ({ ...prev, [field]: value }));
  };

  // Debounced username check
  useEffect(() => {
    if (signupStep === 3 && signupData.username.length >= 3) {
      const timer = setTimeout(async () => {
        setCheckingUsername(true);
        try {
          const res = await checkUsername(signupData.username);
          setUsernameAvailable(res.available);
        } catch {
          setUsernameAvailable(false);
        } finally {
          setCheckingUsername(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else if (signupStep === 3) {
      setUsernameAvailable(null);
    }
  }, [signupData.username, signupStep]);

  const nextStep = () => {
    setError("");
    if (signupStep === 1) {
      if (!signupData.email || !signupData.password || signupData.password !== signupData.confirmPassword) {
        setError("[ ERROR: VALIDATION FAILED - Check Email/Passwords ]");
        return;
      }
    } else if (signupStep === 2) {
      if (!signupData.full_name || !signupData.dob || !signupData.gender) {
        setError("[ ERROR: ALL FIELDS REQUIRED ]");
        return;
      }
    } else if (signupStep === 3) {
      if (!signupData.username || signupData.username.length < 3) {
        setError("[ ERROR: USERNAME TOO SHORT ]");
        return;
      }
      if (usernameAvailable === false) {
        setError("[ ERROR: USERNAME TAKEN ]");
        return;
      }
    }
    setSignupStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError("");
    setSignupStep(prev => prev - 1);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      console.log("LOGIN: Trying to hit:", apiUrl);
      
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      console.log("LOGIN: Response status", response.status);
      
      const data = await response.json();
      console.log("LOGIN: Response data", data);
      
      if (!response.ok) {
        const msg = typeof data.detail === "string" ? data.detail : "Login failed - Invalid credentials";
        throw new Error(msg);
      }
      
      onLoginSuccess(data.access_token);
    } catch (err: any) {
      console.error("LOGIN ERROR CAUGHT:", err);
      const msg = typeof err.message === "string" ? err.message : "Network error";
      setError(`[ ERROR: ${msg.toUpperCase()} ]`);
    } finally {
      console.log("LOGIN: Finally block reached. Resetting loading state.");
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupData.email,
          password: signupData.password,
          username: signupData.username,
          full_name: signupData.full_name,
          bio: signupData.bio,
          profile_picture_url: signupData.profile_picture_url || null,
          gender: signupData.gender,
          dob: signupData.dob,
          role: signupData.role
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const msg = typeof data.detail === "string" ? data.detail : "Registration failed";
        throw new Error(msg);
      }
      
      // Auto login after signup
      const loginResp = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signupData.email, password: signupData.password })
      });
      const loginData = await loginResp.json();
      if (loginResp.ok) {
        onLoginSuccess(loginData.access_token);
      } else {
        setIsLogin(true);
      }
    } catch (err: any) {
      const msg = typeof err.message === "string" ? err.message : "Network error";
      setError(`[ ERROR: ${msg.toUpperCase()} ]`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg bg-primary-container border border-outline-variant shadow-md rounded-lg">
        
        {/* Inner Content Container */}
        <div className="p-4 md:p-6">
          
          <div className="flex justify-between items-center pb-3 border-b border-outline-variant mb-6">
            <h2 className="font-mono text-xs tracking-[0.2em] font-semibold uppercase text-on-surface-variant">
              {isLogin ? "AUTHENTICATION" : "REGISTRATION WIZARD"}
            </h2>
            <Badge variant="outline" className="border-outline-variant bg-surface-container-low text-on-surface-variant">
              SECURED
            </Badge>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">
              {isLogin ? "LOGIN" : "SIGN UP"}
            </h1>
          </div>

          {error && (
            <div className="mb-6 p-3 border border-outline-variant border-dashed bg-background text-center">
              <p className="font-mono text-xs text-primary uppercase tracking-wide">{error}</p>
            </div>
          )}

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4 max-w-sm mx-auto p-4">
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input 
                  type="email" 
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="hello@example.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input 
                  type="password" 
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="********"
                  required
                />
              </div>

              <div className="pt-4 mt-6 border-t border-outline-variant/30 flex justify-end items-center">
                <Button 
                  type="submit" 
                  disabled={loading}
                  variant="primary"
                  className="w-full"
                >
                  {loading ? "Logging In..." : "Log In"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 max-w-md mx-auto p-4">
              
              {/* STEP 1 */}
              {signupStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <Input 
                      type="email" 
                      value={signupData.email}
                      onChange={e => handleSignupChange("email", e.target.value)}
                      placeholder="user@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input 
                      type="password" 
                      value={signupData.password}
                      onChange={e => handleSignupChange("password", e.target.value)}
                      placeholder="Min 8 characters"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Confirm Password</Label>
                    <Input 
                      type="password" 
                      value={signupData.confirmPassword}
                      onChange={e => handleSignupChange("confirmPassword", e.target.value)}
                      placeholder="Verify match"
                      required
                    />
                  </div>

                  <div className="pt-4 mt-6 border-t border-outline-variant/30 flex justify-between items-center">
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Step 1 of 4</span>
                    <Button type="button" onClick={nextStep} variant="primary" className="gap-2">
                      Continue <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {signupStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input 
                      type="text" 
                      value={signupData.full_name}
                      onChange={e => handleSignupChange("full_name", e.target.value)}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Date of Birth</Label>
                      <Input 
                        type="date" 
                        value={signupData.dob}
                        onChange={e => handleSignupChange("dob", e.target.value)}
                        required
                        className="w-full"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label>Gender</Label>
                      <select
                        value={signupData.gender}
                        onChange={e => handleSignupChange("gender", e.target.value)}
                        required
                        className="w-full h-[42px] bg-background border border-outline-variant rounded-xs px-3 text-sm focus:outline-none focus:border-on-surface transition-colors font-mono"
                      >
                        <option value="" disabled>Select gender...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 mt-6 border-t border-outline-variant/30 flex justify-between items-center">
                    <Button type="button" onClick={prevStep} variant="ghost" className="gap-1.5 px-3">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Step 2 of 4</span>
                      <Button type="button" onClick={nextStep} variant="primary" className="gap-2">
                        Continue <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {signupStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <Label>Choose a unique Username</Label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                      <Input 
                        type="text" 
                        value={signupData.username}
                        onChange={e => handleSignupChange("username", e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        placeholder="developer_node"
                        className="pl-9 pr-10"
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingUsername ? (
                          <div className="w-4 h-4 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
                        ) : usernameAvailable === true ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : usernameAvailable === false ? (
                          <XCircle className="w-4 h-4 text-primary" />
                        ) : null}
                      </div>
                    </div>
                    <p className="text-[10px] font-mono text-on-surface-variant mt-1">
                      {usernameAvailable === false ? "Username is already taken." : "Letters, numbers, and underscores only."}
                    </p>
                  </div>

                  <div className="pt-4 mt-6 border-t border-outline-variant/30 flex justify-between items-center">
                    <Button type="button" onClick={prevStep} variant="ghost" className="gap-1.5 px-3">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Step 3 of 4</span>
                      <Button 
                        type="button" 
                        onClick={nextStep} 
                        variant="primary" 
                        className="gap-2"
                        disabled={!usernameAvailable || checkingUsername}
                      >
                        Continue <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {signupStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <Label>Primary Role</Label>
                    <select
                      value={signupData.role}
                      onChange={e => handleSignupChange("role", e.target.value)}
                      className="w-full h-[42px] bg-background border border-outline-variant rounded-xs px-3 text-sm focus:outline-none focus:border-on-surface transition-colors font-mono"
                    >
                      <option value="" disabled>Select your primary role...</option>
                      <option value="Student">Student</option>
                      <option value="Software Engineer">Software Engineer</option>
                      <option value="Data Scientist">Data Scientist</option>
                      <option value="Designer">Designer</option>
                      <option value="Educator">Educator</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Short Bio</Label>
                    <textarea 
                      value={signupData.bio}
                      onChange={e => handleSignupChange("bio", e.target.value)}
                      className="w-full bg-primary-container border border-outline-variant rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-on-surface transition-colors font-mono placeholder:text-on-surface-variant/50 min-h-[60px]"
                      placeholder="Passionate learner..."
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label>Avatar URL (Optional)</Label>
                    <Input 
                      type="url" 
                      value={signupData.profile_picture_url}
                      onChange={e => handleSignupChange("profile_picture_url", e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>

                  <div className="pt-4 mt-6 border-t border-outline-variant/30 flex justify-between items-center">
                    <Button type="button" onClick={prevStep} variant="ghost" className="gap-1.5 px-3">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Step 4 of 4</span>
                      <Button 
                        type="submit" 
                        disabled={loading}
                        variant="primary"
                      >
                        {loading ? "Signing Up..." : "Complete Sign Up"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-outline-variant text-center">
            <Button 
              variant="ghost" 
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setSignupStep(1);
              }}
              className="text-[11px] font-mono tracking-wider hover:bg-surface-container-low"
            >
              {isLogin ? "Switch to Registration" : "Switch to Log In"}
            </Button>
          </div>

          <div className="mt-4 font-mono text-[10px] text-on-surface-variant/50 flex justify-center gap-3">
            <span>#auth</span>
            <span>#security</span>
            <span>#system</span>
          </div>

        </div>
      </div>
    </div>
  );
}
