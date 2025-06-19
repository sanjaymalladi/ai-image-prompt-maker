
export interface FileConversionResult {
  base64: string;
  mimeType: string;
}

export const fileToBase64WithType = (file: File): Promise<FileConversionResult> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("File object is null or undefined. Cannot process."));
      return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = () => {
      const result = reader.result as string;
      const parts = result.split(',');
      if (parts.length !== 2) {
        reject(new Error(`Invalid Data URL format for file "${file.name}".`));
        return;
      }
      
      const header = parts[0];
      const data = parts[1];
      
      const mimeTypeMatch = header.match(/:(.*?);/);
      const mimeType = mimeTypeMatch && mimeTypeMatch[1] ? mimeTypeMatch[1] : file.type;

      if (!data) {
        reject(new Error(`Base64 data is empty for file "${file.name}".`));
        return;
      }
      if (!mimeType) {
        reject(new Error(`Could not determine MimeType for file "${file.name}".`));
        return;
      }

      resolve({ base64: data, mimeType });
    };
    
    reader.onerror = (event) => {
      const fr = event.target as FileReader;
      const domException = fr.error; // This is a DOMException
      let errorMessage = `Failed to read the file "${file.name}".`;
      if (domException) {
        errorMessage += ` Reason: ${domException.name} - ${domException.message}`;
      } else {
        errorMessage += ` Unknown FileReader error.`;
      }
      console.error(`FileReader error for file "${file.name}":`, domException || event);
      reject(new Error(errorMessage));
    };

    reader.onabort = () => {
        reject(new Error(`File reading was aborted for "${file.name}".`));
    };
  });
};