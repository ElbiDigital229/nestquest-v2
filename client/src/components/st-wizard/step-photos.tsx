import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Camera,
  Upload,
  X,
  Star,
  GripVertical,
  Loader2,
  ImagePlus,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ──────────────────────────────────────────────────

interface Photo {
  id: string;
  url: string;
  displayOrder: number;
  isCover: boolean;
}

interface StepPhotosProps {
  propertyId: string;
  photos: Photo[];
  onRefresh: () => void;
}

// ── Sortable photo card ────────────────────────────────────

function SortablePhoto({
  photo,
  onDelete,
  onSetCover,
  isDeleting,
}: {
  photo: Photo;
  onDelete: (id: string) => void;
  onSetCover: (id: string) => void;
  isDeleting: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted"
    >
      <img
        src={photo.url}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Cover badge */}
      {photo.isCover && (
        <Badge className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-500 text-white text-xs gap-1">
          <Star className="h-3 w-3 fill-current" />
          Cover
        </Badge>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 rounded-md bg-white/90 text-gray-700 hover:bg-white cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Set as cover */}
        {!photo.isCover && (
          <button
            onClick={() => onSetCover(photo.id)}
            className="p-1.5 rounded-md bg-white/90 text-gray-700 hover:bg-amber-100"
            title="Set as cover"
          >
            <Star className="h-4 w-4" />
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => onDelete(photo.id)}
          disabled={isDeleting}
          className="p-1.5 rounded-md bg-white/90 text-red-600 hover:bg-red-50"
          title="Delete photo"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────

export default function StepPhotos({
  propertyId,
  photos,
  onRefresh,
}: StepPhotosProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Sort photos by displayOrder
  const sortedPhotos = [...photos].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  const MIN_PHOTOS = 5;
  const photoCount = photos.length;

  // ── Upload mutation ──────────────────────────────────────

  const uploadAndAdd = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // Upload file
          const formData = new FormData();
          formData.append("file", file);
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          if (!uploadRes.ok) throw new Error("Upload failed");
          const { url } = await uploadRes.json();

          // Add photo to property
          await api.post(`/st-properties/${propertyId}/photos`, {
            url,
            displayOrder: photoCount + i,
          });
        }
        onRefresh();
      } catch (err) {
        console.error("Photo upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [propertyId, photoCount, onRefresh],
  );

  // ── Delete mutation ──────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) =>
      api.delete(`/st-properties/${propertyId}/photos/${photoId}`),
    onMutate: (photoId) => setDeletingId(photoId),
    onSettled: () => {
      setDeletingId(null);
      onRefresh();
    },
  });

  // ── Set cover mutation ───────────────────────────────────

  const setCoverMutation = useMutation({
    mutationFn: (photoId: string) =>
      api.patch(`/st-properties/${propertyId}/photos/${photoId}`, {
        isCover: true,
      }),
    onSuccess: () => onRefresh(),
  });

  // ── Reorder mutation ─────────────────────────────────────

  const reorderMutation = useMutation({
    mutationFn: (updates: { id: string; displayOrder: number }[]) =>
      Promise.all(
        updates.map((u) =>
          api.patch(`/st-properties/${propertyId}/photos/${u.id}`, {
            displayOrder: u.displayOrder,
          }),
        ),
      ),
    onSuccess: () => onRefresh(),
  });

  // ── Drag end handler ─────────────────────────────────────

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedPhotos.findIndex((p) => p.id === active.id);
      const newIndex = sortedPhotos.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sortedPhotos, oldIndex, newIndex);
      const updates = reordered.map((p, i) => ({
        id: p.id,
        displayOrder: i,
      }));
      reorderMutation.mutate(updates);
    },
    [sortedPhotos, reorderMutation],
  );

  // ── Drop zone handlers ──────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const imageFiles = Array.from(files).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (imageFiles.length > 0) uploadAndAdd(imageFiles);
      }
    },
    [uploadAndAdd],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        uploadAndAdd(files);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [uploadAndAdd],
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Camera className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Photos</h3>
        </div>
        <Separator className="mb-4" />

        <p className="text-sm text-muted-foreground mb-4">
          {photoCount} of {MIN_PHOTOS} minimum photos uploaded.
          {photoCount < MIN_PHOTOS && (
            <span className="text-amber-600 ml-1">
              Add at least {MIN_PHOTOS - photoCount} more.
            </span>
          )}
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            }
          `}
        >
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ImagePlus className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drag photos here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, WebP accepted
                </p>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </section>

      {/* Photo grid */}
      {sortedPhotos.length > 0 && (
        <section>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedPhotos.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {sortedPhotos.map((photo) => (
                  <SortablePhoto
                    key={photo.id}
                    photo={photo}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onSetCover={(id) => setCoverMutation.mutate(id)}
                    isDeleting={deletingId === photo.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      )}
    </div>
  );
}
