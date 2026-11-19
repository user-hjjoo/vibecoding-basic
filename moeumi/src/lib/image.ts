export async function prepareImage(file: File) {
  if (!["image/jpeg", "image/png"].includes(file.type))
    throw Error("JPG 또는 PNG 파일을 선택해 주세요.");
  if (file.size > 10 * 1024 * 1024)
    throw Error("10MB 이하의 이미지를 선택해 주세요.");
  const bitmap = await createImageBitmap(file);
  let blob: Blob = file;
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale < 1 || file.size > 2500000) {
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
    }
  } finally {
    bitmap.close();
  }
  if (blob.size > 2500000)
    throw Error("이미지를 나누거나 필요한 부분만 잘라 다시 첨부해 주세요.");
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(Error("파일을 읽을 수 없어요."));
    r.readAsDataURL(blob);
  });
  return { mimeType: blob.type, data: url.slice(url.indexOf(",") + 1) };
}
