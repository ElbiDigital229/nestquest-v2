import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PHONE_CODES = [
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

/**
 * Parse a full phone string like "+971501234567" into { code, number }.
 * Tries longest-match first (4-digit codes like +971, then 3, 2, 1).
 */
function parsePhone(full: string): { code: string; number: string } {
  const trimmed = full.trim();
  if (!trimmed || !trimmed.startsWith("+")) return { code: "+971", number: trimmed };

  for (const len of [4, 3, 2]) {
    const prefix = trimmed.slice(0, len + 1);
    if (PHONE_CODES.some((p) => p.code === prefix)) {
      return { code: prefix, number: trimmed.slice(len + 1).trim() };
    }
  }
  return { code: "+971", number: trimmed.replace(/^\+/, "") };
}

interface PhoneInputProps {
  value: string;
  onChange: (fullPhone: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PhoneInput({ value, onChange, disabled, placeholder = "Phone number" }: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [countryCode, setCountryCode] = useState(parsed.code);
  const [localNumber, setLocalNumber] = useState(parsed.number);

  // Sync from external value changes (e.g. form reset, initial load)
  useEffect(() => {
    const p = parsePhone(value);
    setCountryCode(p.code);
    setLocalNumber(p.number);
  }, [value]);

  const handleCodeChange = (newCode: string) => {
    setCountryCode(newCode);
    onChange(`${newCode}${localNumber}`);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9\s]/g, "");
    setLocalNumber(cleaned);
    onChange(`${countryCode}${cleaned}`);
  };

  return (
    <div className="flex gap-2">
      <Select
        value={countryCode}
        onValueChange={handleCodeChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[130px] shrink-0">
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
        type="tel"
        placeholder={placeholder}
        value={localNumber}
        onChange={handleNumberChange}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}
