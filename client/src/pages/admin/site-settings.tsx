import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { Upload, Trash2, ImageIcon, Save, Loader2 } from "lucide-react";

export default function SiteSettings() {
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Record<string, string>>("/admin/site-settings")
      .then((settings) => {
        setHeroImageUrl(settings.hero_image_url || "");
        setHeroTitle(settings.hero_title || "");
        setHeroSubtitle(settings.hero_subtitle || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      setHeroImageUrl(data.url);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    setHeroImageUrl("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put("/admin/site-settings", {
        hero_image_url: heroImageUrl,
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="text-muted-foreground mt-1">Manage the public homepage appearance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hero Section</CardTitle>
          <CardDescription>
            Configure the hero banner displayed on the homepage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hero Image */}
          <div className="space-y-3">
            <Label>Hero Image</Label>
            {heroImageUrl ? (
              <div className="relative rounded-lg overflow-hidden border bg-muted">
                <img
                  src={heroImageUrl}
                  alt="Hero preview"
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
                {/* Preview overlay with title/subtitle */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <p className="text-white font-bold text-2xl drop-shadow-lg">
                    {heroTitle || "Find Your Perfect Stay"}
                  </p>
                  <p className="text-white/80 text-sm mt-2 drop-shadow">
                    {heroSubtitle || "Discover premium short-term rental properties across the UAE"}
                  </p>
                </div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span className="ml-1">Replace</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleRemoveImage}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">Click to upload hero image</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 1920x800px or wider. JPG, PNG, or WebP.
                </p>
                {uploading && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {/* Hero Title */}
          <div className="space-y-2">
            <Label htmlFor="heroTitle">Hero Title</Label>
            <Input
              id="heroTitle"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder="Find Your Perfect Stay"
            />
          </div>

          {/* Hero Subtitle */}
          <div className="space-y-2">
            <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
            <Input
              id="heroSubtitle"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Discover premium short-term rental properties across the UAE"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">Saved successfully</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
