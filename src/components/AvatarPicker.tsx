"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/feed/Avatar";

type Props = {
  userId: string;
  currentUrl: string | null;
  displayName: string | null;
  phone: string | null;
  onUploaded: (path: string) => void;
  onError: (msg: string) => void;
  size?: "sm" | "lg" | "xl";
  ctaLabel?: string;
};

const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;
const UPLOAD_FAILED = "Не удалось загрузить фото. Попробуйте ещё раз.";

async function resizeToJpeg(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onerror = () => reject(new Error("image_load_failed"));
    i.onload = () => resolve(i);
    i.src = dataUrl;
  });
  const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_2d_unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob_failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export function AvatarPicker({
  userId,
  currentUrl,
  displayName,
  phone,
  onUploaded,
  onError,
  size = "lg",
  ctaLabel = "Изменить фото",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const blob = await resizeToJpeg(file);
      const path = `${userId}/${Date.now()}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) {
        onError(UPLOAD_FAILED);
        return;
      }
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      if (signed?.signedUrl) setPreviewUrl(signed.signedUrl);
      onUploaded(path);
    } catch {
      onError(UPLOAD_FAILED);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="oz-avatar-picker">
      <button
        type="button"
        className="oz-avatar-picker__target"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={ctaLabel}
      >
        <Avatar url={previewUrl} name={displayName} phone={phone} size={size} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        className="oz-avatar-picker__cta"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Загружаем…" : ctaLabel}
      </button>
    </div>
  );
}
