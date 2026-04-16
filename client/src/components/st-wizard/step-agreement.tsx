import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  FileText,
  Upload,
  Trash2,
  Home,
  DollarSign,
  Wifi,
  Flame,
  Droplets,
  Loader2,
  CheckCircle2,
  X,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────

interface Document {
  id: string;
  documentType: string;
  name: string | null;
  fileUrl: string | null;
  hasExpiry: boolean;
  expiryDate: string | null;
}

interface StepAgreementProps {
  property: any;
  propertyId: string;
  documents: any[];
  acquisitionDetails: any;
  onUpdate: (fields: Record<string, any>) => void;
  onRefresh: () => void;
}

// ── Acquisition type cards ──────────────────────────────────

const ACQUISITION_TYPES = [
  {
    key: "cash",
    label: "Cash",
    desc: "Full cash purchase",
    icon: DollarSign,
    enabled: true,
  },
  {
    key: "rented",
    label: "Rented",
    desc: "Property is rented",
    icon: Home,
    enabled: false,
  },
  {
    key: "financed",
    label: "Financed",
    desc: "Mortgage / bank financing",
    icon: DollarSign,
    enabled: false,
  },
  {
    key: "off_plan",
    label: "Off-Plan",
    desc: "Under construction / off-plan",
    icon: Home,
    enabled: false,
  },
];

// ── Document types for Cash ──────────────────────────────────

const CASH_DOCUMENT_TYPES = [
  { key: "title_deed", label: "Title Deed", required: true, hasExpiry: true },
  { key: "spa", label: "SPA (Sale & Purchase Agreement)", required: true, hasExpiry: true },
  { key: "noc", label: "NOC (No Objection Certificate)", required: true, hasExpiry: true },
  { key: "dtcm", label: "DTCM Letter", required: true, hasExpiry: true },
];

// ── Component ──────────────────────────────────────────────

export default function StepAgreement({
  property,
  propertyId,
  documents,
  acquisitionDetails,
  onUpdate,
  onRefresh,
}: StepAgreementProps) {
  const acq = acquisitionDetails || {};

  // Acquisition type
  const [acquisitionType, setAcquisitionType] = useState(
    property.acquisitionType || "",
  );

  // Cash details
  const [purchasePrice, setPurchasePrice] = useState(acq.purchasePrice ?? "");
  const [purchaseDate, setPurchaseDate] = useState(acq.purchaseDate ?? "");

  // Utilities
  const [dewaNo, setDewaNo] = useState(acq.dewaNo ?? "");
  const [internetProvider, setInternetProvider] = useState(
    acq.internetProvider ?? "",
  );
  const [internetAccountNo, setInternetAccountNo] = useState(
    acq.internetAccountNo ?? "",
  );
  const [gasNo, setGasNo] = useState(acq.gasNo ?? "");

  // Confirmation
  const [confirmed, setConfirmed] = useState(property.confirmed ?? false);

  // Upload state per document type
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Expiry dates for documents that have expiry (e.g. DTCM)
  const [docExpiryDates, setDocExpiryDates] = useState<Record<string, string>>({});

  // ── Mutations ──────────────────────────────────────────

  const acquisitionMutation = useMutation({
    mutationFn: (fields: Record<string, any>) =>
      api.patch(`/st-properties/${propertyId}/acquisition`, fields),
  });

  const addDocMutation = useMutation({
    mutationFn: (body: {
      documentType: string;
      name: string;
      fileUrl: string;
      hasExpiry: boolean;
      expiryDate: string | null;
    }) => api.post(`/st-properties/${propertyId}/documents`, body),
    onSuccess: () => onRefresh(),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) =>
      api.delete(`/st-properties/${propertyId}/documents/${docId}`),
    onSuccess: () => onRefresh(),
  });

  // ── Handlers ──────────────────────────────────────────

  const handleAcquisitionBlur = useCallback(
    (field: string, value: any) => {
      acquisitionMutation.mutate({ [field]: value === "" ? null : value });
    },
    [acquisitionMutation],
  );

  const handleFileUpload = useCallback(
    async (docType: string, label: string, file: File, hasExpiry: boolean) => {
      setUploadingType(docType);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error);
        }
        const data = await res.json();
        const expiryDate = hasExpiry ? (docExpiryDates[docType] || null) : null;
        await addDocMutation.mutateAsync({
          documentType: docType,
          name: label,
          fileUrl: data.url,
          hasExpiry,
          expiryDate,
        });
      } catch (e) {
        console.error("Upload error:", e);
      } finally {
        setUploadingType(null);
      }
    },
    [addDocMutation, docExpiryDates],
  );

  const getDocsByType = (type: string): Document[] => {
    return (documents || []).filter(
      (d: Document) => d.documentType === type,
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* ── Section A: Acquisition Type ─────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Acquisition Type</h3>
        </div>
        <Separator className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ACQUISITION_TYPES.map((type) => (
            <button
              key={type.key}
              type="button"
              disabled={!type.enabled}
              onClick={() => {
                if (!type.enabled) return;
                setAcquisitionType(type.key);
                onUpdate({ acquisitionType: type.key });
              }}
              className={cn(
                "text-left rounded-md border p-4 transition-colors relative",
                !type.enabled &&
                  "opacity-50 cursor-not-allowed",
                type.enabled && acquisitionType === type.key
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "bg-white border-border",
                type.enabled &&
                  acquisitionType !== type.key &&
                  "hover:bg-muted",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                    acquisitionType === type.key && type.enabled
                      ? "bg-primary/10"
                      : "bg-muted",
                  )}
                >
                  <type.icon
                    className={cn(
                      "h-5 w-5",
                      acquisitionType === type.key && type.enabled
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                </div>
                <div>
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.desc}</p>
                </div>
              </div>
              {!type.enabled && (
                <span className="absolute top-2 right-2 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Section B: Cash Details ──────────────────────────── */}
      {acquisitionType === "cash" && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Cash Details</h3>
          </div>
          <Separator className="mb-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Purchase Price */}
            <div className="space-y-1.5">
              <Label>
                Purchase Price (AED) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="text"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                onBlur={() => handleAcquisitionBlur("purchasePrice", purchasePrice)}
                placeholder="e.g. 1,500,000"
              />
            </div>

            {/* Purchase Date */}
            <div className="space-y-1.5">
              <Label>
                Purchase Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => {
                  setPurchaseDate(e.target.value);
                  acquisitionMutation.mutate({
                    purchaseDate: e.target.value || null,
                  });
                }}
              />
            </div>

          </div>
        </section>
      )}

      {/* ── Section C: Documents ─────────────────────────────── */}
      {acquisitionType && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Documents</h3>
          </div>
          <Separator className="mb-4" />

          <div className="space-y-6">
            {CASH_DOCUMENT_TYPES.map((docType) => {
              const existingDocs = getDocsByType(docType.key);
              const isUploading = uploadingType === docType.key;
              const hasDoc = existingDocs.length > 0;

              return (
                <div key={docType.key} className="space-y-2">
                  <Label>
                    {docType.label} {docType.required && <span className="text-destructive">*</span>}
                  </Label>

                  {/* Expiry date — always show above upload area */}
                  {docType.hasExpiry && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Expiry Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={docExpiryDates[docType.key] || ""}
                        onChange={(e) => {
                          setDocExpiryDates((prev) => ({
                            ...prev,
                            [docType.key]: e.target.value,
                          }));
                        }}
                        className="max-w-[200px]"
                      />
                    </div>
                  )}

                  <input
                    ref={(el) => {
                      fileInputRefs.current[docType.key] = el;
                    }}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(docType.key, docType.label, file, docType.hasExpiry);
                        e.target.value = "";
                      }
                    }}
                  />

                  {hasDoc ? (
                    /* ── Uploaded state ── */
                    <div className="border-2 border-green-500 rounded-lg overflow-hidden bg-green-50/50">
                      {/* File preview — image or icon */}
                      {existingDocs.map((doc: Document) => {
                        const isImage = doc.fileUrl?.match(/\.(jpg|jpeg|png|webp)$/i);
                        return (
                          <div key={doc.id}>
                            <div className="relative bg-muted/30">
                              {isImage ? (
                                <img
                                  src={doc.fileUrl || ""}
                                  alt={doc.name || docType.label}
                                  className="w-full h-48 object-contain"
                                />
                              ) : (
                                <div className="w-full h-48 flex flex-col items-center justify-center gap-2">
                                  <FileText className="h-12 w-12 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Document uploaded</span>
                                </div>
                              )}
                              {/* Remove button */}
                              <button
                                type="button"
                                onClick={() => deleteDocMutation.mutate(doc.id)}
                                disabled={deleteDocMutation.isPending}
                                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-md"
                              >
                                {deleteDocMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                            {/* File info */}
                            <div className="px-4 py-3 flex items-center justify-between border-t border-green-200">
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                <a
                                  href={doc.fileUrl || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-green-700 truncate hover:underline"
                                >
                                  {doc.name || docType.label}
                                </a>
                              </div>
                              {doc.hasExpiry && doc.expiryDate && (
                                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                  Expires: {doc.expiryDate}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── Empty upload state ── */
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
                        docType.hasExpiry && !docExpiryDates[docType.key]
                          ? "opacity-50 cursor-not-allowed"
                          : "border-muted-foreground/25",
                      )}
                      onClick={() => {
                        if (docType.hasExpiry && !docExpiryDates[docType.key]) return;
                        fileInputRefs.current[docType.key]?.click();
                      }}
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Click to upload</p>
                            <p className="text-xs mt-1">or drag and drop your file here</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="px-2 py-0.5 rounded bg-muted font-medium">PDF</span>
                            <span className="px-2 py-0.5 rounded bg-muted font-medium">JPG</span>
                            <span className="px-2 py-0.5 rounded bg-muted font-medium">PNG</span>
                            <span className="px-2 py-0.5 rounded bg-muted font-medium">DOC</span>
                          </div>
                          {docType.hasExpiry && !docExpiryDates[docType.key] && (
                            <p className="text-xs text-amber-600">Set expiry date first</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Section D: Utilities ──────────────────────────────── */}
      {acquisitionType && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Utilities</h3>
          </div>
          <Separator className="mb-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* DEWA Number */}
            <div className="space-y-1.5">
              <Label>
                <span className="flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5" />
                  DEWA Number
                </span>
              </Label>
              <Input
                value={dewaNo}
                onChange={(e) => setDewaNo(e.target.value)}
                onBlur={() => handleAcquisitionBlur("dewaNo", dewaNo)}
                placeholder="e.g. 1234567890"
              />
            </div>

            {/* Internet Provider */}
            <div className="space-y-1.5">
              <Label>
                <span className="flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5" />
                  Internet Provider
                </span>
              </Label>
              <Select
                value={internetProvider}
                onValueChange={(v) => {
                  setInternetProvider(v);
                  acquisitionMutation.mutate({ internetProvider: v });
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="du">Du</SelectItem>
                  <SelectItem value="etisalat">Etisalat</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Internet Account Number */}
            <div className="space-y-1.5">
              <Label>
                <span className="flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5" />
                  Internet Account Number
                </span>
              </Label>
              <Input
                value={internetAccountNo}
                onChange={(e) => setInternetAccountNo(e.target.value)}
                onBlur={() =>
                  handleAcquisitionBlur("internetAccountNo", internetAccountNo)
                }
                placeholder="Account number"
              />
            </div>

            {/* Gas Number */}
            <div className="space-y-1.5">
              <Label>
                <span className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5" />
                  Gas Number
                </span>
              </Label>
              <Input
                value={gasNo}
                onChange={(e) => setGasNo(e.target.value)}
                onBlur={() => handleAcquisitionBlur("gasNo", gasNo)}
                placeholder="Optional"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Section E: Confirmation ───────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Confirmation</h3>
        </div>
        <Separator className="mb-4" />

        <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2.5">
          <Label className="cursor-pointer text-sm leading-relaxed pr-4">
            I confirm that all information provided is accurate and I have the
            legal authority to list this property
          </Label>
          <Switch
            checked={confirmed}
            onCheckedChange={(v) => {
              setConfirmed(v);
              onUpdate({ confirmed: v });
            }}
          />
        </div>
      </section>
    </div>
  );
}
