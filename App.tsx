
import React, { useState, useCallback, ChangeEvent, useEffect, DragEvent } from 'react';
import { generateDetailedPrompt } from './services/geminiService';
import { fileToBase64WithType, FileConversionResult } from './utils/fileUtils';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { Alert } from './components/Alert';
import { UploadIcon, TextIcon, ClipboardIcon, CheckIcon, SparklesIcon, XCircleIcon, WandSparklesIcon } from './components/Icons';
// Removed import for PromptingGuide

type InputMode = 'image' | 'text';

interface GeneratedPromptItem {
  id: string; // Unique ID for key prop, can be file name + timestamp
  fileName: string; // For image mode, the original file name. For text mode, "Text Concept".
  prompt?: string;
  error?: string;
  isCopied: boolean;
  // Store original input context for refinement
  originalInput: { type: 'image'; file: File } | { type: 'text'; concept: string };
}

const App: React.FC = () => {
  const [inputMode, setInputModeInternal] = useState<InputMode>('image');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textConcept, setTextConcept] = useState<string>('');
  
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPromptItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); // General errors (e.g., file validation)
  const [globalProcessingError, setGlobalProcessingError] = useState<string | null>(null); // Errors during API calls

  const [suggestionsText, setSuggestionsText] = useState<string>('');

  const MAX_FILE_SIZE_MB = 4;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const MAX_FILES_UPLOAD = 10;

  const setInputMode = (mode: InputMode) => {
    setInputModeInternal(mode);
    setSelectedFiles([]);
    setPreviewUrl(null);
    setTextConcept('');
    setGeneratedPrompts([]);
    setError(null);
    setGlobalProcessingError(null);
    setSuggestionsText('');
  };

  const processFiles = useCallback((filesToProcess: FileList | File[]) => {
    if (!filesToProcess || filesToProcess.length === 0) {
      return;
    }

    const newValidFiles: File[] = [];
    const rejectedFilesMessages: string[] = [];
    let currentBatchError: string | null = null;

    Array.from(filesToProcess).forEach(file => {
      if (newValidFiles.length + selectedFiles.length >= MAX_FILES_UPLOAD && !selectedFiles.find(sf => sf.name === file.name && sf.lastModified === file.lastModified)) {
        rejectedFilesMessages.push(`${file.name} (limit of ${MAX_FILES_UPLOAD} files reached)`);
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
    
    setSelectedFiles(prevFiles => {
        const combined = [...prevFiles];
        newValidFiles.forEach(nf => {
            if (!combined.some(ef => ef.name === nf.name && ef.lastModified === nf.lastModified)) {
                combined.push(nf);
            }
        });
        return combined.slice(0, MAX_FILES_UPLOAD);
    });

    if (rejectedFilesMessages.length > 0) {
      currentBatchError = `Some files were not added: ${rejectedFilesMessages.join(', ')}. Max ${MAX_FILES_UPLOAD} files, ${MAX_FILE_SIZE_MB}MB/file, images only.`;
    }
    setError(currentBatchError); 

    setTextConcept('');
    setGeneratedPrompts([]);
    setGlobalProcessingError(null);
    setSuggestionsText('');
  }, [selectedFiles, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_FILES_UPLOAD]);


  useEffect(() => {
    if (selectedFiles.length === 1) {
      const file = selectedFiles[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.onerror = () => {
        setError("Error reading single image file for preview.");
        setPreviewUrl(null);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFiles]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles([]); 
      processFiles(event.target.files);
    }
    if (event.target) {
        event.target.value = ''; 
    }
  };
  
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if (inputMode !== 'image' || isLoading) return;
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
        processFiles(pastedFiles);
        setError(null); 
    }
  }, [inputMode, isLoading, processFiles]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (inputMode !== 'image' || isLoading) return;
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
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
    setSuggestionsText(''); // Clear suggestions when generating new prompts

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
      setError(inputMode === 'image' ? "Please select one or more image files." : "Please enter a text concept.");
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
      // Only refine items that were successful initially
      if (!item.prompt || item.error) {
        return item; // Keep error items as they are
      }

      try {
        let refinedPromptText = '';
        if (item.originalInput.type === 'image') {
          const { base64, mimeType } = await fileToBase64WithType(item.originalInput.file);
          refinedPromptText = await generateDetailedPrompt({ 
            image: { base64, mimeType }, 
            refinementSuggestions: suggestionsText.trim(),
            originalTextConcept: undefined // Not used for image refinement in service
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
    if (refinedPrompts.some(p => p.error && generatedPrompts.find(op => op.id === p.id)?.prompt)) { // Check if a previously successful prompt now has an error
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
    if (inputMode === 'image') return selectedFiles.length > 0;
    if (inputMode === 'text') return textConcept.trim().length > 0;
    return false;
  };

  const hasSuccessfulPrompts = generatedPrompts.some(p => p.prompt && !p.error);
  
  return (
    <div className="min-h-screen bg-zinc-900 text-gray-100 flex flex-col items-center p-4 md:p-8 selection:bg-sky-500 selection:text-white">
      <div className="w-full max-w-3xl space-y-8">
        <header className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Detailed Prompt Generator AI</h1>
          <p className="mt-3 text-lg text-gray-400">
            Craft the perfect prompt for your AI image creations. Refine with suggestions for even better results.
          </p>
        </header>

        <div className="flex justify-center bg-zinc-800 p-1 rounded-lg shadow-md">
          <button
            onClick={() => setInputMode('image')}
            aria-pressed={inputMode === 'image'}
            className={`px-6 py-3 font-medium rounded-md flex items-center gap-2 transition-colors duration-200 ease-in-out
                        ${inputMode === 'image' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <UploadIcon className="w-5 h-5" /> Image Input
          </button>
          <button
            onClick={() => setInputMode('text')}
            aria-pressed={inputMode === 'text'}
            className={`px-6 py-3 font-medium rounded-md flex items-center gap-2 transition-colors duration-200 ease-in-out
                        ${inputMode === 'text' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <TextIcon className="w-5 h-5" /> Text Concept
          </button>
        </div>
        
        {error && <Alert type="warning" message={error} onClose={() => setError(null)} />}
        {globalProcessingError && <Alert type="error" message={globalProcessingError} onClose={() => setGlobalProcessingError(null)} />}

        <div className="bg-zinc-800 p-6 rounded-xl shadow-xl">
          {inputMode === 'image' ? (
            <div 
              className="border-2 border-dashed border-zinc-600 hover:border-sky-500 rounded-lg p-6 md:p-10 text-center cursor-pointer transition-colors duration-200"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('fileInput')?.click()}
              role="button"
              tabIndex={0}
              aria-label="Image upload area: drag and drop or click to select files"
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
              {previewUrl && selectedFiles.length === 1 ? (
                <img src={previewUrl} alt="Selected preview" className="max-h-60 w-auto mx-auto rounded-md shadow-md mb-4 object-contain" />
              ) : selectedFiles.length > 0 ? (
                 <div className="mb-4 text-left">
                    <h3 className="font-semibold text-sky-400 mb-2">Selected Files ({selectedFiles.length}/{MAX_FILES_UPLOAD}):</h3>
                    <ul className="list-disc list-inside text-gray-300 max-h-40 overflow-y-auto space-y-1 text-sm pretty-scrollbar pr-2">
                        {selectedFiles.map(file => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}
                    </ul>
                 </div>
              ) : (
                <UploadIcon className="w-16 h-16 text-zinc-500 mx-auto mb-4" />
              )}
              <p className="text-gray-400">
                {selectedFiles.length > 0 && selectedFiles.length < MAX_FILES_UPLOAD ? `Add more or ` : ''}
                Drag & drop images here, or click to browse.
              </p>
              <p className="text-xs text-zinc-500 mt-1">Max {MAX_FILES_UPLOAD} files, {MAX_FILE_SIZE_MB}MB per image. PNG, JPG, GIF, WEBP.</p>
              {selectedFiles.length > 0 && (
                <Button variant="secondary" onClick={(e) => { e.stopPropagation(); clearSelectedFiles(); }} className="mt-4 text-sm !py-1.5 !px-3">
                    <XCircleIcon className="w-4 h-4" /> Clear Selection
                </Button>
              )}
            </div>
          ) : (
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
            aria-label={inputMode === 'image' ? "Generate detailed prompts from selected images" : "Generate detailed prompt from text concept"}
          >
            {isLoading && generatedPrompts.length === 0 ? <Spinner /> : <SparklesIcon className="w-5 h-5"/>}
            Generate Detailed Prompt{selectedFiles.length > 1 ? 's' : ''}
          </Button>
        </div>

        {generatedPrompts.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-sky-400">Generated Prompt{generatedPrompts.length > 1 ? 's' : ''}</h2>
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
              Refine Prompt{generatedPrompts.filter(p=>p.prompt && !p.error).length > 1 ? 's' : ''} with Suggestions
            </Button>
          </div>
        )}

        {/* PromptingGuide component removed from here */}

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
          background: rgba(55, 65, 81, 0.5); /* gray-700 with opacity */
          border-radius: 3px;
        }
        .pretty-scrollbar::-webkit-scrollbar-thumb {
          background: #38bdf8; /* sky-500 */
          border-radius: 3px;
        }
        .pretty-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0ea5e9; /* sky-600 */
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
