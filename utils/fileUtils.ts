
export interface FileConversionResult {
  base64: string;
  mimeType: string;
}

export const fileToBase64WithType = (file: File): Promise<FileConversionResult> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("File is null or undefined."));
      return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = () => {
      const result = reader.result as string;
      // result is in the format "data:image/jpeg;base64,XXXX..."
      // We need to extract the mimeType and the base64 data.
      const parts = result.split(',');
      if (parts.length !== 2) {
        reject(new Error("Invalid Data URL format."));
        return;
      }
      
      const header = parts[0];
      const data = parts[1];
      
      const mimeTypeMatch = header.match(/:(.*?);/);
      const mimeType = mimeTypeMatch && mimeTypeMatch[1] ? mimeTypeMatch[1] : file.type; // Fallback to file.type if regex fails

      if (!data) {
        reject(new Error("Base64 data is empty."));
        return;
      }
      if (!mimeType) {
        reject(new Error("Could not determine MimeType."));
        return;
      }

      resolve({ base64: data, mimeType });
    };
    
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      reject(new Error("Failed to read the file."));
    };

    reader.onabort = () => {
        reject(new Error("File reading was aborted."));
    };
  });
};
