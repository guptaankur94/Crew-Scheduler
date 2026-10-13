/** Preparing roster files for the reader: the file's type, and images scaled to at most 2400 px as JPEG. */

/** The file's type, from the browser or else from its name. */
export const determineMimeType = (file: File): string => {
  if (file.type && file.type !== 'image/jpg') {
    return file.type;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  return 'image/png';
};

/** Reads a file for the reader: PDFs as they are; images scaled down to 2400 px and sent as JPEG. */
export const prepareFileForUpload = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve) => {
    const mime = determineMimeType(file);

    // If PDF, read directly
    if (mime === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ base64Data: e.target?.result as string, mimeType: 'application/pdf' });
      reader.onerror = () => resolve({ base64Data: '', mimeType: 'application/pdf' });
      reader.readAsDataURL(file);
      return;
    }

    // For images, load into an Image element and optimize resolution via canvas
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const maxDim = 2400;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.92);
          resolve({ base64Data: optimizedBase64, mimeType: 'image/jpeg' });
          return;
        }
      } catch {
        // Canvas failed, fallback to raw base64
      }

      // Fallback: read directly
      const reader = new FileReader();
      reader.onload = (e) => resolve({ base64Data: e.target?.result as string, mimeType: mime });
      reader.readAsDataURL(file);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = (e) => resolve({ base64Data: e.target?.result as string, mimeType: mime });
      reader.readAsDataURL(file);
    };

    img.src = url;
  });
};
