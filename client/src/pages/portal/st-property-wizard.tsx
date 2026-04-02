import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Home,
  FileText,
  Camera,
  Sparkles,
  DollarSign,
  ShieldCheck,
  Users,
  ClipboardCheck,
} from "lucide-react";
import StepPropertyDetails from "@/components/st-wizard/step-property-details";
import StepDescription from "@/components/st-wizard/step-description";
import StepPhotos from "@/components/st-wizard/step-photos";
import StepAmenities from "@/components/st-wizard/step-amenities";
import StepPricing from "@/components/st-wizard/step-pricing";
import StepPolicies from "@/components/st-wizard/step-policies";
import StepPropertyOwner from "@/components/st-wizard/step-property-owner";
import StepAgreement from "@/components/st-wizard/step-agreement";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StPropertyData {
  id: string;
  publicName: string | null;
  status: "draft" | "active" | "inactive";
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  addressLine1: string | null;
  city: string | null;
  shortDescription: string | null;
  nightlyRate: string | null;
  cancellationPolicy: string | null;
  poUserId: string | null;
  commissionType: string | null;
  commissionValue: string | null;
  acquisitionType: string | null;
  agreementConfirmed: boolean;
  photosCount: number;
  documents: any[];
  [key: string]: any;
}

// ─── Steps config ───────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, name: "Property Details", icon: Home },
  { number: 2, name: "Description", icon: FileText },
  { number: 3, name: "Photos", icon: Camera },
  { number: 4, name: "Amenities", icon: Sparkles },
  { number: 5, name: "Pricing", icon: DollarSign },
  { number: 6, name: "Policies", icon: ShieldCheck },
  { number: 7, name: "Property Owner", icon: Users },
  { number: 8, name: "Agreement Terms", icon: ClipboardCheck },
] as const;

function isStepComplete(step: number, data: StPropertyData): boolean {
  switch (step) {
    case 1:
      return !!(data.propertyType && data.bedrooms && data.bathrooms && data.maxGuests && data.addressLine1 && data.city);
    case 2:
      return !!(data.publicName && data.shortDescription);
    case 3:
      return data.photosCount >= 1;
    case 4:
      return (data.amenities?.length ?? 0) >= 1;
    case 5:
      return !!data.nightlyRate;
    case 6:
      return !!data.cancellationPolicy;
    case 7:
      return !!(data.poUserId && data.commissionType && data.commissionValue);
    case 8: {
      if (!data.acquisitionType || !data.agreementConfirmed) return false;
      // Check all required documents are uploaded
      const docs = data.documents || [];
      const hasTitle = docs.some((d: any) => d.documentType === "title_deed");
      const hasSpa = docs.some((d: any) => d.documentType === "spa");
      const hasNoc = docs.some((d: any) => d.documentType === "noc");
      const hasDtcm = docs.some((d: any) => d.documentType === "dtcm");
      return hasTitle && hasSpa && hasNoc && hasDtcm;
    }
    default:
      return false;
  }
}

const statusBadge: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  active: { label: "Active", className: "bg-green-600 text-white" },
  inactive: { label: "Inactive", className: "bg-gray-200 text-gray-600" },
};

// ─── Auto-save interval ─────────────────────────────────────────────────────

const AUTO_SAVE_INTERVAL = 60_000; // 60 seconds

// ─── Component ──────────────────────────────────────────────────────────────

export default function StPropertyWizard({ id: propId }: { id?: string } = {}) {
  const [match, params] = useRoute("/portal/st-properties/:id/edit");
  const [, navigate] = useLocation();
  const id = propId || params?.id;

  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const dirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch property data
  const { data: property, isLoading, isError } = useQuery<StPropertyData>({
    queryKey: ["/st-properties", id],
    queryFn: () => api.get(`/st-properties/${id}`),
    enabled: !!id,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (fields: Partial<StPropertyData>) =>
      api.patch(`/st-properties/${id}`, fields),
    onMutate: () => {
      setSaveStatus("saving");
    },
    onSuccess: () => {
      setSaveStatus("saved");
      setIsDirty(false);
      dirtyRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["/st-properties", id] });
      // Reset "Saved" indicator after 3 seconds
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
    onError: () => {
      setSaveStatus("idle");
    },
  });

  // Field update from step components — immediately PATCH the changed fields
  const handleFieldUpdate = useCallback(
    (fields: Record<string, any>) => {
      setIsDirty(true);
      dirtyRef.current = true;
      saveMutation.mutate(fields);
    },
    [saveMutation],
  );

  // Refresh property data (used by photos step after photo CRUD)
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/st-properties", id] });
  }, [queryClient, id]);

  // Manual save — data is already persisted on each field change,
  // so just refresh the cache and show "Saved" indicator
  const handleSave = useCallback(() => {
    if (!property) return;
    setSaveStatus("saved");
    setIsDirty(false);
    dirtyRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["/st-properties", id] });
    setTimeout(() => setSaveStatus("idle"), 3000);
  }, [property, queryClient, id]);

  // Save & Exit — navigate back; data is already saved
  const handleSaveAndExit = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/st-properties"] });
    // Non-draft properties go to view page, drafts go to list
    if (property && property.status !== "draft") {
      navigate(`/portal/st-properties/${id}`);
    } else {
      navigate("/portal/st-properties");
    }
  }, [queryClient, navigate, property, id]);

  // Go Live / Deactivate handler
  const handleStatusChange = useCallback(
    (newStatus: "active" | "draft" | "inactive") => {
      saveMutation.mutate({ status: newStatus });
    },
    [saveMutation],
  );

  // Auto-save timer — refresh cache periodically if dirty
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (dirtyRef.current) {
        queryClient.invalidateQueries({ queryKey: ["/st-properties", id] });
        dirtyRef.current = false;
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [queryClient, id]);

  // Track dirty state in ref for auto-save
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  // Loading state
  if (isLoading || !property) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Property not found or could not be loaded.</p>
        <Button variant="outline" onClick={() => navigate("/portal/st-properties")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Properties
        </Button>
      </div>
    );
  }

  const badge = statusBadge[property.status] || statusBadge.draft;
  const allStepsComplete = STEPS.every((step) => isStepComplete(step.number, property));

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between h-14 px-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(
              property.status === "draft"
                ? "/portal/st-properties"
                : `/portal/st-properties/${id}`
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-lg truncate max-w-[300px]">
            {property.publicName || "Untitled Property"}
          </h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status indicator */}
          <span className="text-sm text-muted-foreground">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-green-600">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
          </span>

          {/* Go Live / Deactivate button */}
          {property.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("inactive")}
              disabled={saveMutation.isPending}
              className="border-orange-400 text-orange-600 hover:bg-orange-50"
            >
              Deactivate
            </Button>
          ) : allStepsComplete ? (
            <Button
              size="sm"
              onClick={() => handleStatusChange("active")}
              disabled={saveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Go Live
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-1.5" />
            Save
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAndExit}
            disabled={saveMutation.isPending}
          >
            Save & Exit
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Step sidebar */}
        <aside className="w-60 border-r bg-muted/30 overflow-y-auto shrink-0">
          <nav className="p-3 space-y-1">
            {STEPS.map((step) => {
              const complete = isStepComplete(step.number, property);
              const isCurrent = step.number === currentStep;
              const StepIcon = step.icon;

              return (
                <button
                  key={step.number}
                  onClick={() => setCurrentStep(step.number)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left",
                    isCurrent
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {/* Completion indicator */}
                  <div className="shrink-0">
                    {complete ? (
                      <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </div>
                    ) : (
                      <div className={cn(
                        "h-6 w-6 rounded-full border-2 bg-white flex items-center justify-center text-xs font-semibold",
                        isCurrent
                          ? "border-primary text-primary"
                          : "border-muted-foreground/30 text-muted-foreground/50"
                      )}>
                        {step.number}
                      </div>
                    )}
                  </div>
                  <span className="truncate">{step.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 1 && (
            <StepPropertyDetails
              property={property}
              onUpdate={handleFieldUpdate}
            />
          )}
          {currentStep === 2 && (
            <StepDescription
              property={property}
              onUpdate={handleFieldUpdate}
            />
          )}
          {currentStep === 3 && (
            <StepPhotos
              propertyId={property.id}
              photos={property.photos || []}
              onRefresh={handleRefresh}
            />
          )}
          {currentStep === 4 && (
            <StepAmenities
              propertyId={property.id}
              amenities={property.amenities || []}
              onRefresh={handleRefresh}
            />
          )}
          {currentStep === 5 && (
            <StepPricing
              property={property}
              onUpdate={handleFieldUpdate}
            />
          )}
          {currentStep === 6 && (
            <StepPolicies
              property={property}
              policies={property.policies || []}
              onUpdate={handleFieldUpdate}
              onRefresh={handleRefresh}
              propertyId={property.id}
            />
          )}
          {currentStep === 7 && (
            <StepPropertyOwner
              property={property}
              onUpdate={handleFieldUpdate}
            />
          )}
          {currentStep === 8 && (
            <StepAgreement
              property={property}
              propertyId={property.id}
              documents={property.documents || []}
              acquisitionDetails={property.acquisitionDetails}
              onUpdate={handleFieldUpdate}
              onRefresh={handleRefresh}
            />
          )}

          {/* Step navigation buttons */}
          <div className="max-w-2xl mx-auto px-6 pb-6 pt-4 flex items-center justify-between">
            {currentStep > 1 ? (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            ) : (
              <div />
            )}
            {currentStep < STEPS.length ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
