/**
 * 图片上传：优先上传到 Supabase Storage（需在 Supabase 后台创建公开 bucket「images」），
 * 失败则退回为 Data URL 内联到文档（无需配置，但文档会变大）。
 */
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'images';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File, documentId?: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ? ext : 'png';
    const path = documentId
      ? `${user.id}/${documentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`
      : `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || `image/${safeExt}`,
      upsert: false,
    });

    if (!error && data?.path) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      return publicUrl;
    }
    // 未配置 bucket 或权限不足时静默回退到 Data URL，不抛错
  }

  return fileToDataUrl(file);
}
