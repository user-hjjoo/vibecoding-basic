export function imageError(file: File) {
  if (!["image/jpeg", "image/png"].includes(file.type))
    return "JPG 또는 PNG 파일을 선택해 주세요.";
  if (file.size > 10 * 1024 * 1024)
    return "10MB 이하의 이미지를 선택해 주세요.";
  return "";
}

async function prepareImage(file: File, budget: number) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw Error(file.name + " 파일을 이미지로 읽을 수 없어요.");
  });
  let blob: Blob = file;
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale < 1 || file.size > budget) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(Error("이미지를 변환할 수 없어요."))),
          "image/jpeg",
          0.88,
        ),
      );
      if (blob.size > budget) {
        const longest = Math.max(canvas.width, canvas.height);
        const ratio = Math.min(1, Math.max(1200 / longest, Math.sqrt(budget / blob.size) * 0.95));
        canvas.width = Math.max(1, Math.round(canvas.width * ratio));
        canvas.height = Math.max(1, Math.round(canvas.height * ratio));
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(b => b ? resolve(b) : reject(Error("이미지를 변환할 수 없어요.")), "image/jpeg", 0.82)
        );
      }
    }
  } finally {
    bitmap.close();
  }
  if (blob.size > budget)
    throw Error(file.name + " 사진을 더 줄여야 해요. 필요한 부분만 자르거나 첨부 수를 줄여 주세요.");
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(Error("파일을 읽을 수 없어요."));
    r.readAsDataURL(blob);
  });
  return { mimeType: blob.type, data: url.slice(url.indexOf(",") + 1) };
}

export async function prepareImages(files: File[]) {
  const images: { mimeType: string; data: string }[] = [];
  // Process small files first so larger posters can use the remaining bytes.
  const pending = files.map((file, index) => ({ file, index })).sort((a, b) => a.file.size - b.file.size);
  let remaining = 2850000;
  for (const [position, { file, index }] of pending.entries()) {
    const message = imageError(file);
    if (message) throw Error(file.name + " · " + message);
    const budget = Math.min(2500000, Math.floor(remaining / (pending.length - position)));
    const image = await prepareImage(file, budget);
    images[index] = image;
    remaining -= Math.ceil(image.data.length * 3 / 4);
  }
  return images;
}
