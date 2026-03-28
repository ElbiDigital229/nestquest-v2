import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { kycBadgeProps } from "@/lib/role-utils";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Globe,
  CreditCard,
  Building2,
  Shield,
  FileText,
  MessageSquare,
  Unlink,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface FullProfile {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  accountStatus: string;
  createdAt: string;
  fullName: string;
  dob: string | null;
  nationality: string | null;
  countryOfResidence: string | null;
  residentAddress: string | null;
  emiratesIdNumber: string | null;
  emiratesIdExpiry: string | null;
  emiratesIdFrontUrl: string | null;
  emiratesIdBackUrl: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  passportFrontUrl: string | null;
  tradeLicenseExpiry: string | null;
  tradeLicenseUrl: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyDescription: string | null;
  companyAddress: string | null;
  kycStatus: string | null;
}

function initials(name: string): string {
  return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function DocImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="text-xs text-muted-foreground">Not uploaded</span>;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="inline-block">
      <img
        src={src}
        alt={alt}
        className="h-16 w-24 object-cover rounded border hover:opacity-80 transition-opacity"
      />
      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
        <ExternalLink className="h-2.5 w-2.5" /> View
      </span>
    </a>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function LinkedUserDetailDialog({
  linkId,
  open,
  onClose,
  onUnlinked,
}: {
  linkId: string | null;
  open: boolean;
  onClose: () => void;
  onUnlinked?: () => void;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const { data: profile, isLoading } = useQuery<FullProfile>({
    queryKey: ["/links/full-profile", linkId],
    queryFn: () => api.get(`/links/${linkId}/full-profile`),
    enabled: !!linkId && open,
  });

  const unlinkMutation = useMutation({
    mutationFn: () => api.delete(`/links/${linkId}`),
    onSuccess: () => {
      toast({ title: "Unlinked", description: "You have been unlinked from this user" });
      setConfirmUnlink(false);
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/links"] });
      onUnlinked?.();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleMessage = () => {
    onClose();
    navigate(`/portal/messages?dm=${linkId}`);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmUnlink(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>Full profile information</DialogDescription>
        </DialogHeader>

        {isLoading || !profile ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[60vh] px-6">
              <div className="space-y-5 pb-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {initials(profile.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-lg">{profile.fullName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {profile.kycStatus && (() => {
                        const kyc = kycBadgeProps(profile.kycStatus);
                        return <Badge variant={kyc.variant} className={kyc.className}>{kyc.label}</Badge>;
                      })()}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact</h3>
                  <div className="grid gap-3">
                    <InfoRow icon={Mail} label="Email" value={profile.email} />
                    <InfoRow icon={Phone} label="Phone" value={profile.phone} />
                  </div>
                </div>

                <Separator />

                {/* Personal Info */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Information</h3>
                  <div className="grid gap-3">
                    <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(profile.dob)} />
                    <InfoRow icon={Globe} label="Nationality" value={profile.nationality} />
                    <InfoRow icon={Globe} label="Country of Residence" value={profile.countryOfResidence} />
                    <InfoRow icon={MapPin} label="Resident Address" value={profile.residentAddress} />
                  </div>
                </div>

                <Separator />

                {/* Emirates ID */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Emirates ID</h3>
                  <div className="grid gap-3">
                    <InfoRow icon={CreditCard} label="ID Number" value={profile.emiratesIdNumber} />
                    <InfoRow icon={Calendar} label="Expiry" value={formatDate(profile.emiratesIdExpiry)} />
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Front</p>
                        <DocImage src={profile.emiratesIdFrontUrl} alt="Emirates ID Front" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Back</p>
                        <DocImage src={profile.emiratesIdBackUrl} alt="Emirates ID Back" />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Passport */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Passport</h3>
                  <div className="grid gap-3">
                    <InfoRow icon={FileText} label="Passport Number" value={profile.passportNumber} />
                    <InfoRow icon={Calendar} label="Expiry" value={formatDate(profile.passportExpiry)} />
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Passport Copy</p>
                      <DocImage src={profile.passportFrontUrl} alt="Passport" />
                    </div>
                  </div>
                </div>

                {/* Company Info (if applicable) */}
                {(profile.companyName || profile.companyWebsite || profile.companyDescription) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Company Information</h3>
                      <div className="grid gap-3">
                        <InfoRow icon={Building2} label="Company Name" value={profile.companyName} />
                        <InfoRow icon={Globe} label="Website" value={profile.companyWebsite} />
                        <InfoRow icon={MapPin} label="Address" value={profile.companyAddress} />
                        {profile.companyDescription && (
                          <div className="text-sm">
                            <p className="text-[11px] text-muted-foreground">Description</p>
                            <p className="mt-0.5">{profile.companyDescription}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Trade License (if applicable) */}
                {(profile.tradeLicenseExpiry || profile.tradeLicenseUrl) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trade License</h3>
                      <div className="grid gap-3">
                        <InfoRow icon={Calendar} label="Expiry" value={formatDate(profile.tradeLicenseExpiry)} />
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1">License Copy</p>
                          <DocImage src={profile.tradeLicenseUrl} alt="Trade License" />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Account */}
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Account</h3>
                  <InfoRow icon={Calendar} label="Member Since" value={formatDate(profile.createdAt)} />
                </div>
              </div>
            </ScrollArea>

            {/* Footer actions */}
            <div className="border-t px-6 py-4 flex items-center justify-between">
              {confirmUnlink ? (
                <div className="flex items-center gap-2 w-full">
                  <p className="text-sm text-muted-foreground flex-1">Confirm unlink?</p>
                  <Button size="sm" variant="outline" onClick={() => setConfirmUnlink(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => unlinkMutation.mutate()}
                    disabled={unlinkMutation.isPending}
                  >
                    {unlinkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Unlink className="h-3.5 w-3.5 mr-1" />}
                    Confirm
                  </Button>
                </div>
              ) : (
                <>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmUnlink(true)}>
                    <Unlink className="h-3.5 w-3.5 mr-1" /> Unlink
                  </Button>
                  <Button size="sm" onClick={handleMessage}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Message
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
