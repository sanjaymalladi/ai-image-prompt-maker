
import React, { useState, useCallback, ChangeEvent, useEffect, DragEvent } from 'react';
import { generateDetailedPrompt } from './services/geminiService';
import { fileToBase64WithType, FileConversionResult } from './utils/fileUtils';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { Alert } from './components/Alert';
import { UploadIcon, TextIcon, ClipboardIcon, CheckIcon, SparklesIcon, XCircleIcon, WandSparklesIcon, SquaresPlusIcon } from './components/Icons';

type InputMode = 'image' | 'text' | 'imageFusion';

interface GeneratedPromptItem {
  id: string; 
  fileName: string; 
  prompt?: string;
  error?: string;
  isCopied: boolean;
  originalInput: 
    | { type: 'image'; file: File } 
    | { type: 'text'; concept: string }
    | { type: 'imageFusion'; files: File[] };
}

const App: React.FC = () => {
  const [inputMode, setInputModeInternal] = useState<InputMode>('image');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // For single image preview in 'image' mode
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); // For 'imageFusion' thumbnails

  const [textConcept, setTextConcept] = useState<string>('');
  
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPromptItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); 
  const [globalProcessingError, setGlobalProcessingError] = useState<string | null>(null);

  const [suggestionsText, setSuggestionsText] = useState<string>('');

  const MAX_FILE_SIZE_MB = 4;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  
  // Limits for 'image' mode (batch)
  const MAX_FILES_BATCH_UPLOAD = 10;

  // Limits for 'imageFusion' mode
  const MIN_FILES_FUSION = 2;
  const MAX_FILES_FUSION = 5;


  const resetCommonStates = () => {
    setSelectedFiles([]);
    setPreviewUrl(null);
    setImagePreviews([]);
    setTextConcept('');
    setGeneratedPrompts([]);
    setError(null);
    setGlobalProcessingError(null);
    setSuggestionsText('');
  }

  const setInputMode = (mode: InputMode) => {
    setInputModeInternal(mode);
    resetCommonStates();
  };

  const processFiles = useCallback((filesToProcess: FileList | File[]) => {
    if (!filesToProcess || filesToProcess.length === 0) {
      return;
    }

    let currentMaxFiles = inputMode === 'imageFusion' ? MAX_FILES_FUSION : MAX_FILES_BATCH_UPLOAD;
    const newValidFiles: File[] = [];
    const rejectedFilesMessages: string[] = [];
    let currentBatchError: string | null = null;

    Array.from(filesToProcess).forEach(file => {
      // For fusion mode, a new selection replaces old ones.
      // For image batch, this logic allows adding to existing selection (though current UI replaces).
      const currentFileCount = inputMode === 'imageFusion' ? newValidFiles.length : newValidFiles.length + selectedFiles.length;

      if (currentFileCount >= currentMaxFiles && (inputMode === 'imageFusion' || !selectedFiles.find(sf => sf.name === file.name && sf.lastModified === file.lastModified))) {
        rejectedFilesMessages.push(`${file.name} (limit of ${currentMaxFiles} files for this mode)`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejectedFilesMessages.push(`${file.name} (exceeds ${MAX_FILE_SIZE_MB}MB)`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        rejectedFilesMessages.push(`${file.name} (invalid type, not an image)`);
        return;
      }
      newValidFiles.push(file);
    });
    
    // In fusion mode, new selection always replaces old.
    // In image (batch) mode, it also replaces (as per handleFileChange behavior)
    setSelectedFiles(newValidFiles.slice(0, currentMaxFiles));

    if (rejectedFilesMessages.length > 0) {
      currentBatchError = `Some files were not added: ${rejectedFilesMessages.join(', ')}. Max ${currentMaxFiles} files, ${MAX_FILE_SIZE_MB}MB/file, images only.`;
    }
    setError(currentBatchError); 

    setTextConcept('');
    setGeneratedPrompts([]);
    setGlobalProcessingError(null);
    setSuggestionsText('');
  }, [selectedFiles, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_FILES_BATCH_UPLOAD, inputMode, MIN_FILES_FUSION, MAX_FILES_FUSION]);


  useEffect(() => {
    // Single image preview for 'image' mode
    if (inputMode === 'image' && selectedFiles.length === 1) {
      const file = selectedFiles[0];
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.onerror = () => { setError("Error reading image for preview."); setPreviewUrl(null); };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }

    // Thumbnails for 'imageFusion' mode
    if (inputMode === 'imageFusion' && selectedFiles.length > 0) {
      const filePromises = selectedFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        });
      });
      Promise.all(filePromises)
        .then(setImagePreviews)
        .catch(err => {
          console.error("Error reading files for fusion preview:", err);
          setError("Error creating previews for fusion images.");
          setImagePreviews([]);
        });
    } else {
      setImagePreviews([]);
    }
  }, [selectedFiles, inputMode]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // Always reset selection for a new dialog choice
      setSelectedFiles([]); 
      setImagePreviews([]);
      setPreviewUrl(null);
      processFiles(event.target.files);
    }
    if (event.target) {
        event.target.value = ''; 
    }
  };
  
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if ((inputMode !== 'image' && inputMode !== 'imageFusion') || isLoading) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          event.preventDefault(); 
          const extension = blob.type.split('/')[1] || 'png';
          const fileName = `pasted-image-${Date.now()}-${i}.${extension}`;
          const file = new File([blob], fileName, { type: blob.type });
          pastedFiles.push(file);
        }
      }
    }
    if (pastedFiles.length > 0) {
        // For paste, we usually want to add to current selection if in batch mode, or replace if fusion (processFiles handles replace for fusion)
        // However, current processFiles always replaces. If additive paste is desired for batch mode, processFiles logic needs change.
        // For now, consistent replacement.
        setSelectedFiles([]); 
        setImagePreviews([]);
        setPreviewUrl(null);
        processFiles(pastedFiles);
        setError(null); 
    }
  }, [inputMode, isLoading, processFiles]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if ((inputMode !== 'image' && inputMode !== 'imageFusion') || isLoading) return;
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      setSelectedFiles([]); 
      setImagePreviews([]);
      setPreviewUrl(null);
      processFiles(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  }, [inputMode, processFiles, isLoading]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setPreviewUrl(null);
    setImagePreviews([]);
    setGeneratedPrompts([]);
    setError(null);
    setGlobalProcessingError(null);
    setSuggestionsText('');
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setGeneratedPrompts([]);
    setError(null);
    setGlobalProcessingError(null);
    setSuggestionsText(''); 

    if (inputMode === 'image' && selectedFiles.length > 0) {
      const newPromptsPromises = selectedFiles.map(async (file) => {
        const itemId = `${file.name}-${Date.now()}`;
        try {
          const { base64, mimeType } = await fileToBase64WithType(file);
          const promptText = await generateDetailedPrompt({ image: { base64, mimeType } });
          return { id: itemId, fileName: file.name, prompt: promptText, isCopied: false, originalInput: { type: 'image' as 'image', file } };
        } catch (err: any) {
          console.error(`Error processing file ${file.name}:`, err);
          return { id: itemId, fileName: file.name, error: err.message || `Failed to generate prompt for ${file.name}.`, isCopied: false, originalInput: { type: 'image' as 'image', file } };
        }
      });
      const newPrompts = await Promise.all(newPromptsPromises);
      setGeneratedPrompts(newPrompts);
      if (newPrompts.some(p => p.error)) {
        setGlobalProcessingError("Some images could not be processed. See details below.");
      }
    } else if (inputMode === 'imageFusion' && selectedFiles.length >= MIN_FILES_FUSION && selectedFiles.length <= MAX_FILES_FUSION) {
        const itemId = `fusion-${Date.now()}`;
        const filesToFuse = [...selectedFiles]; // Make a copy
        try {
            const imageInputs = await Promise.all(filesToFuse.map(async (file) => {
                const { base64, mimeType } = await fileToBase64WithType(file);
                return { base64, mimeType };
            }));
            const promptText = await generateDetailedPrompt({ images: imageInputs });
            setGeneratedPrompts([{ id: itemId, fileName: 'Fused Prompt', prompt: promptText, isCopied: false, originalInput: { type: 'imageFusion', files: filesToFuse } }]);
        } catch (err: any) {
            console.error("Error generating fused prompt:", err);
            setGeneratedPrompts([{ id: itemId, fileName: 'Fused Prompt', error: err.message || "Failed to generate fused prompt.", isCopied: false, originalInput: { type: 'imageFusion', files: filesToFuse } }]);
            setGlobalProcessingError(err.message || "Failed to generate fused prompt.");
        }
    } else if (inputMode === 'text' && textConcept.trim() !== '') {
      const itemId = `text-${Date.now()}`;
      const currentTextConcept = textConcept.trim();
      try {
        const promptText = await generateDetailedPrompt({ textConcept: currentTextConcept });
        setGeneratedPrompts([{ id: itemId, fileName: 'Text Concept', prompt: promptText, isCopied: false, originalInput: { type: 'text' as 'text', concept: currentTextConcept } }]);
      } catch (err: any) {
        console.error("Error generating prompt from text concept:", err);
        setGeneratedPrompts([{ id: itemId, fileName: 'Text Concept', error: err.message || "Failed to generate prompt from text concept.", isCopied: false, originalInput: { type: 'text' as 'text', concept: currentTextConcept } }]);
        setGlobalProcessingError(err.message || "Failed to generate prompt from text concept.");
      }
    } else {
      if (inputMode === 'image') setError("Please select one or more image files.");
      else if (inputMode === 'imageFusion') setError(`Please select ${MIN_FILES_FUSION} to ${MAX_FILES_FUSION} images for fusion.`);
      else setError("Please enter a text concept.");
    }
    setIsLoading(false);
  };

  const handleRefinePrompts = async () => {
    if (suggestionsText.trim() === '' || generatedPrompts.filter(p => p.prompt && !p.error).length === 0) {
      setError("Please enter suggestions to refine the prompt(s). Ensure there are successfully generated prompts to refine.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setGlobalProcessingError(null);

    const refinementPromises = generatedPrompts.map(async (item) => {
      if (!item.prompt || item.error) {
        return item; 
      }

      try {
        let refinedPromptText = '';
        if (item.originalInput.type === 'image') {
          const { base64, mimeType } = await fileToBase64WithType(item.originalInput.file);
          refinedPromptText = await generateDetailedPrompt({ 
            image: { base64, mimeType }, 
            refinementSuggestions: suggestionsText.trim()
          });
        } else if (item.originalInput.type === 'imageFusion') {
            const imageInputs = await Promise.all(item.originalInput.files.map(async (file) => {
                const { base64, mimeType } = await fileToBase64WithType(file);
                return { base64, mimeType };
            }));
            refinedPromptText = await generateDetailedPrompt({
                images: imageInputs,
                refinementSuggestions: suggestionsText.trim()
            });
        } else if (item.originalInput.type === 'text') {
          refinedPromptText = await generateDetailedPrompt({ 
            textConcept: item.originalInput.concept, 
            refinementSuggestions: suggestionsText.trim() 
          });
        }
        return { ...item, prompt: refinedPromptText, error: undefined, isCopied: false };
      } catch (err: any) {
        console.error(`Error refining prompt for ${item.fileName}:`, err);
        return { ...item, error: err.message || `Failed to refine prompt for ${item.fileName}.`, isCopied: false };
      }
    });

    const refinedPrompts = await Promise.all(refinementPromises);
    setGeneratedPrompts(refinedPrompts);
    if (refinedPrompts.some(p => p.error && generatedPrompts.find(op => op.id === p.id)?.prompt)) { 
      setGlobalProcessingError("Some prompts could not be refined. See details below.");
    }
    setIsLoading(false);
  };


  const handleCopyToClipboard = (itemId: string) => {
    const promptItem = generatedPrompts.find(p => p.id === itemId);
    if (promptItem && promptItem.prompt) {
      navigator.clipboard.writeText(promptItem.prompt)
        .then(() => {
          setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: true } : p));
          setTimeout(() => {
            setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: false } : p));
          }, 2000);
        })
        .catch(err => {
          console.error("Failed to copy prompt:", err);
          setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, error: (p.error || "") + " Copy failed." } : p));
        });
    }
  };

  const canSubmit = (): boolean => {
    if (isLoading) return false;
    if (inputMode === 'image') return selectedFiles.length > 0 && selectedFiles.length <= MAX_FILES_BATCH_UPLOAD;
    if (inputMode === 'imageFusion') return selectedFiles.length >= MIN_FILES_FUSION && selectedFiles.length <= MAX_FILES_FUSION;
    if (inputMode === 'text') return textConcept.trim().length > 0;
    return false;
  };

  const hasSuccessfulPrompts = generatedPrompts.some(p => p.prompt && !p.error);
  
  const getUploadAreaMessage = () => {
    if (inputMode === 'imageFusion') {
      if (selectedFiles.length > 0 && selectedFiles.length < MIN_FILES_FUSION) {
        return `Need ${MIN_FILES_FUSION - selectedFiles.length} more image(s) for fusion. (Min ${MIN_FILES_FUSION}, Max ${MAX_FILES_FUSION})`;
      }
      return `Drag & drop ${MIN_FILES_FUSION}-${MAX_FILES_FUSION} images, or click.`;
    }
    // Default for 'image' mode
    return `${selectedFiles.length > 0 && selectedFiles.length < MAX_FILES_BATCH_UPLOAD ? `Add more or ` : ''}Drag & drop images, or click.`;
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-gray-100 flex flex-col items-center p-4 md:p-8 selection:bg-sky-500 selection:text-white">
      <div className="w-full max-w-3xl space-y-8">
        <header className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Detailed Prompt Generator AI</h1>
          <p className="mt-3 text-lg text-gray-400">
            Craft the perfect prompt. Use single images, fuse multiple, or start with a text concept. Refine with suggestions.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row justify-center bg-zinc-800 p-1 rounded-lg shadow-md gap-1">
          <button
            onClick={() => setInputMode('image')}
            aria-pressed={inputMode === 'image'}
            className={`flex-1 sm:flex-auto px-4 py-3 font-medium rounded-md flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out
                        ${inputMode === 'image' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <UploadIcon className="w-5 h-5" /> Image Batch
          </button>
          <button
            onClick={() => setInputMode('imageFusion')}
            aria-pressed={inputMode === 'imageFusion'}
            className={`flex-1 sm:flex-auto px-4 py-3 font-medium rounded-md flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out
                        ${inputMode === 'imageFusion' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <SquaresPlusIcon className="w-5 h-5" /> Image Fusion
          </button>
          <button
            onClick={() => setInputMode('text')}
            aria-pressed={inputMode === 'text'}
            className={`flex-1 sm:flex-auto px-4 py-3 font-medium rounded-md flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out
                        ${inputMode === 'text' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <TextIcon className="w-5 h-5" /> Text Concept
          </button>
        </div>
        
        {error && <Alert type="warning" message={error} onClose={() => setError(null)} />}
        {globalProcessingError && <Alert type="error" message={globalProcessingError} onClose={() => setGlobalProcessingError(null)} />}

        <div className="bg-zinc-800 p-6 rounded-xl shadow-xl">
          {inputMode === 'image' || inputMode === 'imageFusion' ? (
            <div 
              className="border-2 border-dashed border-zinc-600 hover:border-sky-500 rounded-lg p-6 md:p-10 text-center cursor-pointer transition-colors duration-200"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('fileInput')?.click()}
              role="button"
              tabIndex={0}
              aria-label={`Image upload area: ${inputMode === 'imageFusion' ? `drag and drop ${MIN_FILES_FUSION}-${MAX_FILES_FUSION} images or click` : 'drag and drop or click to select files'}`}
            >
              <input
                type="file"
                id="fileInput"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
              />
              {inputMode === 'image' && previewUrl && selectedFiles.length === 1 ? (
                <img src={previewUrl} alt="Selected preview" className="max-h-60 w-auto mx-auto rounded-md shadow-md mb-4 object-contain" />
              ) : inputMode === 'image' && selectedFiles.length > 0 ? (
                 <div className="mb-4 text-left">
                    <h3 className="font-semibold text-sky-400 mb-2">Selected Files ({selectedFiles.length}/{MAX_FILES_BATCH_UPLOAD}):</h3>
                    <ul className="list-disc list-inside text-gray-300 max-h-40 overflow-y-auto space-y-1 text-sm pretty-scrollbar pr-2">
                        {selectedFiles.map(file => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}
                    </ul>
                 </div>
              ) : inputMode === 'imageFusion' && imagePreviews.length > 0 ? (
                <div className="mb-4">
                  <h3 className="font-semibold text-sky-400 mb-2 text-left">Selected Images for Fusion ({imagePreviews.length}/{MAX_FILES_FUSION}):</h3>
                  <div className="flex flex-wrap justify-center gap-2 max-h-60 overflow-y-auto pretty-scrollbar p-1">
                    {imagePreviews.map((src, index) => (
                      <img key={index} src={src} alt={`Fusion preview ${index + 1}`} className="h-20 w-20 object-cover rounded-md shadow-md border border-zinc-700" />
                    ))}
                  </div>
                </div>
              ) : (
                 <div className="flex flex-col items-center">
                    {inputMode === 'imageFusion' ? <SquaresPlusIcon className="w-16 h-16 text-zinc-500 mx-auto mb-4" /> : <UploadIcon className="w-16 h-16 text-zinc-500 mx-auto mb-4" /> }
                 </div>
              )}
              <p className="text-gray-400">{getUploadAreaMessage()}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {inputMode === 'imageFusion' 
                  ? `Min ${MIN_FILES_FUSION}, Max ${MAX_FILES_FUSION} images. ` 
                  : `Max ${MAX_FILES_BATCH_UPLOAD} files. `}
                {MAX_FILE_SIZE_MB}MB per image. PNG, JPG, GIF, WEBP.
              </p>
              {selectedFiles.length > 0 && (
                <Button variant="secondary" onClick={(e) => { e.stopPropagation(); clearSelectedFiles(); }} className="mt-4 text-sm !py-1.5 !px-3">
                    <XCircleIcon className="w-4 h-4" /> Clear Selection
                </Button>
              )}
            </div>
          ) : ( // Text mode
            <textarea
              value={textConcept}
              onChange={(e) => setTextConcept(e.target.value)}
              placeholder="e.g., A futuristic cityscape at sunset, neon lights reflecting on wet streets, a lone figure walking towards a massive skyscraper..."
              className="w-full h-40 p-4 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 resize-none placeholder-zinc-500 pretty-scrollbar"
              aria-label="Text concept input"
            />
          )}

          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit()}
            className="w-full mt-6 text-lg"
            aria-label={
                inputMode === 'image' ? "Generate detailed prompts from selected images" :
                inputMode === 'imageFusion' ? "Generate single fused prompt from selected images" :
                "Generate detailed prompt from text concept"
            }
          >
            {isLoading && generatedPrompts.length === 0 ? <Spinner /> : <SparklesIcon className="w-5 h-5"/>}
            {inputMode === 'imageFusion' 
                ? 'Generate Fused Prompt' 
                : `Generate Detailed Prompt${inputMode === 'image' && selectedFiles.length > 1 ? 's' : ''}`
            }
          </Button>
        </div>

        {generatedPrompts.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-sky-400">
                {inputMode === 'imageFusion' ? 'Generated Fused Prompt' : `Generated Prompt${generatedPrompts.length > 1 ? 's' : ''}`}
            </h2>
            {generatedPrompts.map((item) => (
              <div key={item.id} className="bg-zinc-800 p-5 rounded-lg shadow-lg">
                <h3 className="font-medium text-gray-300 mb-1">{item.fileName}</h3>
                {item.error ? (
                  <Alert type="error" message={item.error} />
                ) : item.prompt ? (
                  <div className="space-y-3">
                    <p className="text-gray-200 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-60 overflow-y-auto">
                      {item.prompt}
                    </p>
                    <Button 
                        onClick={() => handleCopyToClipboard(item.id)}
                        variant="secondary" 
                        className="w-full sm:w-auto text-sm !py-2 !px-4"
                        aria-label={`Copy prompt for ${item.fileName} to clipboard`}
                    >
                      {item.isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                      {item.isCopied ? 'Copied!' : 'Copy to Clipboard'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {hasSuccessfulPrompts && (
          <div className="bg-zinc-800 p-6 rounded-xl shadow-xl mt-8">
            <h2 className="text-xl font-semibold text-sky-400 mb-3">Refine with Suggestions</h2>
            <textarea
              value={suggestionsText}
              onChange={(e) => setSuggestionsText(e.target.value)}
              placeholder="e.g., Make it more whimsical, change lighting to sunset, add a dragon..."
              className="w-full h-28 p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 resize-none placeholder-zinc-500 pretty-scrollbar"
              aria-label="Suggestions for refining prompts"
              disabled={isLoading}
            />
            <Button
              onClick={handleRefinePrompts}
              disabled={isLoading || suggestionsText.trim() === ''}
              className="w-full mt-4 text-lg"
              aria-label="Refine generated prompts with the provided suggestions"
            >
              {isLoading && suggestionsText.trim() !== '' ? <Spinner /> : <WandSparklesIcon className="w-5 h-5" />}
              Refine Prompt{generatedPrompts.filter(p=>p.prompt && !p.error).length > 1 && inputMode !== 'imageFusion' ? 's' : ''} with Suggestions
            </Button>
          </div>
        )}

      </div>
       <footer className="w-full max-w-3xl mt-12 mb-8 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Detailed Prompt Generator AI. Powered by Gemini.</p>
      </footer>
       <style>{`
        .pretty-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .pretty-scrollbar::-webkit-scrollbar-track {
          background: rgba(55, 65, 81, 0.5); 
          border-radius: 3px;
        }
        .pretty-scrollbar::-webkit-scrollbar-thumb {
          background: #38bdf8; 
          border-radius: 3px;
        }
        .pretty-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0ea5e9; 
        }
        .pretty-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #38bdf8 rgba(55, 65, 81, 0.5);
        }
      `}</style>
    </div>
  );
};

export default App;
