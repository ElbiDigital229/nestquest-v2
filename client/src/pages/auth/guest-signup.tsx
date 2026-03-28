import { useState, useRef, useMemo, useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { slugToRole, ROLE_LABELS } from "@/lib/role-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import {
  Home,
  Loader2,
  User,
  Mail,
  FileText,
  Phone,
  CheckCircle2,
  Upload,
  ArrowLeft,
  ArrowRight,
  X,
  ImageIcon,
  Building2,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  "UAE", "Saudi Arabia", "Oman", "Bahrain", "Qatar", "Kuwait",
  "India", "Pakistan", "Philippines", "United Kingdom", "United States",
  "Canada", "Australia", "Germany", "France", "China", "Egypt",
  "Jordan", "Lebanon", "South Africa", "Nigeria", "Kenya", "Brazil",
  "Russia", "Japan", "South Korea", "Turkey", "Iran", "Iraq", "Syria",
  "Yemen", "Afghanistan", "Bangladesh", "Sri Lanka", "Nepal",
  "Indonesia", "Malaysia", "Singapore", "Thailand", "Vietnam",
  "New Zealand", "Ireland", "Italy", "Spain", "Portugal", "Netherlands",
  "Belgium", "Sweden", "Norway", "Denmark", "Finland", "Switzerland",
  "Austria", "Poland", "Czech Republic", "Romania", "Hungary", "Greece",
  "Argentina", "Chile", "Colombia", "Mexico", "Peru",
];

const PHONE_CODES = [
  { code: "+971", label: "+971 (UAE)" },
  { code: "+966", label: "+966 (Saudi)" },
  { code: "+968", label: "+968 (Oman)" },
  { code: "+973", label: "+973 (Bahrain)" },
  { code: "+974", label: "+974 (Qatar)" },
  { code: "+965", label: "+965 (Kuwait)" },
  { code: "+91", label: "+91 (India)" },
  { code: "+92", label: "+92 (Pakistan)" },
  { code: "+63", label: "+63 (Philippines)" },
  { code: "+44", label: "+44 (UK)" },
  { code: "+1", label: "+1 (US/Canada)" },
  { code: "+61", label: "+61 (Australia)" },
  { code: "+49", label: "+49 (Germany)" },
  { code: "+33", label: "+33 (France)" },
  { code: "+86", label: "+86 (China)" },
  { code: "+20", label: "+20 (Egypt)" },
  { code: "+962", label: "+962 (Jordan)" },
  { code: "+961", label: "+961 (Lebanon)" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1 - Personal
  role: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  residentAddress: string;
  // Step 2 - Account
  email: string;
  phoneCode: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  // Company (PM only)
  companyName: string;
  companyWebsite: string;
  companyDescription: string;
  companyAddress: string;
  // Documents - Emirates ID
  idNumber: string;
  idExpiry: string;
  idFrontFile: File | null;
  idBackFile: File | null;
  idFrontUrl: string;
  idBackUrl: string;
  idFrontPreview: string;
  idBackPreview: string;
  // Documents - Passport
  passportNumber: string;
  passportExpiry: string;
  passportFrontFile: File | null;
  passportFrontUrl: string;
  passportFrontPreview: string;
  // Documents - Trade License
  tradeLicenseExpiry: string;
  tradeLicenseFile: File | null;
  tradeLicenseUrl: string;
  tradeLicensePreview: string;
  // OTP
  otp: string;
}

interface FieldErrors {
  [key: string]: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPasswordStrength(password: string): { level: "weak" | "medium" | "strong"; score: number } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { level: "weak", score };
  if (score <= 4) return { level: "medium", score };
  return { level: "strong", score };
}

function isAtLeast18(dateStr: string): boolean {
  const dob = new Date(dateStr);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    return age - 1 >= 18;
  }
  return age >= 18;
}

function isFutureDate(dateStr: string): boolean {
  return new Date(dateStr) > new Date();
}

// ─── File field mapping ──────────────────────────────────────────────────────

const fileFieldMap: Record<string, { urlField: string; previewField: string }> = {
  idFrontFile: { urlField: "idFrontUrl", previewField: "idFrontPreview" },
  idBackFile: { urlField: "idBackUrl", previewField: "idBackPreview" },
  passportFrontFile: { urlField: "passportFrontUrl", previewField: "passportFrontPreview" },
  tradeLicenseFile: { urlField: "tradeLicenseUrl", previewField: "tradeLicensePreview" },
};

type FileFieldKey = "idFrontFile" | "idBackFile" | "passportFrontFile" | "tradeLicenseFile";

// ─── Component ───────────────────────────────────────────────────────────────

export default function GuestSignup({ roleSlug }: { roleSlug: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const passportFrontRef = useRef<HTMLInputElement>(null);
  const tradeLicenseRef = useRef<HTMLInputElement>(null);

  const role = slugToRole(roleSlug) || "GUEST";
  const roleLabel = ROLE_LABELS[role] || role;
  const isPM = role === "PROPERTY_MANAGER";

  const STEPS = useMemo(
    () =>
      isPM
        ? [
            { label: "Personal", icon: User },
            { label: "Account", icon: Mail },
            { label: "Company", icon: Building2 },
            { label: "Documents", icon: FileText },
            { label: "Verify", icon: Phone },
            { label: "Plan", icon: Building2 },
            { label: "Complete", icon: CheckCircle2 },
          ]
        : [
            { label: "Personal", icon: User },
            { label: "Account", icon: Mail },
            { label: "Documents", icon: FileText },
            { label: "Verify", icon: Phone },
            { label: "Complete", icon: CheckCircle2 },
          ],
    [isPM]
  );

  const stepMap = isPM
    ? { personal: 0, account: 1, company: 2, documents: 3, verify: 4, choosePlan: 5, complete: 6 }
    : { personal: 0, account: 1, documents: 2, verify: 3, complete: 4 };

  const [form, setForm] = useState<FormData>({
    role,
    fullName: "",
    dateOfBirth: "",
    nationality: "",
    countryOfResidence: "",
    residentAddress: "",
    email: "",
    phoneCode: "+971",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    companyWebsite: "",
    companyDescription: "",
    companyAddress: "",
    idNumber: "",
    idExpiry: "",
    idFrontFile: null,
    idBackFile: null,
    idFrontUrl: "",
    idBackUrl: "",
    idFrontPreview: "",
    idBackPreview: "",
    passportNumber: "",
    passportExpiry: "",
    passportFrontFile: null,
    passportFrontUrl: "",
    passportFrontPreview: "",
    tradeLicenseExpiry: "",
    tradeLicenseFile: null,
    tradeLicenseUrl: "",
    tradeLicensePreview: "",
    otp: "",
  });

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  // Invalid role slug — redirect after all hooks
  if (!slugToRole(roleSlug)) {
    return <Redirect to="/" />;
  }

  const updateField = (field: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // ─── Validation ──────────────────────────────────────────────────────────

  const validateStep1 = (): boolean => {
    const errs: FieldErrors = {};

    if (!form.fullName.trim()) errs.fullName = "Full name is required";
    else if (form.fullName.trim().length < 2) errs.fullName = "Name must be at least 2 characters";

    if (!form.dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    else if (!isAtLeast18(form.dateOfBirth)) errs.dateOfBirth = "You must be at least 18 years old";

    if (!form.nationality) errs.nationality = "Nationality is required";
    if (!form.countryOfResidence) errs.countryOfResidence = "Country of residence is required";

    if (!form.residentAddress.trim()) errs.residentAddress = "Resident address is required";
    else if (form.residentAddress.trim().length < 10)
      errs.residentAddress = "Please enter a complete address (at least 10 characters)";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: FieldErrors = {};

    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Please enter a valid email";

    if (!form.phoneNumber.trim()) errs.phoneNumber = "Phone number is required";
    else if (!/^\d{7,15}$/.test(form.phoneNumber.replace(/\s/g, "")))
      errs.phoneNumber = "Please enter a valid phone number (7-15 digits)";

    if (!form.password) {
      errs.password = "Password is required";
    } else {
      const checks: string[] = [];
      if (form.password.length < 8) checks.push("at least 8 characters");
      if (!/[a-z]/.test(form.password)) checks.push("a lowercase letter");
      if (!/[A-Z]/.test(form.password)) checks.push("an uppercase letter");
      if (!/[0-9]/.test(form.password)) checks.push("a number");
      if (!/[^a-zA-Z0-9]/.test(form.password)) checks.push("a special character");
      if (checks.length > 0) errs.password = `Password must contain ${checks.join(", ")}`;
    }

    if (!form.confirmPassword) errs.confirmPassword = "Please confirm your password";
    else if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateCompanyStep = (): boolean => {
    const errs: FieldErrors = {};
    if (!form.companyName.trim()) errs.companyName = "Company name is required";
    if (!form.companyAddress.trim()) errs.companyAddress = "Company address is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: FieldErrors = {};

    if (isPM) {
      // PM: all documents required — Emirates ID + Passport + Trade License
      if (!form.idNumber.trim()) errs.idNumber = "Emirates ID number is required";
      else if (form.idNumber.trim().length < 5) errs.idNumber = "Please enter a valid ID number";

      if (!form.idExpiry) errs.idExpiry = "Emirates ID expiry date is required";
      else if (!isFutureDate(form.idExpiry)) errs.idExpiry = "ID must not be expired";

      if (!form.idFrontFile && !form.idFrontUrl) errs.idFrontFile = "Emirates ID front image is required";
      if (!form.idBackFile && !form.idBackUrl) errs.idBackFile = "Emirates ID back image is required";

      if (!form.passportNumber.trim()) errs.passportNumber = "Passport number is required";
      if (!form.passportExpiry) errs.passportExpiry = "Passport expiry date is required";
      else if (!isFutureDate(form.passportExpiry)) errs.passportExpiry = "Passport must not be expired";
      if (!form.passportFrontFile && !form.passportFrontUrl) errs.passportFrontFile = "Passport front copy is required";

      if (!form.tradeLicenseExpiry) errs.tradeLicenseExpiry = "Trade license expiry date is required";
      else if (!isFutureDate(form.tradeLicenseExpiry)) errs.tradeLicenseExpiry = "Trade license must not be expired";
      if (!form.tradeLicenseFile && !form.tradeLicenseUrl) errs.tradeLicenseFile = "Trade license copy is required";
    } else {
      // Others: Passport is mandatory, Emirates ID is optional
      if (!form.passportNumber.trim()) errs.passportNumber = "Passport number is required";
      else if (form.passportNumber.trim().length < 5) errs.passportNumber = "Please enter a valid passport number";
      if (!form.passportExpiry) errs.passportExpiry = "Passport expiry date is required";
      else if (!isFutureDate(form.passportExpiry)) errs.passportExpiry = "Passport must not be expired";
      if (!form.passportFrontFile && !form.passportFrontUrl) errs.passportFrontFile = "Passport copy is required";

      // Validate Emirates ID fields only if partially filled (optional)
      if (form.idNumber.trim() || form.idFrontFile || form.idFrontUrl || form.idBackFile || form.idBackUrl || form.idExpiry) {
        if (!form.idNumber.trim()) errs.idNumber = "Emirates ID number is required";
        else if (form.idNumber.trim().length < 5) errs.idNumber = "Please enter a valid ID number";
        if (!form.idExpiry) errs.idExpiry = "Emirates ID expiry date is required";
        else if (!isFutureDate(form.idExpiry)) errs.idExpiry = "ID must not be expired";
        if (!form.idFrontFile && !form.idFrontUrl) errs.idFrontFile = "ID front image is required";
        if (!form.idBackFile && !form.idBackUrl) errs.idBackFile = "ID back image is required";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Step Navigation ────────────────────────────────────────────────────

  const handleNext = async () => {
    if (step === stepMap.personal && !validateStep1()) return;
    if (step === stepMap.account && !validateStep2()) return;
    if (isPM && step === stepMap.company && !validateCompanyStep()) return;
    if (step === stepMap.documents && !validateStep3()) return;

    if (step === stepMap.documents) {
      // After documents, send OTP
      setIsLoading(true);
      try {
        const phone = `${form.phoneCode}${form.phoneNumber.replace(/\s/g, "")}`;
        await api.post("/auth/send-signup-otp", { phone, email: form.email });
        toast({ title: "OTP sent to your phone" });
        setStep(stepMap.verify);
      } catch (error: any) {
        toast({ title: error.message || "Failed to send OTP", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (step === stepMap.verify) {
      // Verify OTP then submit signup
      if (form.otp.length !== 6) {
        setErrors({ otp: "Please enter the 6-digit OTP code" });
        return;
      }
      setIsLoading(true);
      try {
        const phone = `${form.phoneCode}${form.phoneNumber.replace(/\s/g, "")}`;

        // Verify OTP first
        await api.post("/auth/verify-signup-otp", { phone, otp: form.otp });

        // Submit full signup with real upload URLs
        await api.post("/auth/signup", {
          email: form.email,
          password: form.password,
          phone,
          fullName: form.fullName.trim(),
          dob: form.dateOfBirth,
          nationality: form.nationality,
          countryOfResidence: form.countryOfResidence,
          residentAddress: form.residentAddress.trim(),
          emiratesIdNumber: form.idNumber.trim() || undefined,
          emiratesIdExpiry: form.idExpiry || undefined,
          emiratesIdFrontUrl: form.idFrontUrl || undefined,
          emiratesIdBackUrl: form.idBackUrl || undefined,
          role: form.role,
          // Company info (PM only)
          ...(isPM && {
            companyName: form.companyName.trim(),
            companyWebsite: form.companyWebsite.trim(),
            companyDescription: form.companyDescription.trim(),
            companyAddress: form.companyAddress.trim(),
          }),
          // Passport
          passportNumber: form.passportNumber.trim() || undefined,
          passportExpiry: form.passportExpiry || undefined,
          passportFrontUrl: form.passportFrontUrl || undefined,
          // Trade License (PM only)
          ...(isPM && {
            tradeLicenseExpiry: form.tradeLicenseExpiry || undefined,
            tradeLicenseUrl: form.tradeLicenseUrl || undefined,
          }),
        });

        toast({ title: "Account created successfully!" });

        // For PM: auto-login and go to plan selection step
        if (isPM) {
          try {
            await api.post("/auth/login", { email: form.email, password: form.password, role: form.role });
          } catch {
            // If auto-login fails, still proceed — they can login manually later
          }
          setStep((stepMap as any).choosePlan);
        } else {
          setStep(stepMap.complete);
        }
      } catch (error: any) {
        let msg = error.message || "Signup failed";
        if (error.details) {
          const fieldErrors = Object.entries(error.details)
            .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
            .join("; ");
          msg = `Validation failed — ${fieldErrors}`;
        }
        toast({ title: msg, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setStep((s) => Math.min(s + 1, stepMap.complete));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (field: FileFieldKey, file: File | null) => {
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        [field]: "Only PNG, JPG, and JPEG files are allowed",
      }));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({
        ...prev,
        [field]: `File size must not exceed 5MB (yours: ${formatFileSize(file.size)})`,
      }));
      return;
    }

    const mapping = fileFieldMap[field];
    if (!mapping) return;
    const { urlField, previewField } = mapping;

    // Create preview URL immediately
    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      [field]: file,
      [previewField]: previewUrl,
      [urlField]: "", // clear while uploading
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

    // Upload file to server
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error);
      }
      const data = await res.json();
      setForm((prev) => ({ ...prev, [urlField]: data.url }));
    } catch (error: any) {
      setErrors((prev) => ({
        ...prev,
        [field]: error.message || "Failed to upload file",
      }));
      // Clear the file on upload failure
      setForm((prev) => ({
        ...prev,
        [field]: null,
        [urlField]: "",
        [previewField]: "",
      }));
    }
  };

  const fileRefMap: Record<string, React.RefObject<HTMLInputElement>> = {
    idFrontFile: idFrontRef,
    idBackFile: idBackRef,
    passportFrontFile: passportFrontRef,
    tradeLicenseFile: tradeLicenseRef,
  };

  const removeFile = (field: FileFieldKey) => {
    const mapping = fileFieldMap[field];
    if (!mapping) return;
    const { urlField, previewField } = mapping;
    const ref = fileRefMap[field];

    // Revoke the preview URL to free memory
    if (form[previewField as keyof FormData]) {
      URL.revokeObjectURL(form[previewField as keyof FormData] as string);
    }

    setForm((prev) => ({
      ...prev,
      [field]: null,
      [urlField]: "",
      [previewField]: "",
    }));

    // Reset file input
    if (ref?.current) ref.current.value = "";
  };

  // ─── Step Progress Indicator ─────────────────────────────────────────────

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((s, i) => {
        const isCompleted = i < step;
        const isCurrent = i === step;
        return (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <s.icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-1.5 font-medium",
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-1 mt-[-18px]",
                  i < step ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── Render Steps ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <>
      <CardHeader>
        <CardTitle>Personal Details</CardTitle>
        <CardDescription>Create your {roleLabel.toLowerCase()} account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            placeholder="Enter your full name"
            value={form.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
          />
          {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => updateField("dateOfBirth", e.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
          {errors.dateOfBirth && <p className="text-sm text-destructive">{errors.dateOfBirth}</p>}
        </div>

        {/* Nationality */}
        <div className="space-y-2">
          <Label>Nationality *</Label>
          <Select value={form.nationality} onValueChange={(v) => updateField("nationality", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select nationality" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.nationality && <p className="text-sm text-destructive">{errors.nationality}</p>}
        </div>

        {/* Country of Residence */}
        <div className="space-y-2">
          <Label>Country of Residence *</Label>
          <Select
            value={form.countryOfResidence}
            onValueChange={(v) => updateField("countryOfResidence", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country of residence" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.countryOfResidence && (
            <p className="text-sm text-destructive">{errors.countryOfResidence}</p>
          )}
        </div>

        {/* Resident Address */}
        <div className="space-y-2">
          <Label htmlFor="residentAddress">Resident Address *</Label>
          <Textarea
            id="residentAddress"
            placeholder="Enter your full residential address"
            rows={3}
            value={form.residentAddress}
            onChange={(e) => updateField("residentAddress", e.target.value)}
          />
          {errors.residentAddress && (
            <p className="text-sm text-destructive">{errors.residentAddress}</p>
          )}
        </div>
      </CardContent>
    </>
  );

  const renderStep2 = () => (
    <>
      <CardHeader>
        <CardTitle>Account Details</CardTitle>
        <CardDescription>Set up your login credentials</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label>Phone Number *</Label>
          <div className="flex gap-2">
            <Select value={form.phoneCode} onValueChange={(v) => updateField("phoneCode", v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHONE_CODES.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Phone number"
              value={form.phoneNumber}
              onChange={(e) => updateField("phoneNumber", e.target.value.replace(/[^0-9\s]/g, ""))}
              className="flex-1"
            />
          </div>
          {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber}</p>}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <PasswordInput
            id="password"
            placeholder="Create a strong password"
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
          />
          {form.password && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                <div
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    passwordStrength.score >= 1
                      ? passwordStrength.level === "weak"
                        ? "bg-destructive"
                        : passwordStrength.level === "medium"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                      : "bg-muted"
                  )}
                />
                <div
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    passwordStrength.score >= 3
                      ? passwordStrength.level === "medium"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                      : "bg-muted"
                  )}
                />
                <div
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    passwordStrength.level === "strong" ? "bg-green-500" : "bg-muted"
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-xs font-medium",
                  passwordStrength.level === "weak"
                    ? "text-destructive"
                    : passwordStrength.level === "medium"
                    ? "text-yellow-600"
                    : "text-green-600"
                )}
              >
                {passwordStrength.level === "weak"
                  ? "Weak password"
                  : passwordStrength.level === "medium"
                  ? "Medium strength"
                  : "Strong password"}
              </p>
            </div>
          )}
          <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
            <li className={cn(form.password.length >= 8 && "text-green-600")}>
              {form.password.length >= 8 ? "\u2713" : "\u2022"} At least 8 characters
            </li>
            <li className={cn(/[a-z]/.test(form.password) && "text-green-600")}>
              {/[a-z]/.test(form.password) ? "\u2713" : "\u2022"} One lowercase letter
            </li>
            <li className={cn(/[A-Z]/.test(form.password) && "text-green-600")}>
              {/[A-Z]/.test(form.password) ? "\u2713" : "\u2022"} One uppercase letter
            </li>
            <li className={cn(/[0-9]/.test(form.password) && "text-green-600")}>
              {/[0-9]/.test(form.password) ? "\u2713" : "\u2022"} One number
            </li>
            <li className={cn(/[^a-zA-Z0-9]/.test(form.password) && "text-green-600")}>
              {/[^a-zA-Z0-9]/.test(form.password) ? "\u2713" : "\u2022"} One special character
            </li>
          </ul>
          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password *</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword}</p>
          )}
        </div>
      </CardContent>
    </>
  );

  const renderCompanyStep = () => (
    <>
      <CardHeader>
        <CardTitle>Company Information</CardTitle>
        <CardDescription>Tell us about your property management company</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            placeholder="Enter company name"
            value={form.companyName}
            onChange={(e) => updateField("companyName", e.target.value)}
          />
          {errors.companyName && <p className="text-sm text-destructive">{errors.companyName}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyWebsite">Company Website</Label>
          <Input
            id="companyWebsite"
            type="url"
            placeholder="https://example.com"
            value={form.companyWebsite}
            onChange={(e) => updateField("companyWebsite", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyDescription">Company Description</Label>
          <Textarea
            id="companyDescription"
            placeholder="Brief description of your company"
            rows={3}
            value={form.companyDescription}
            onChange={(e) => updateField("companyDescription", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyAddress">Company Address *</Label>
          <Textarea
            id="companyAddress"
            placeholder="Enter company address"
            rows={2}
            value={form.companyAddress}
            onChange={(e) => updateField("companyAddress", e.target.value)}
          />
          {errors.companyAddress && <p className="text-sm text-destructive">{errors.companyAddress}</p>}
        </div>
      </CardContent>
    </>
  );

  const renderUploadArea = (
    field: FileFieldKey,
    label: string,
    ref: React.RefObject<HTMLInputElement>
  ) => {
    const file = form[field as keyof FormData] as File | null;
    const mapping = fileFieldMap[field];
    if (!mapping) return null;
    const previewUrl = form[mapping.previewField as keyof FormData] as string;

    return (
      <div className="space-y-2">
        <Label>{label} *</Label>
        <input
          ref={ref}
          type="file"
          accept=".png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => handleFileSelect(field, e.target.files?.[0] || null)}
        />

        {file && previewUrl ? (
          /* ── Uploaded state with preview ── */
          <div className="border-2 border-green-500 rounded-lg overflow-hidden bg-green-50/50">
            {/* Image preview */}
            <div className="relative bg-muted/30">
              <img
                src={previewUrl}
                alt={label}
                className="w-full h-48 object-contain"
              />
              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(field);
                }}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* File info */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-green-200">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm font-medium text-green-700 truncate">{file.name}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {formatFileSize(file.size)}
              </span>
            </div>
          </div>
        ) : (
          /* ── Empty upload state ── */
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
              errors[field] ? "border-destructive/50 bg-destructive/5" : "border-muted-foreground/25"
            )}
            onClick={() => ref.current?.click()}
          >
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Click to upload</p>
                <p className="text-xs mt-1">or drag and drop your file here</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-0.5 rounded bg-muted font-medium">PNG</span>
                <span className="px-2 py-0.5 rounded bg-muted font-medium">JPG</span>
                <span className="px-2 py-0.5 rounded bg-muted font-medium">JPEG</span>
              </div>
              <p className="text-xs text-muted-foreground/70">Maximum file size: 5MB</p>
            </div>
          </div>
        )}
        {errors[field] && <p className="text-sm text-destructive">{errors[field]}</p>}
      </div>
    );
  };

  const renderStep3 = () => {
    if (isPM) {
      // Property Manager: all three document sections required
      return (
        <>
          <CardHeader>
            <CardTitle>Document Verification</CardTitle>
            <CardDescription>Upload your identification and company documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload requirements info */}
            <div className="rounded-lg bg-muted/50 border px-4 py-3">
              <div className="flex items-start gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Upload requirements</p>
                  <ul className="space-y-0.5">
                    <li>Accepted formats: <strong>PNG, JPG, JPEG</strong></li>
                    <li>Maximum file size: <strong>5MB</strong> per file</li>
                    <li>All documents are required for property managers</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Emirates ID Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Emirates ID</h3>
              <div className="space-y-2">
                <Label htmlFor="idNumber">Emirates ID Number *</Label>
                <Input
                  id="idNumber"
                  placeholder="Enter your Emirates ID number"
                  value={form.idNumber}
                  onChange={(e) => updateField("idNumber", e.target.value)}
                />
                {errors.idNumber && <p className="text-sm text-destructive">{errors.idNumber}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="idExpiry">Emirates ID Expiry Date *</Label>
                <Input
                  id="idExpiry"
                  type="date"
                  value={form.idExpiry}
                  onChange={(e) => updateField("idExpiry", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                {errors.idExpiry && <p className="text-sm text-destructive">{errors.idExpiry}</p>}
              </div>
              {renderUploadArea("idFrontFile", "Emirates ID Front Image", idFrontRef)}
              {renderUploadArea("idBackFile", "Emirates ID Back Image", idBackRef)}
            </div>

            {/* Passport Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Passport</h3>
              <div className="space-y-2">
                <Label htmlFor="passportNumber">Passport Number *</Label>
                <Input
                  id="passportNumber"
                  placeholder="Enter your passport number"
                  value={form.passportNumber}
                  onChange={(e) => updateField("passportNumber", e.target.value)}
                />
                {errors.passportNumber && <p className="text-sm text-destructive">{errors.passportNumber}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportExpiry">Passport Expiry Date *</Label>
                <Input
                  id="passportExpiry"
                  type="date"
                  value={form.passportExpiry}
                  onChange={(e) => updateField("passportExpiry", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                {errors.passportExpiry && <p className="text-sm text-destructive">{errors.passportExpiry}</p>}
              </div>
              {renderUploadArea("passportFrontFile", "Passport Front Copy", passportFrontRef)}
            </div>

            {/* Trade License Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Trade License</h3>
              <div className="space-y-2">
                <Label htmlFor="tradeLicenseExpiry">Trade License Expiry Date *</Label>
                <Input
                  id="tradeLicenseExpiry"
                  type="date"
                  value={form.tradeLicenseExpiry}
                  onChange={(e) => updateField("tradeLicenseExpiry", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                {errors.tradeLicenseExpiry && <p className="text-sm text-destructive">{errors.tradeLicenseExpiry}</p>}
              </div>
              {renderUploadArea("tradeLicenseFile", "Trade License Copy", tradeLicenseRef)}
            </div>
          </CardContent>
        </>
      );
    }

    // Non-PM: Passport or Emirates ID — at least one required
    return (
      <>
        <CardHeader>
          <CardTitle>Document Verification</CardTitle>
          <CardDescription>Upload your identification documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload requirements info */}
          <div className="rounded-lg bg-muted/50 border px-4 py-3">
            <div className="flex items-start gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Upload requirements</p>
                <ul className="space-y-0.5">
                  <li>Accepted formats: <strong>PNG, JPG, JPEG</strong></li>
                  <li>Maximum file size: <strong>5MB</strong> per file</li>
                  <li>Passport is required; Emirates ID is optional</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Passport Section (required) */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Passport *</h3>
            <div className="space-y-2">
              <Label htmlFor="passportNumber">Passport Number *</Label>
              <Input
                id="passportNumber"
                placeholder="Enter your passport number"
                value={form.passportNumber}
                onChange={(e) => updateField("passportNumber", e.target.value)}
              />
              {errors.passportNumber && <p className="text-sm text-destructive">{errors.passportNumber}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="passportExpiry">Passport Expiry Date *</Label>
              <Input
                id="passportExpiry"
                type="date"
                value={form.passportExpiry}
                onChange={(e) => updateField("passportExpiry", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              {errors.passportExpiry && <p className="text-sm text-destructive">{errors.passportExpiry}</p>}
            </div>
            {renderUploadArea("passportFrontFile", "Passport Copy", passportFrontRef)}
          </div>

          {/* Emirates ID Section (optional) */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Emirates ID (optional)</h3>
            <div className="space-y-2">
              <Label htmlFor="idNumber">Emirates ID Number</Label>
              <Input
                id="idNumber"
                placeholder="Enter your Emirates ID number"
                value={form.idNumber}
                onChange={(e) => updateField("idNumber", e.target.value)}
              />
              {errors.idNumber && <p className="text-sm text-destructive">{errors.idNumber}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="idExpiry">Emirates ID Expiry Date</Label>
              <Input
                id="idExpiry"
                type="date"
                value={form.idExpiry}
                onChange={(e) => updateField("idExpiry", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              {errors.idExpiry && <p className="text-sm text-destructive">{errors.idExpiry}</p>}
            </div>
            {renderUploadArea("idFrontFile", "ID Front Image", idFrontRef)}
            {renderUploadArea("idBackFile", "ID Back Image", idBackRef)}
          </div>

        </CardContent>
      </>
    );
  };

  const renderStep4 = () => (
    <>
      <CardHeader>
        <CardTitle>Phone Verification</CardTitle>
        <CardDescription>
          Enter the 6-digit code sent to {form.phoneCode}
          {form.phoneNumber}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 rounded-full bg-primary/10">
            <Phone className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2 flex flex-col items-center">
            <InputOTP
              maxLength={6}
              value={form.otp}
              onChange={(value) => updateField("otp", value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {errors.otp && <p className="text-sm text-destructive">{errors.otp}</p>}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isLoading}
            onClick={async () => {
              setIsLoading(true);
              try {
                const phone = `${form.phoneCode}${form.phoneNumber.replace(/\s/g, "")}`;
                await api.post("/auth/send-signup-otp", { phone, email: form.email });
                toast({ title: "OTP resent to your phone" });
              } catch (error: any) {
                toast({ title: error.message || "Failed to resend OTP", variant: "destructive" });
              } finally {
                setIsLoading(false);
              }
            }}
          >
            Didn't receive the code? Resend
          </Button>
        </div>
      </CardContent>
    </>
  );

  // ─── Plan Selection Step (PM only) ──────────────────────────────────────
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const { data: availablePlans = [] } = useQuery<any[]>({
    queryKey: ["/subscriptions/plans"],
    queryFn: () => api.get("/subscriptions/plans"),
    enabled: isPM && step === (stepMap as any).choosePlan,
  });

  const handlePlanSelect = async (planId: string) => {
    setSelectedPlanId(planId);
    setCheckoutLoading(true);
    try {
      await api.post("/subscriptions/checkout", { planId, cardLast4: "0000", cardBrand: "Pending", cardName: form.fullName });
      toast({ title: "Plan activated!" });
      setStep(stepMap.complete);
    } catch (error: any) {
      toast({ title: error.message || "Failed to activate plan", variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const renderPlanStep = () => (
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Choose Your Plan</CardTitle>
        <CardDescription>
          Select a subscription plan to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {availablePlans.map((plan: any) => (
            <div
              key={plan.id}
              className={cn(
                "border rounded-lg p-4 cursor-pointer transition-all hover:border-primary",
                selectedPlanId === plan.id && "border-primary bg-primary/5"
              )}
              onClick={() => !checkoutLoading && setSelectedPlanId(plan.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">AED {plan.price}</p>
                  <p className="text-xs text-muted-foreground">/{plan.billingCycle === "monthly" ? "mo" : plan.billingCycle}</p>
                </div>
              </div>
              {plan.features && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.features.map((f: any) => (
                    <span key={f.featureKey} className="text-xs bg-muted px-2 py-1 rounded">
                      {f.limitType === "boolean"
                        ? f.featureKey.replace(/_/g, " ")
                        : `${f.numericMax} ${f.featureKey.replace(/_/g, " ")}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <Button
          className="w-full mt-6"
          disabled={!selectedPlanId || checkoutLoading}
          onClick={() => selectedPlanId && handlePlanSelect(selectedPlanId)}
        >
          {checkoutLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {checkoutLoading ? "Activating..." : "Continue with Selected Plan"}
        </Button>
        <Button
          variant="ghost"
          className="w-full mt-2 text-muted-foreground"
          onClick={() => setStep(stepMap.complete)}
        >
          Skip for now
        </Button>
      </CardContent>
    </>
  );

  const renderStep5 = () => (
    <>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-2xl">Account Created!</CardTitle>
        <CardDescription>
          Your account has been successfully created. You can now sign in to access your
          dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground mb-6">
          Your documents are pending verification. You will be notified once your KYC is approved.
        </p>
        <Button onClick={() => navigate(isPM ? "/portal/plans" : `/login/${roleSlug}`)} className="w-full max-w-xs">
          {isPM ? "Choose a Plan" : "Go to Sign In"}
        </Button>
      </CardContent>
    </>
  );

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href={`/login/${roleSlug}`} className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Home className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">NestQuest</span>
          </Link>
        </div>

        {/* Step Indicator */}
        <StepIndicator />

        {/* Card */}
        <Card>
          {step === stepMap.personal && renderStep1()}
          {step === stepMap.account && renderStep2()}
          {isPM && step === stepMap.company && renderCompanyStep()}
          {step === stepMap.documents && renderStep3()}
          {step === stepMap.verify && renderStep4()}
          {isPM && step === (stepMap as any).choosePlan && renderPlanStep()}
          {step === stepMap.complete && renderStep5()}

          {/* Navigation Buttons */}
          {step < stepMap.complete && !(isPM && step === (stepMap as any).choosePlan) && (
            <CardFooter className="flex justify-between gap-4">
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              <Button type="button" onClick={handleNext} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {step === stepMap.verify ? "Verify & Create Account" : "Next"}
                {step < stepMap.verify && !isLoading && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </CardFooter>
          )}

          {/* Login link */}
          {step < stepMap.complete && (
            <div className="px-6 pb-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href={`/login/${roleSlug}`} className="text-primary hover:underline font-medium">
                  Sign In
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
