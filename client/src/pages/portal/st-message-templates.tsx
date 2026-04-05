import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Mail, Plus, Pencil, Trash2, Loader2, Zap, Send, Clock, CheckCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

type TriggerType = "manual" | "booking_confirmed" | "check_in_day" | "day_before_checkout" | "post_checkout";

interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  trigger: TriggerType;
  triggerDelayHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<TriggerType, { label: string; description: string; icon: any; color: string }> = {
  manual: {
    label: "Manual Only",
    description: "Send manually from a booking — no automatic trigger",
    icon: Send,
    color: "bg-slate-100 text-slate-700",
  },
  booking_confirmed: {
    label: "Booking Confirmed",
    description: "Auto-sends when a booking is confirmed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-700",
  },
  check_in_day: {
    label: "Check-in Day",
    description: "Auto-sends on the check-in date",
    icon: Zap,
    color: "bg-blue-100 text-blue-700",
  },
  day_before_checkout: {
    label: "Day Before Checkout",
    description: "Auto-sends the day before checkout",
    icon: Clock,
    color: "bg-amber-100 text-amber-700",
  },
  post_checkout: {
    label: "Post Checkout",
    description: "Auto-sends after checkout (request review)",
    icon: Mail,
    color: "bg-violet-100 text-violet-700",
  },
};

const VARIABLES = [
  { key: "{{guest_name}}", label: "Guest Name" },
  { key: "{{property_name}}", label: "Property Name" },
  { key: "{{check_in_date}}", label: "Check-in Date" },
  { key: "{{check_out_date}}", label: "Check-out Date" },
  { key: "{{check_in_time}}", label: "Check-in Time" },
  { key: "{{check_out_time}}", label: "Check-out Time" },
  { key: "{{access_pin}}", label: "Access PIN" },
  { key: "{{total_nights}}", label: "Total Nights" },
  { key: "{{total_amount}}", label: "Total Amount" },
  { key: "{{property_address}}", label: "Property Address" },
  { key: "{{pm_name}}", label: "PM Name" },
  { key: "{{pm_phone}}", label: "PM Phone" },
];

const TEMPLATE_EXAMPLES: Record<TriggerType, { name: string; body: string }> = {
  booking_confirmed: {
    name: "Booking Confirmation",
    body: `Hi {{guest_name}},

Your booking at {{property_name}} has been confirmed! 🎉

📅 Check-in: {{check_in_date}} at {{check_in_time}}
📅 Check-out: {{check_out_date}} at {{check_out_time}}
🌙 Duration: {{total_nights}} nights

We'll send you full check-in instructions closer to your arrival. If you have any questions in the meantime, don't hesitate to reach out.

See you soon!
{{pm_name}}`,
  },
  check_in_day: {
    name: "Check-in Instructions",
    body: `Hi {{guest_name}},

Welcome! Your check-in day is here. Here are your access details:

🏠 Property: {{property_name}}
📍 Address: {{property_address}}
🔑 Access PIN: {{access_pin}}
⏰ Check-in from: {{check_in_time}}

Please don't hesitate to message me if you need anything during your stay. Enjoy! 😊

{{pm_name}}
{{pm_phone}}`,
  },
  day_before_checkout: {
    name: "Checkout Reminder",
    body: `Hi {{guest_name}},

Just a friendly reminder that checkout is tomorrow at {{check_out_time}}.

Please ensure:
✓ All personal belongings are packed
✓ Keys / access cards are left as instructed
✓ Property is left in a tidy condition

It was a pleasure having you! We hope you enjoyed your stay at {{property_name}}.

{{pm_name}}`,
  },
  post_checkout: {
    name: "Review Request",
    body: `Hi {{guest_name}},

Thank you for staying at {{property_name}}! We hope you had a wonderful experience.

If you have a moment, we'd really appreciate a review of your stay — honest feedback helps us improve and helps other guests make informed decisions.

We'd love to host you again soon! 🌟

Warm regards,
{{pm_name}}`,
  },
  manual: {
    name: "Custom Message",
    body: `Hi {{guest_name}},

Thank you for your booking at {{property_name}}.

`,
  },
};

// ── Form State ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  subject: "",
  body: "",
  trigger: "manual" as TriggerType,
  triggerDelayHours: 0,
  isActive: true,
};

// ── Main Component ─────────────────────────────────────────────────────

export default function StMessageTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewMode, setPreviewMode] = useState(false);

  const { data: templates = [], isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["/message-templates"],
    queryFn: () => api.get("/message-templates"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => api.post("/message-templates", data),
    onSuccess: () => {
      toast({ title: "Template created" });
      queryClient.invalidateQueries({ queryKey: ["/message-templates"] });
      closeDialog();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof EMPTY_FORM> }) =>
      api.patch(`/message-templates/${id}`, data),
    onSuccess: () => {
      toast({ title: "Template updated" });
      queryClient.invalidateQueries({ queryKey: ["/message-templates"] });
      closeDialog();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/message-templates/${id}`),
    onSuccess: () => {
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["/message-templates"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/message-templates/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/message-templates"] }),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setPreviewMode(false);
    setDialogOpen(true);
  }

  function openEdit(t: MessageTemplate) {
    setEditingTemplate(t);
    setForm({
      name: t.name,
      subject: t.subject || "",
      body: t.body,
      trigger: t.trigger,
      triggerDelayHours: t.triggerDelayHours,
      isActive: t.isActive,
    });
    setPreviewMode(false);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setPreviewMode(false);
  }

  function handleSubmit() {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function insertVariable(variable: string) {
    setForm((prev) => ({ ...prev, body: prev.body + variable }));
  }

  function loadExample() {
    const ex = TEMPLATE_EXAMPLES[form.trigger];
    setForm((prev) => ({ ...prev, name: prev.name || ex.name, body: ex.body }));
  }

  // Render preview by substituting variables with sample values
  function renderPreview(text: string) {
    const samples: Record<string, string> = {
      "{{guest_name}}": "Sarah Johnson",
      "{{property_name}}": "Marina View Studio",
      "{{check_in_date}}": "15 Apr 2026",
      "{{check_out_date}}": "18 Apr 2026",
      "{{check_in_time}}": "3:00 PM",
      "{{check_out_time}}": "11:00 AM",
      "{{access_pin}}": "4821",
      "{{total_nights}}": "3",
      "{{total_amount}}": "AED 900",
      "{{property_address}}": "Unit 2405, Marina Crown Tower, Dubai Marina",
      "{{pm_name}}": "Ahmed Al-Rashidi",
      "{{pm_phone}}": "+971 50 123 4567",
    };
    let out = text;
    for (const [k, v] of Object.entries(samples)) out = out.replaceAll(k, v);
    return out;
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const triggerGroups = {
    automated: (["booking_confirmed", "check_in_day", "day_before_checkout", "post_checkout"] as TriggerType[]),
    manual: ["manual" as TriggerType],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" /> Message Templates
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create reusable templates with triggers that auto-send to guests at key moments
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {/* Trigger info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.entries(TRIGGER_CONFIG) as [TriggerType, typeof TRIGGER_CONFIG[TriggerType]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = templates.filter((t) => t.trigger === key).length;
          return (
            <div key={key} className="border rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-xs">{cfg.label}</span>
              </div>
              <p className="text-muted-foreground text-xs line-clamp-2">{cfg.description}</p>
              <p className="mt-2 text-xs font-medium">{count} template{count !== 1 ? "s" : ""}</p>
            </div>
          );
        })}
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-20">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-muted-foreground">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first template to start automating guest communications</p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Automated triggers */}
          {triggerGroups.automated.some((t) => templates.some((tmpl) => tmpl.trigger === t)) && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Zap className="h-4 w-4" /> Automated Triggers
              </h2>
              {triggerGroups.automated.map((trigKey) => {
                const group = templates.filter((t) => t.trigger === trigKey);
                if (group.length === 0) return null;
                const cfg = TRIGGER_CONFIG[trigKey];
                return group.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onEdit={() => openEdit(t)}
                    onDelete={() => setDeleteTarget(t)}
                    onToggle={(v) => toggleActiveMutation.mutate({ id: t.id, isActive: v })}
                  />
                ));
              })}
            </>
          )}

          {/* Manual templates */}
          {templates.some((t) => t.trigger === "manual") && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mt-4">
                <Send className="h-4 w-4" /> Manual Templates
              </h2>
              {templates.filter((t) => t.trigger === "manual").map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={() => openEdit(t)}
                  onDelete={() => setDeleteTarget(t)}
                  onToggle={(v) => toggleActiveMutation.mutate({ id: t.id, isActive: v })}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Message Template"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Template Name *</Label>
                <Input
                  placeholder="e.g. Check-in Instructions"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subject (optional)</Label>
                <Input
                  placeholder="For future email use"
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Send Trigger</Label>
                <Select
                  value={form.trigger}
                  onValueChange={(v) => setForm((p) => ({ ...p, trigger: v as TriggerType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TRIGGER_CONFIG) as [TriggerType, any][]).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex flex-col">
                          <span>{cfg.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{TRIGGER_CONFIG[form.trigger].description}</p>
              </div>
              {form.trigger !== "manual" && (
                <div className="space-y-1.5">
                  <Label>Delay After Trigger (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={72}
                    value={form.triggerDelayHours}
                    onChange={(e) => setForm((p) => ({ ...p, triggerDelayHours: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">0 = send immediately</p>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Message Body *</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={loadExample}
                  >
                    Load example
                  </Button>
                  <Button
                    type="button"
                    variant={previewMode ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPreviewMode((p) => !p)}
                  >
                    {previewMode ? "Edit" : "Preview"}
                  </Button>
                </div>
              </div>

              {previewMode ? (
                <div className="border rounded-md p-4 bg-muted/30 text-sm whitespace-pre-wrap min-h-[180px] font-mono text-xs">
                  {renderPreview(form.body) || <span className="text-muted-foreground">Nothing to preview</span>}
                </div>
              ) : (
                <Textarea
                  placeholder="Write your message here. Use {{variables}} to personalise."
                  value={form.body}
                  onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                  rows={10}
                  className="font-mono text-xs resize-y"
                />
              )}
            </div>

            {/* Variable Picker */}
            {!previewMode && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Click to insert variable</Label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="text-xs border rounded px-2 py-0.5 hover:bg-primary hover:text-primary-foreground transition-colors font-mono"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active toggle */}
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Disable to pause auto-sending without deleting</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || !form.name.trim() || !form.body.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{deleteTarget?.name}" will be permanently deleted. Auto-sends using this template will stop.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Template Card ──────────────────────────────────────────────────────

function TemplateCard({
  template, onEdit, onDelete, onToggle,
}: {
  template: MessageTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) {
  const cfg = TRIGGER_CONFIG[template.trigger];
  const Icon = cfg.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`transition-opacity ${template.isActive ? "" : "opacity-60"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted/60 shrink-0 mt-0.5">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{template.name}</p>
              <Badge className={`text-[10px] border-0 ${cfg.color}`}>{cfg.label}</Badge>
              {template.trigger !== "manual" && template.triggerDelayHours > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  +{template.triggerDelayHours}h delay
                </Badge>
              )}
              {!template.isActive && (
                <Badge variant="secondary" className="text-[10px]">Paused</Badge>
              )}
            </div>

            {template.subject && (
              <p className="text-xs text-muted-foreground mt-0.5">Subject: {template.subject}</p>
            )}

            <p
              className={`text-xs text-muted-foreground mt-1 whitespace-pre-wrap font-mono ${expanded ? "" : "line-clamp-2"}`}
            >
              {template.body}
            </p>
            {template.body.split("\n").length > 2 && (
              <button
                className="text-xs text-primary mt-1 hover:underline"
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={template.isActive}
              onCheckedChange={onToggle}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
