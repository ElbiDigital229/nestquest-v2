import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, ClipboardCheck, MapPin, Clock, CheckCircle, ImagePlus, Building,
} from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  pending: { badge: "bg-yellow-100 text-yellow-800", label: "Pending" },
  in_progress: { badge: "bg-blue-100 text-blue-800", label: "In Progress" },
  completed: { badge: "bg-green-100 text-green-800", label: "Completed" },
};

export default function CleanerTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeDialog, setCompleteDialog] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/cleaners/tasks"],
    queryFn: () => api.get("/cleaners/tasks"),
  });

  const { data: taskDetail } = useQuery<any>({
    queryKey: ["/cleaners/tasks", selectedTask],
    queryFn: () => api.get(`/cleaners/tasks/${selectedTask}`),
    enabled: !!selectedTask,
  });

  const checkItemMut = useMutation({
    mutationFn: ({ taskId, itemId, isChecked, notes, imageUrl }: any) =>
      api.patch(`/cleaners/tasks/${taskId}/items/${itemId}`, { isChecked, notes, imageUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/cleaners/tasks"] }),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api.patch(`/cleaners/tasks/${id}/complete`, { notes: completeNotes }),
    onSuccess: () => {
      toast({ title: "Task completed!" });
      queryClient.invalidateQueries({ queryKey: ["/cleaners/tasks"] });
      setSelectedTask(null);
      setCompleteDialog(false);
      setCompleteNotes("");
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" /> My Tasks
        </h1>
        <p className="text-muted-foreground mt-1">Your cleaning assignments</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "pending", "in_progress", "completed"] as const).map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            {f !== "all" && <Badge variant="secondary" className="ml-1 text-[10px]">{tasks.filter(t => t.status === f).length}</Badge>}
          </Button>
        ))}
      </div>

      {/* Task List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No tasks {filter !== "all" ? `with status "${filter.replace(/_/g, " ")}"` : "assigned yet"}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((task: any) => {
            const style = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
            const progress = task.totalItems > 0 ? Math.round((task.checkedItems / task.totalItems) * 100) : 0;
            return (
              <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedTask(task.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{task.title}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Building className="h-3.5 w-3.5" /> {task.propertyName}
                        {task.unitNumber && ` - Unit ${task.unitNumber}`}
                      </p>
                      {task.dueAt && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3.5 w-3.5" /> Due: {formatDate(task.dueAt)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <Badge className={`text-[10px] border-0 ${style.badge}`}>{style.label}</Badge>
                      {task.totalItems > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{task.checkedItems}/{task.totalItems} items</p>
                      )}
                    </div>
                  </div>
                  {task.totalItems > 0 && (
                    <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask && !completeDialog} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {taskDetail ? (
            <>
              <DialogHeader>
                <DialogTitle>{taskDetail.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] border-0 ${(STATUS_STYLES[taskDetail.status] || STATUS_STYLES.pending).badge}`}>
                    {(STATUS_STYLES[taskDetail.status] || STATUS_STYLES.pending).label}
                  </Badge>
                  {taskDetail.priority === "urgent" && <Badge variant="destructive" className="text-[10px]">Urgent</Badge>}
                </div>

                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-1"><Building className="h-3.5 w-3.5 text-muted-foreground" /> {taskDetail.propertyName} {taskDetail.unitNumber ? `- Unit ${taskDetail.unitNumber}` : ""}</p>
                  {taskDetail.address && <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {taskDetail.address}</p>}
                  {taskDetail.due_at && <p className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Due: {formatDate(taskDetail.due_at)}</p>}
                </div>

                {taskDetail.notes && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">{taskDetail.notes}</div>
                )}

                <Separator />

                {/* Checklist Items */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Checklist</h4>
                  {taskDetail.items?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No checklist items.</p>
                  ) : (
                    <div className="space-y-3">
                      {taskDetail.items?.map((item: any) => (
                        <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                          <Checkbox
                            checked={item.isChecked}
                            disabled={taskDetail.status === "completed"}
                            onCheckedChange={(checked) => {
                              checkItemMut.mutate({
                                taskId: selectedTask, itemId: item.id, isChecked: !!checked,
                              });
                              // Optimistic update
                              queryClient.setQueryData(["/cleaners/tasks", selectedTask], (old: any) => ({
                                ...old,
                                items: old.items.map((i: any) => i.id === item.id ? { ...i, isChecked: !!checked } : i),
                              }));
                            }}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${item.isChecked ? "line-through text-muted-foreground" : ""}`}>{item.label}</p>
                            {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                            {item.imageUrl && <img src={item.imageUrl} alt="" className="mt-1 max-h-20 rounded border" />}

                            {/* Add note/image for this item */}
                            {taskDetail.status !== "completed" && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  placeholder="Add note..."
                                  className="text-xs border rounded px-2 py-1 flex-1"
                                  onBlur={(e) => {
                                    if (e.target.value) {
                                      checkItemMut.mutate({ taskId: selectedTask, itemId: item.id, notes: e.target.value });
                                    }
                                  }}
                                />
                                <label className="cursor-pointer text-primary hover:text-primary/80">
                                  <ImagePlus className="h-4 w-4" />
                                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const formData = new FormData();
                                    formData.append("file", file);
                                    const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
                                    const data = await res.json();
                                    if (data.url) checkItemMut.mutate({ taskId: selectedTask, itemId: item.id, imageUrl: data.url });
                                  }} />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Complete Button */}
                {taskDetail.status !== "completed" && (
                  <>
                    <Separator />
                    <Button className="w-full" onClick={() => setCompleteDialog(true)}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Mark as Complete
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Confirmation */}
      <Dialog open={completeDialog} onOpenChange={setCompleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Complete Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Add any final notes before marking this task as complete.</p>
            <Textarea value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} placeholder="Final notes (optional)" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(false)}>Cancel</Button>
            <Button disabled={completeMut.isPending} onClick={() => selectedTask && completeMut.mutate(selectedTask)}>
              {completeMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Complete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
