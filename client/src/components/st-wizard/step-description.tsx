import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { FileText, Lock } from "lucide-react";

interface StepProps {
  property: any;
  onUpdate: (fields: Record<string, any>) => void;
}

export default function StepDescription({ property, onUpdate }: StepProps) {
  const [publicName, setPublicName] = useState(property.publicName || "");
  const [shortDescription, setShortDescription] = useState(
    property.shortDescription || "",
  );
  const [longDescription, setLongDescription] = useState(
    property.longDescription || "",
  );
  const [internalNotes, setInternalNotes] = useState(
    property.internalNotes || "",
  );

  const handleBlur = useCallback(
    (field: string, value: string) => {
      onUpdate({ [field]: value || null });
    },
    [onUpdate],
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Description</h3>
        </div>
        <Separator className="mb-4" />

        <div className="space-y-5">
          {/* Public Name */}
          <div className="space-y-1.5">
            <Label>
              Public Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
              onBlur={() => handleBlur("publicName", publicName)}
              placeholder="e.g. Luxury Marina Apartment with Sea View"
            />
            <p className="text-xs text-muted-foreground">
              The headline title guests see.
            </p>
          </div>

          {/* Short Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Short Description <span className="text-destructive">*</span>
              </Label>
              <span
                className={`text-xs tabular-nums ${
                  shortDescription.length > 200
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {shortDescription.length}/200
              </span>
            </div>
            <Input
              value={shortDescription}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setShortDescription(e.target.value);
                }
              }}
              onBlur={() => handleBlur("shortDescription", shortDescription)}
              placeholder="A brief summary of the property"
              maxLength={200}
            />
          </div>

          {/* Long Description */}
          <div className="space-y-1.5">
            <Label>Long Description</Label>
            <Textarea
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              onBlur={() => handleBlur("longDescription", longDescription)}
              placeholder="Detailed description of the property, amenities, nearby attractions..."
              rows={6}
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-1.5">
            <Label>Internal Notes</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              onBlur={() => handleBlur("internalNotes", internalNotes)}
              placeholder="Notes for your team..."
              rows={4}
            />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Private — not visible to guests</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
