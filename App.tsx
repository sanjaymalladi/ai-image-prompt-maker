
import React, { useState, useCallback, ChangeEvent, useEffect, DragEvent } from 'react';
import { generateDetailedPrompt, generateCharacterSheetPrompts, refineCharacterSheetPrompts, generateFashionAnalysisAndInitialJsonPrompt, performQaAndGenerateStudioPrompts } from './services/geminiService';
import { fileToBase64WithType, FileConversionResult } from './utils/fileUtils';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { Alert } from './components/Alert';
import { UploadIcon, TextIcon, ClipboardIcon, CheckIcon, SparklesIcon, XCircleIcon, WandSparklesIcon, SquaresPlusIcon, UserCircleIcon, ShirtIcon } from './components/Icons';


type InputMode = 'image' | 'text' | 'imageFusion' | 'characterSheet' | 'fashionPrompt';

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

interface CharacterSheetPromptItem {
  id: string;
  title: string;
  prompt: string;
  isCopied: boolean;
  error?: string;
}

export interface FashionPromptData { // Exported for use in geminiService
  garmentAnalysis: string;
  qaChecklist: string;
  initialJsonPrompt: string;
}

interface RefinedStudioPromptItem { // Now also used for Lifestyle prompts
  id: string;
  title: string;
  prompt: string;
  isCopied: boolean;
  error?: string;
}


const App: React.FC = () => {
  const [inputMode, setInputModeInternal] = useState<InputMode>('image');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [textConcept, setTextConcept] = useState<string>('');
  
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPromptItem[]>([]);
  const [characterSheetPrompts, setCharacterSheetPrompts] = useState<CharacterSheetPromptItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); 
  const [globalProcessingError, setGlobalProcessingError] = useState<string | null>(null);

  const [suggestionsText, setSuggestionsText] = useState<string>('');
  const [crazyShotBackgroundIdea, setCrazyShotBackgroundIdea] = useState<string>('');
  const [characterSheetSuggestionsText, setCharacterSheetSuggestionsText] = useState<string>('');
  const [characterSheetImageInput, setCharacterSheetImageInput] = useState<FileConversionResult | null>(null);

  // State for Fashion Prompting Mode
  const [fashionGarmentFiles, setFashionGarmentFiles] = useState<File[]>([]);
  const [fashionGarmentPreviewUrls, setFashionGarmentPreviewUrls] = useState<string[]>([]);
  const [fashionIsLoadingAnalysis, setFashionIsLoadingAnalysis] = useState<boolean>(false);
  const [fashionAnalysisError, setFashionAnalysisError] = useState<string | null>(null);
  const [fashionPromptData, setFashionPromptData] = useState<FashionPromptData | null>(null);
  const [fashionInitialJsonPromptCopied, setFashionInitialJsonPromptCopied] = useState<boolean>(false);
  
  const [generatedFashionImageFile, setGeneratedFashionImageFile] = useState<File | null>(null);
  const [generatedFashionImagePreviewUrl, setGeneratedFashionImagePreviewUrl] = useState<string | null>(null);
  const [fashionQaIsLoading, setFashionQaIsLoading] = useState<boolean>(false);
  const [fashionQaError, setFashionQaError] = useState<string | null>(null);
  const [refinedStudioPrompts, setRefinedStudioPrompts] = useState<RefinedStudioPromptItem[] | null>(null);


  const MAX_FILE_SIZE_MB = 4;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  
  const MAX_FILES_BATCH_UPLOAD = 10;
  const MIN_FILES_FUSION = 2;
  const MAX_FILES_FUSION = 5;
  const MAX_FILES_CHARACTER_SHEET = 1;
  const MAX_FILES_FASHION_PROMPT = 2; // Can be 1 or 2


  const resetCommonStates = () => {
    setSelectedFiles([]);
    setPreviewUrl(null);
    setImagePreviews([]);
    setTextConcept('');
    setGeneratedPrompts([]);
    setCharacterSheetPrompts([]);
    setError(null);
    setGlobalProcessingError(null);
    setSuggestionsText('');
    setCrazyShotBackgroundIdea('');
    setCharacterSheetSuggestionsText('');
    setCharacterSheetImageInput(null);
    
    // Reset fashion states
    setFashionGarmentFiles([]);
    setFashionGarmentPreviewUrls([]);
    setFashionIsLoadingAnalysis(false);
    setFashionAnalysisError(null);
    setFashionPromptData(null);
    setFashionInitialJsonPromptCopied(false);
    setGeneratedFashionImageFile(null);
    setGeneratedFashionImagePreviewUrl(null);
    setFashionQaIsLoading(false);
    setFashionQaError(null);
    setRefinedStudioPrompts(null);
  }

  const setInputMode = (mode: InputMode) => {
    setInputModeInternal(mode);
    resetCommonStates();
  };

  const processFiles = useCallback(async (filesToProcess: FileList | File[]) => {
    if (!filesToProcess || filesToProcess.length === 0) {
      return;
    }

    let currentMaxFiles;
    if (inputMode === 'imageFusion') {
        currentMaxFiles = MAX_FILES_FUSION;
    } else if (inputMode === 'characterSheet') {
        currentMaxFiles = MAX_FILES_CHARACTER_SHEET;
    } else if (inputMode === 'fashionPrompt') {
        currentMaxFiles = MAX_FILES_FASHION_PROMPT;
    }
     else { // image mode
        currentMaxFiles = MAX_FILES_BATCH_UPLOAD;
    }
    
    const newValidFiles: File[] = [];
    const rejectedFilesMessages: string[] = [];
    let currentBatchError: string | null = null;

    Array.from(filesToProcess).forEach(file => {
      const currentFileCountForRejectionCheck = inputMode === 'fashionPrompt' || inputMode === 'characterSheet' || inputMode === 'imageFusion'
                                          ? newValidFiles.length
                                          : selectedFiles.length + newValidFiles.length;


      if (currentFileCountForRejectionCheck >= currentMaxFiles &&
          (inputMode === 'fashionPrompt' || inputMode === 'characterSheet' || inputMode === 'imageFusion' || !selectedFiles.find(sf => sf.name === file.name && sf.lastModified === file.lastModified))
      ) {
         if(!(inputMode === 'image' && currentFileCountForRejectionCheck < currentMaxFiles)) { 
            rejectedFilesMessages.push(`${file.name} (limit of ${currentMaxFiles} file${currentMaxFiles > 1 ? 's' : ''} for this mode reached)`);
            return;
        }
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
    
    if (inputMode === 'fashionPrompt') {
        setFashionGarmentFiles(newValidFiles.slice(0, MAX_FILES_FASHION_PROMPT)); 
    } else {
        const combinedFiles = (inputMode === 'image' && (event?.target as HTMLInputElement)?.multiple) 
                                ? [...selectedFiles, ...newValidFiles].slice(0, currentMaxFiles) 
                                : newValidFiles.slice(0, currentMaxFiles);
        setSelectedFiles(combinedFiles);
    }


    if (rejectedFilesMessages.length > 0) {
      currentBatchError = `Some files were not added: ${rejectedFilesMessages.join(', ')}. Max ${currentMaxFiles} file${currentMaxFiles > 1 ? 's' : ''}, ${MAX_FILE_SIZE_MB}MB/file, images only.`;
    }
    setError(currentBatchError); 

    // Clear states that depend on the files being processed, but not the files themselves yet
    setTextConcept(''); // If switching from text mode implicitly
    setGeneratedPrompts([]);
    setCharacterSheetPrompts([]); // Cleared here, will be refilled if mode is characterSheet and processing is successful
    setGlobalProcessingError(null);
    setSuggestionsText('');
    setCharacterSheetSuggestionsText('');
    // characterSheetImageInput is handled below specifically for characterSheet mode

    // Use the latest files state for character sheet processing
    const filesForCharSheet = inputMode === 'fashionPrompt' ? [] : selectedFiles;

    if (inputMode === 'characterSheet') {
        if (filesForCharSheet.length === 1) {
            try {
                const imageInput = await fileToBase64WithType(filesForCharSheet[0]);
                setCharacterSheetImageInput(imageInput);
                if (currentBatchError) setError(currentBatchError); // Prioritize batch error if imageInput is fine
                else setError(null); // Clear error if conversion is successful and no batch error
            } catch (err: any) {
                const specificErrorMsg = `Error processing image for character sheet: ${err.message || 'Unknown error'}. Please try a different image.`;
                console.error(specificErrorMsg, err);
                setError(specificErrorMsg);
                setCharacterSheetImageInput(null);
            }
        } else {
            // If not exactly one file for character sheet (e.g. 0 valid files processed, or multiple selected initially for other modes)
            // It should already be null from handleFileChange/paste/drop or resetCommonStates, but ensure it is.
            setCharacterSheetImageInput(null);
            if (filesForCharSheet.length > 1 && !currentBatchError) {
                 setError(`Please select only ${MAX_FILES_CHARACTER_SHEET} image for Character Sheet mode.`)
            } else if (currentBatchError) {
                setError(currentBatchError); // Show batch error if any
            }
        }
    } else {
        // For any other mode, ensure characterSheetImageInput is null
        setCharacterSheetImageInput(null);
    }

  }, [selectedFiles, fashionGarmentFiles, inputMode, MAX_FILES_CHARACTER_SHEET, MAX_FILES_FASHION_PROMPT, MAX_FILES_FUSION, MAX_FILES_BATCH_UPLOAD, MAX_FILE_SIZE_BYTES]);


  useEffect(() => {
    if ((inputMode === 'image' || inputMode === 'characterSheet') && selectedFiles.length === 1) {
      const file = selectedFiles[0];
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.onerror = () => { setError("Error reading image for preview."); setPreviewUrl(null); };
      reader.readAsDataURL(file);
    } else if (inputMode === 'image' && selectedFiles.length > 1) {
      setPreviewUrl(null); 
    } else if (inputMode !== 'fashionPrompt' && inputMode !== 'imageFusion') { 
      setPreviewUrl(null);
    }

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
    } else if (inputMode !== 'imageFusion' && inputMode !== 'fashionPrompt' ) {
      setImagePreviews([]);
    }

    if (inputMode === 'fashionPrompt' && fashionGarmentFiles.length > 0) {
        const filePromises = fashionGarmentFiles.map(file => {
            return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error(`Failed to read ${file.name} for fashion preview.`));
            reader.readAsDataURL(file);
            });
        });
        Promise.all(filePromises)
            .then(setFashionGarmentPreviewUrls)
            .catch(err => {
                console.error("Error reading files for fashion preview:", err);
                setError(err.message || "Error creating previews for fashion garment images.");
                setFashionGarmentPreviewUrls([]);
            });
    } else if (inputMode !== 'fashionPrompt') {
       setFashionGarmentPreviewUrls([]);
    }

  }, [selectedFiles, inputMode, fashionGarmentFiles]);


  const clearSubsequentFashionStates = () => {
    setFashionPromptData(null);
    setFashionAnalysisError(null);
    setGeneratedFashionImageFile(null);
    setGeneratedFashionImagePreviewUrl(null);
    setRefinedStudioPrompts(null);
    setFashionQaError(null);
    setFashionInitialJsonPromptCopied(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const target = event.target as HTMLInputElement; // Cast to HTMLInputElement
      if (inputMode === 'fashionPrompt') {
          setFashionGarmentFiles([]); 
          setFashionGarmentPreviewUrls([]);
          clearSubsequentFashionStates();
      } else if (inputMode === 'characterSheet' || inputMode === 'imageFusion' || (inputMode === 'image' && !target.multiple) ) {
          setSelectedFiles([]); 
          setImagePreviews([]);
          setPreviewUrl(null);
          setCharacterSheetImageInput(null); // Explicitly clear before processing
      }
      processFiles(event.target.files);
    }
    if (event.target) {
        (event.target as HTMLInputElement).value = ''; 
    }
  };
  
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    if ((inputMode !== 'image' && inputMode !== 'imageFusion' && inputMode !== 'characterSheet' && inputMode !== 'fashionPrompt') || isLoading || fashionIsLoadingAnalysis || fashionQaIsLoading) return;
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
        if (inputMode === 'fashionPrompt') {
            setFashionGarmentFiles([]); 
            setFashionGarmentPreviewUrls([]);
            clearSubsequentFashionStates();
        } else if (inputMode === 'characterSheet' || inputMode === 'imageFusion' || (inputMode === 'image' && pastedFiles.length === 1) ) {
            setSelectedFiles([]); 
            setImagePreviews([]);
            setPreviewUrl(null);
            setCharacterSheetImageInput(null); // Explicitly clear before processing
        }
        processFiles(pastedFiles);
        // setError(null); // processFiles will set its own errors
    }
  }, [inputMode, isLoading, fashionIsLoadingAnalysis, fashionQaIsLoading, processFiles]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if ((inputMode !== 'image' && inputMode !== 'imageFusion' && inputMode !== 'characterSheet' && inputMode !== 'fashionPrompt') || isLoading || fashionIsLoadingAnalysis || fashionQaIsLoading) return;
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      if (inputMode === 'fashionPrompt') {
          setFashionGarmentFiles([]); 
          setFashionGarmentPreviewUrls([]);
          clearSubsequentFashionStates();
      } else if (inputMode === 'characterSheet' || inputMode === 'imageFusion' || (inputMode === 'image' && event.dataTransfer.files.length ===1) ) {
          setSelectedFiles([]); 
          setImagePreviews([]);
          setPreviewUrl(null);
          setCharacterSheetImageInput(null); // Explicitly clear before processing
      }
      processFiles(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  }, [inputMode, processFiles, isLoading, fashionIsLoadingAnalysis, fashionQaIsLoading]);

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

  const clearSelectedFilesForMode = () => { 
    if (inputMode === 'fashionPrompt') {
        setFashionGarmentFiles([]);
        setFashionGarmentPreviewUrls([]);
        clearSubsequentFashionStates();
    } else {
        setSelectedFiles([]);
        setPreviewUrl(null);
        setImagePreviews([]);
        setCharacterSheetImageInput(null);
    }
    setGeneratedPrompts([]);
    setCharacterSheetPrompts([]);
    setError(null);
    setGlobalProcessingError(null);
    setSuggestionsText('');
    setCharacterSheetSuggestionsText('');
    setCrazyShotBackgroundIdea('');
  };


  const handleGeneratedFashionImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
        const file = event.target.files[0];
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setFashionQaError(`Generated image "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB.`);
            setGeneratedFashionImageFile(null);
            setGeneratedFashionImagePreviewUrl(null);
            return;
        }
        if (!file.type.startsWith('image/')) {
            setFashionQaError(`Generated image "${file.name}" is not a valid image type.`);
            setGeneratedFashionImageFile(null);
            setGeneratedFashionImagePreviewUrl(null);
            return;
        }
        
        setGeneratedFashionImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setGeneratedFashionImagePreviewUrl(reader.result as string);
        reader.onerror = () => {
            setFashionQaError("Error reading the generated image for preview.");
            setGeneratedFashionImagePreviewUrl(null);
        };
        reader.readAsDataURL(file);
        setRefinedStudioPrompts(null); 
        setFashionQaError(null); 
    }
    if (event.target) {
        (event.target as HTMLInputElement).value = ''; 
    }
  };

  const clearGeneratedFashionImage = () => {
    setGeneratedFashionImageFile(null);
    setGeneratedFashionImagePreviewUrl(null);
    setRefinedStudioPrompts(null);
    setFashionQaError(null);
  };


  const handleSubmit = async () => {
    setIsLoading(true);
    setGeneratedPrompts([]);
    setCharacterSheetPrompts([]);
    setError(null); // Clear previous general errors before new submission
    setGlobalProcessingError(null);
    setSuggestionsText(''); 
    setCharacterSheetSuggestionsText('');

    if (inputMode === 'image' && selectedFiles.length > 0) {
      const newPromptsPromises = selectedFiles.map(async (file) => {
        const itemId = `${file.name}-${Date.now()}`;
        try {
          const { base64, mimeType } = await fileToBase64WithType(file);
          const promptText = await generateDetailedPrompt({ imagesToProcess: [{ base64, mimeType }] });
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
        const filesToFuse = [...selectedFiles];
        try {
            const imageInputs = await Promise.all(filesToFuse.map(async (file) => {
                const { base64, mimeType } = await fileToBase64WithType(file);
                return { base64, mimeType };
            }));
            const promptText = await generateDetailedPrompt({ imagesToProcess: imageInputs });
            setGeneratedPrompts([{ id: itemId, fileName: 'Fused Prompt', prompt: promptText, isCopied: false, originalInput: { type: 'imageFusion', files: filesToFuse } }]);
        } catch (err: any) {
            console.error("Error generating fused prompt:", err);
            setGeneratedPrompts([{ id: itemId, fileName: 'Fused Prompt', error: err.message || "Failed to generate fused prompt.", isCopied: false, originalInput: { type: 'imageFusion', files: filesToFuse } }]);
            setGlobalProcessingError(err.message || "Failed to generate fused prompt.");
        }
    } else if (inputMode === 'characterSheet' && selectedFiles.length === MAX_FILES_CHARACTER_SHEET && characterSheetImageInput) {
        try {
            const promptsArray = await generateCharacterSheetPrompts(characterSheetImageInput, crazyShotBackgroundIdea.trim());
            setCharacterSheetPrompts(promptsArray.map(p => ({
                id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`,
                title: p.title,
                prompt: p.prompt,
                isCopied: false,
            })));
        } catch (err: any) {
            console.error("Error generating character sheet prompts:", err);
            setGlobalProcessingError(err.message || "Failed to generate character sheet prompts.");
            setCharacterSheetPrompts([]); 
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
      // Set specific error messages if conditions for submission are not met
      if (inputMode === 'image' && selectedFiles.length === 0) setError("Please select one or more image files.");
      else if (inputMode === 'imageFusion' && (selectedFiles.length < MIN_FILES_FUSION || selectedFiles.length > MAX_FILES_FUSION)) setError(`Please select ${MIN_FILES_FUSION} to ${MAX_FILES_FUSION} images for fusion.`);
      else if (inputMode === 'characterSheet') {
        if (selectedFiles.length !== MAX_FILES_CHARACTER_SHEET) setError(`Please select ${MAX_FILES_CHARACTER_SHEET} image for the character sheet.`);
        else if (!characterSheetImageInput) setError(`Image for character sheet not processed or invalid. Please re-select or try a different image.`);
      }
      else if (inputMode === 'text' && textConcept.trim() === '') setError("Please enter a text concept.");
      // else: No specific error, button should be disabled by canSubmitGeneral
    }
    setIsLoading(false);
  };

  const handleGenerateFashionAnalysis = async () => {
    if (fashionGarmentFiles.length === 0) {
        setFashionAnalysisError(`Please upload 1 or ${MAX_FILES_FASHION_PROMPT} garment image(s) first.`);
        return;
    }
    setFashionIsLoadingAnalysis(true);
    setFashionAnalysisError(null); // Clear previous fashion-specific errors
    setFashionPromptData(null);    // Clear previous data
    clearSubsequentFashionStates(); 

    try {
        const imageInputs = await Promise.all(fashionGarmentFiles.map(file => fileToBase64WithType(file)));
        const results = await generateFashionAnalysisAndInitialJsonPrompt(imageInputs);
        setFashionPromptData(results);
    } catch (err: any) {
        console.error("Error in fashion analysis generation:", err);
        setFashionAnalysisError(err.message || "Failed to generate fashion analysis and prompt.");
        setFashionPromptData(null);
    }
    setFashionIsLoadingAnalysis(false);
  };

  const handleQaAndRefineStudioPrompts = async () => {
    if (!fashionPromptData || !generatedFashionImageFile || fashionGarmentFiles.length === 0) {
        setFashionQaError("Missing data: Original garment image(s), generated image, or initial analysis is not available.");
        return;
    }
    setFashionQaIsLoading(true);
    setFashionQaError(null);
    setRefinedStudioPrompts(null);

    try {
        const originalGarmentImageInputs = await Promise.all(fashionGarmentFiles.map(file => fileToBase64WithType(file)));
        const generatedFashionImageInput = await fileToBase64WithType(generatedFashionImageFile);

        const results = await performQaAndGenerateStudioPrompts(
            originalGarmentImageInputs,
            generatedFashionImageInput,
            fashionPromptData
        );
        
        setRefinedStudioPrompts(results.map(p => ({
            id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`,
            title: p.title,
            prompt: p.prompt,
            isCopied: false,
        })));

    } catch (err: any) {
        console.error("Error in QA and studio/lifestyle prompt generation:", err);
        setFashionQaError(err.message || "Failed to perform QA and generate prompts.");
        setRefinedStudioPrompts(null);
    }
    setFashionQaIsLoading(false);
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
            imagesToProcess: [{ base64, mimeType }], 
            refinementSuggestions: suggestionsText.trim()
          });
        } else if (item.originalInput.type === 'imageFusion') {
            const imageInputs = await Promise.all(item.originalInput.files.map(async (file) => {
                const { base64, mimeType } = await fileToBase64WithType(file);
                return { base64, mimeType };
            }));
            refinedPromptText = await generateDetailedPrompt({
                imagesToProcess: imageInputs,
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

    const refinedPromptsResult = await Promise.all(refinementPromises);
    setGeneratedPrompts(refinedPromptsResult);
    if (refinedPromptsResult.some(p => p.error && generatedPrompts.find(op => op.id === p.id)?.prompt)) { 
      setGlobalProcessingError("Some prompts could not be refined. See details below.");
    }
    setIsLoading(false);
  };

  const handleRefineCharacterSheetPrompts = async () => {
    if (characterSheetSuggestionsText.trim() === '' || !characterSheetImageInput || characterSheetPrompts.length === 0) {
      setError("Please enter suggestions and ensure a character sheet image and prompts are present.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setGlobalProcessingError(null);

    try {
      const refinedSheetPrompts = await refineCharacterSheetPrompts(
        characterSheetImageInput,
        characterSheetSuggestionsText.trim(),
        crazyShotBackgroundIdea.trim() 
      );
      setCharacterSheetPrompts(refinedSheetPrompts.map(p => ({
        id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`, 
        title: p.title,
        prompt: p.prompt,
        isCopied: false,
      })));
    } catch (err: any) {
      console.error("Error refining character sheet prompts:", err);
      setGlobalProcessingError(err.message || "Failed to refine character sheet prompts.");
    }

    setIsLoading(false);
  };


  const handleCopyToClipboard = (textToCopy: string, onCopySuccess: () => void, onCopyError?: (err: any) => void) => {
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            onCopySuccess();
        })
        .catch(err => {
            console.error("Failed to copy:", err);
            if (onCopyError) onCopyError(err);
        });
  };

  const copyGeneratedPrompt = (itemId: string) => {
    const promptItem = generatedPrompts.find(p => p.id === itemId);
    if (promptItem && promptItem.prompt) {
        handleCopyToClipboard(promptItem.prompt, 
            () => {
                setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: true } : p));
                setTimeout(() => {
                    setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: false } : p));
                }, 2000);
            },
            () => {
                 setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, error: (p.error || "") + " Copy failed." } : p));
            }
        );
    }
  };

  const copyCharacterSheetPrompt = (itemId: string) => {
    const promptItem = characterSheetPrompts.find(p => p.id === itemId);
     if (promptItem && promptItem.prompt) {
        handleCopyToClipboard(promptItem.prompt,
            () => {
                setCharacterSheetPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: true } : p));
                setTimeout(() => {
                    setCharacterSheetPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: false } : p));
                }, 2000);
            },
            () => {
                setCharacterSheetPrompts(prev => prev.map(p => p.id === itemId ? { ...p, error: (p.error || "") + " Copy failed." } : p));
            }
        );
    }
  };
  
  const copyFashionInitialJsonPrompt = () => {
    if (fashionPromptData?.initialJsonPrompt) {
        handleCopyToClipboard(fashionPromptData.initialJsonPrompt,
            () => {
                setFashionInitialJsonPromptCopied(true);
                setTimeout(() => setFashionInitialJsonPromptCopied(false), 2000);
            },
            () => {
                setFashionAnalysisError((prevError) => (prevError ? prevError + " " : "") + "Failed to copy initial JSON prompt.");
            }
        );
    }
  };

  const copyRefinedStudioPrompt = (itemId: string) => {
    if (!refinedStudioPrompts) return;
    const promptItem = refinedStudioPrompts.find(p => p.id === itemId);
     if (promptItem && promptItem.prompt) {
        handleCopyToClipboard(promptItem.prompt,
            () => {
                setRefinedStudioPrompts(prev => prev!.map(p => p.id === itemId ? { ...p, isCopied: true } : p));
                setTimeout(() => {
                    setRefinedStudioPrompts(prev => prev!.map(p => p.id === itemId ? { ...p, isCopied: false } : p));
                }, 2000);
            },
            () => {
                 setRefinedStudioPrompts(prev => prev!.map(p => p.id === itemId ? { ...p, error: (p.error || "") + " Copy failed." } : p));
            }
        );
    }
  };


  const canSubmitGeneral = (): boolean => {
    if (isLoading) return false;
    if (inputMode === 'image') return selectedFiles.length > 0 && selectedFiles.length <= MAX_FILES_BATCH_UPLOAD;
    if (inputMode === 'imageFusion') return selectedFiles.length >= MIN_FILES_FUSION && selectedFiles.length <= MAX_FILES_FUSION;
    if (inputMode === 'characterSheet') return selectedFiles.length === MAX_FILES_CHARACTER_SHEET && !!characterSheetImageInput;
    if (inputMode === 'text') return textConcept.trim().length > 0;
    return false;
  };
   const canSubmitFashion = (): boolean => {
    if (fashionIsLoadingAnalysis) return false;
    if (inputMode === 'fashionPrompt') return fashionGarmentFiles.length > 0 && fashionGarmentFiles.length <= MAX_FILES_FASHION_PROMPT;
    return false;
  };

  const canSubmitFashionQa = (): boolean => {
    if (fashionQaIsLoading) return false;
    return !!fashionPromptData && !!generatedFashionImageFile && fashionGarmentFiles.length > 0;
  };

  const hasSuccessfulPrompts = generatedPrompts.some(p => p.prompt && !p.error);
  const hasCharacterSheetPrompts = characterSheetPrompts.some(p => p.prompt && !p.error);
  
  const getUploadAreaMessage = () => {
    if (inputMode === 'imageFusion') {
      if (selectedFiles.length > 0 && selectedFiles.length < MIN_FILES_FUSION) {
        return `Need ${MIN_FILES_FUSION - selectedFiles.length} more image(s) for fusion. (Min ${MIN_FILES_FUSION}, Max ${MAX_FILES_FUSION})`;
      }
      return `Drag & drop ${MIN_FILES_FUSION}-${MAX_FILES_FUSION} images, or click.`;
    }
    if (inputMode === 'characterSheet') {
      return `Drag & drop ${MAX_FILES_CHARACTER_SHEET} image for character sheet, or click.`;
    }
    if (inputMode === 'fashionPrompt') {
        const remainingSlots = MAX_FILES_FASHION_PROMPT - fashionGarmentFiles.length;
        if (fashionGarmentFiles.length > 0 && fashionGarmentFiles.length < MAX_FILES_FASHION_PROMPT) {
             return `Add up to ${remainingSlots} more garment image(s), or click to replace. (Max ${MAX_FILES_FASHION_PROMPT})`;
        }
        return `Drag & drop 1 or ${MAX_FILES_FASHION_PROMPT} garment images, or click.`;
    }
    const remainingSlots = MAX_FILES_BATCH_UPLOAD - selectedFiles.length;
    if (inputMode === 'image' && selectedFiles.length > 0 && selectedFiles.length < MAX_FILES_BATCH_UPLOAD) {
        return `Add up to ${remainingSlots} more image(s), or click to replace current. (Max ${MAX_FILES_BATCH_UPLOAD})`;
    }
    return `Drag & drop images, or click. (Max ${MAX_FILES_BATCH_UPLOAD})`;
  };

  const renderUploadArea = () => {
    const isImageBasedMode = inputMode === 'image' || inputMode === 'imageFusion' || inputMode === 'characterSheet' || inputMode === 'fashionPrompt';
    if (!isImageBasedMode) return null;

    let SpecificIcon = UploadIcon;

    if (inputMode === 'fashionPrompt') {
        SpecificIcon = ShirtIcon;
    } else if (inputMode === 'imageFusion') {
        SpecificIcon = SquaresPlusIcon;
    } else if (inputMode === 'characterSheet') {
        SpecificIcon = UserCircleIcon;
    }

    let previewContent = null;
    if (inputMode === 'fashionPrompt' && fashionGarmentPreviewUrls.length > 0) {
        previewContent = (
            <div className="mb-4">
                <h3 className="font-semibold text-sky-400 mb-2 text-left">
                    Garment Image{fashionGarmentPreviewUrls.length > 1 ? 's' : ''} ({fashionGarmentPreviewUrls.length}/{MAX_FILES_FASHION_PROMPT}):
                </h3>
                <div className={`flex flex-wrap justify-center items-center gap-2 max-h-60 overflow-y-auto pretty-scrollbar p-1`}>
                {fashionGarmentPreviewUrls.map((src, index) => (
                    <img 
                        key={index} 
                        src={src} 
                        alt={`Garment preview ${index + 1}`} 
                        className={`object-contain rounded-md shadow-md border border-zinc-700 ${fashionGarmentPreviewUrls.length === 1 ? 'max-h-52 w-auto mx-auto' : 'h-32 w-32 md:h-40 md:w-40'}`} 
                    />
                ))}
                </div>
            </div>
        );
    } else if ((inputMode === 'image' || inputMode === 'characterSheet') && previewUrl && selectedFiles.length === 1) {
        previewContent = (
            <>
                <img src={previewUrl} alt="Selected preview" className="max-h-60 w-auto mx-auto rounded-md shadow-md mb-4 object-contain" />
                {inputMode === 'characterSheet' && (
                    <div className="mb-4">
                        <label htmlFor="crazyShotBackgroundIdea" className="block text-sm font-medium text-sky-300 mb-1">
                            Optional: Background/Idea for 'Realistic Crazy Shot'
                        </label>
                        <input
                            type="text"
                            id="crazyShotBackgroundIdea"
                            value={crazyShotBackgroundIdea}
                            onChange={(e) => setCrazyShotBackgroundIdea(e.target.value)}
                            placeholder="e.g., Bioluminescent forest, cyberpunk alley"
                            className="w-full p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 placeholder-zinc-500 text-sm"
                        />
                    </div>
                )}
            </>
        );
    } else if (inputMode === 'image' && selectedFiles.length > 0) { // Batch image mode
        previewContent = (
            <div className="mb-4 text-left">
                <h3 className="font-semibold text-sky-400 mb-2">Selected Files ({selectedFiles.length}/{MAX_FILES_BATCH_UPLOAD}):</h3>
                <ul className="list-disc list-inside text-gray-300 max-h-40 overflow-y-auto space-y-1 text-sm pretty-scrollbar pr-2">
                    {selectedFiles.map(file => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}
                </ul>
            </div>
        );
    } else if (inputMode === 'imageFusion' && imagePreviews.length > 0) {
        previewContent = (
            <div className="mb-4">
                <h3 className="font-semibold text-sky-400 mb-2 text-left">Selected Images for Fusion ({imagePreviews.length}/{MAX_FILES_FUSION}):</h3>
                <div className="flex flex-wrap justify-center gap-2 max-h-60 overflow-y-auto pretty-scrollbar p-1">
                {imagePreviews.map((src, index) => (
                    <img key={index} src={src} alt={`Fusion preview ${index + 1}`} className="h-20 w-20 object-cover rounded-md shadow-md border border-zinc-700" />
                ))}
                </div>
            </div>
        );
    } else { 
        previewContent = (
            <div className="flex flex-col items-center">
                <SpecificIcon className="w-16 h-16 text-zinc-500 mx-auto mb-4" />
            </div>
        );
    }
    
    let fileLimitsText = '';
    let currentSelectedFileCount = 0;
    if (inputMode === 'imageFusion') {
      fileLimitsText = `Min ${MIN_FILES_FUSION}, Max ${MAX_FILES_FUSION} images. `;
      currentSelectedFileCount = selectedFiles.length;
    } else if (inputMode === 'characterSheet') {
      fileLimitsText = `Exactly ${MAX_FILES_CHARACTER_SHEET} image. `;
      currentSelectedFileCount = selectedFiles.length;
    } else if (inputMode === 'fashionPrompt') {
      fileLimitsText = `1 or ${MAX_FILES_FASHION_PROMPT} images. `;
      currentSelectedFileCount = fashionGarmentFiles.length;
    } else { // image mode
      fileLimitsText = `Max ${MAX_FILES_BATCH_UPLOAD} files. `;
      currentSelectedFileCount = selectedFiles.length;
    }


    return (
        <div 
          className="border-2 border-dashed border-zinc-600 hover:border-sky-500 rounded-lg p-6 md:p-10 text-center cursor-pointer transition-colors duration-200"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('fileInput')?.click()}
          role="button"
          tabIndex={0}
          aria-label={`Image upload area: ${getUploadAreaMessage()}`}
        >
          <input
            type="file"
            id="fileInput"
            accept="image/*"
            multiple={inputMode === 'image' || inputMode === 'imageFusion' || inputMode === 'fashionPrompt'} 
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />
          {previewContent}
          <p className="text-gray-400">{getUploadAreaMessage()}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {fileLimitsText}
            {MAX_FILE_SIZE_MB}MB per image. PNG, JPG, GIF, WEBP.
          </p>
          {currentSelectedFileCount > 0 && (
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); clearSelectedFilesForMode(); }} className="mt-4 text-sm !py-1.5 !px-3">
                <XCircleIcon className="w-4 h-4" /> Clear Selection
            </Button>
          )}
        </div>
    );
  };


  return (
    <div className="min-h-screen bg-zinc-900 text-gray-100 flex flex-col items-center p-4 md:p-8 selection:bg-sky-500 selection:text-white">
      <div className="w-full max-w-3xl space-y-8">
        <header className="text-center relative">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-2">
                <h1 className="text-4xl md:text-5xl font-bold text-sky-400">Detailed Prompt Generator AI</h1>
            </div>
          <p className="mt-1 text-lg text-gray-400">
            Craft the perfect prompt. Use images, fuse multiple, generate character sheets, explore advanced fashion prompting, or start with text. Refine with suggestions.
          </p>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 justify-center bg-zinc-800 p-1 rounded-lg shadow-md gap-1">
          <button
            onClick={() => setInputMode('image')}
            aria-pressed={inputMode === 'image'}
            className={`flex-1 sm:flex-auto px-3 py-3 font-medium rounded-md flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out text-sm
                        ${inputMode === 'image' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <UploadIcon className="w-5 h-5" /> Image Batch
          </button>
          <button
            onClick={() => setInputMode('imageFusion')}
            aria-pressed={inputMode === 'imageFusion'}
            className={`flex-1 sm:flex-auto px-3 py-3 font-medium rounded-md flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out text-sm
                        ${inputMode === 'imageFusion' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <SquaresPlusIcon className="w-5 h-5" /> Image Fusion
          </button>
           <button
            onClick={() => setInputMode('characterSheet')}
            aria-pressed={inputMode === 'characterSheet'}
            className={`flex-1 sm:flex-auto px-3 py-3 font-medium rounded-md flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out text-sm
                        ${inputMode === 'characterSheet' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <UserCircleIcon className="w-5 h-5" /> Character Sheet
          </button>
          <button
            onClick={() => setInputMode('fashionPrompt')}
            aria-pressed={inputMode === 'fashionPrompt'}
            className={`flex-1 sm:flex-auto px-3 py-3 font-medium rounded-md flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out text-sm
                        ${inputMode === 'fashionPrompt' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <ShirtIcon className="w-5 h-5" /> Advanced Fashion
          </button>
          <button
            onClick={() => setInputMode('text')}
            aria-pressed={inputMode === 'text'}
            className={`flex-1 sm:flex-auto px-3 py-3 font-medium rounded-md flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out text-sm col-span-2 sm:col-span-1 lg:col-span-1
                        ${inputMode === 'text' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-700 hover:text-gray-200'}`}
          >
            <TextIcon className="w-5 h-5" /> Text Concept
          </button>
        </div>
        
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {globalProcessingError && <Alert type="error" message={globalProcessingError} onClose={() => setGlobalProcessingError(null)} />}
        {fashionAnalysisError && inputMode === 'fashionPrompt' && <Alert type="error" message={fashionAnalysisError} onClose={() => setFashionAnalysisError(null)} />}
        {fashionQaError && inputMode === 'fashionPrompt' && <Alert type="error" message={fashionQaError} onClose={() => setFashionQaError(null)} />}


        <div className="bg-zinc-800 p-6 rounded-xl shadow-xl">
          {inputMode === 'text' ? (
            <textarea
              value={textConcept}
              onChange={(e) => setTextConcept(e.target.value)}
              placeholder="e.g., A futuristic cityscape at sunset, neon lights reflecting on wet streets, a lone figure walking towards a massive skyscraper..."
              className="w-full h-40 p-4 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 resize-none placeholder-zinc-500 pretty-scrollbar"
              aria-label="Text concept input"
            />
          ) : (
            renderUploadArea()
          )}

          {inputMode !== 'fashionPrompt' && (
            <Button 
                onClick={handleSubmit} 
                disabled={!canSubmitGeneral()}
                className="w-full mt-6 text-lg"
                aria-label={
                    inputMode === 'image' ? "Generate detailed prompts from selected images" :
                    inputMode === 'imageFusion' ? "Generate single fused prompt from selected images" :
                    inputMode === 'characterSheet' ? "Generate character sheet prompts from selected image" :
                    "Generate detailed prompt from text concept"
                }
            >
                {isLoading && generatedPrompts.length === 0 && characterSheetPrompts.length === 0 ? <Spinner /> : <SparklesIcon className="w-5 h-5"/>}
                {inputMode === 'imageFusion' 
                    ? 'Generate Fused Prompt' 
                    : inputMode === 'characterSheet'
                    ? 'Generate Character Sheet'
                    : `Generate Detailed Prompt${inputMode === 'image' && selectedFiles.length > 1 ? 's' : ''}`
                }
            </Button>
          )}

          {inputMode === 'fashionPrompt' && (
             <Button 
                onClick={handleGenerateFashionAnalysis}
                disabled={!canSubmitFashion()}
                className="w-full mt-6 text-lg"
                aria-label="Analyze garment and generate initial fashion prompt"
            >
                {fashionIsLoadingAnalysis ? <Spinner /> : <SparklesIcon className="w-5 h-5"/>}
                Analyze Garment & Generate Initial Prompt
            </Button>
          )}
        </div>

        {inputMode === 'fashionPrompt' && fashionPromptData && !fashionIsLoadingAnalysis && (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold text-sky-400 mb-3">Initial Fashion Prompt Details</h2>
                </div>
                <div className="bg-zinc-800 p-5 rounded-lg shadow-lg">
                    <h3 className="font-semibold text-sky-300 mb-2">Garment Analysis (Step 1)</h3>
                    <p className="text-gray-200 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-60 overflow-y-auto">
                      {fashionPromptData.garmentAnalysis}
                    </p>
                </div>
                 <div className="bg-zinc-800 p-5 rounded-lg shadow-lg">
                    <h3 className="font-semibold text-sky-300 mb-2">QA Checklist (Step 2)</h3>
                    <p className="text-gray-200 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-60 overflow-y-auto">
                      {fashionPromptData.qaChecklist}
                    </p>
                </div>
                 <div className="bg-zinc-800 p-5 rounded-lg shadow-lg">
                    <h3 className="font-semibold text-sky-300 mb-2">Initial JSON Prompt (Step 4)</h3>
                    <p className="text-gray-200 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-72 overflow-y-auto">
                      {fashionPromptData.initialJsonPrompt}
                    </p>
                     <Button 
                        onClick={copyFashionInitialJsonPrompt}
                        variant="secondary" 
                        className="w-full sm:w-auto text-sm !py-2 !px-4 mt-3"
                        aria-label="Copy initial JSON prompt to clipboard"
                    >
                      {fashionInitialJsonPromptCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                      {fashionInitialJsonPromptCopied ? 'Copied!' : 'Copy Initial JSON Prompt'}
                    </Button>
                </div>
                
                {/* QA and Refined Studio Prompts Section */}
                <div className="border-t-2 border-zinc-700 pt-6 mt-8 space-y-6">
                    <h2 className="text-2xl font-semibold text-sky-400 mb-1">Step 2: QA & Prompt Generation</h2>
                    <p className="text-gray-400 text-sm mb-4">
                        Use the "Initial JSON Prompt" above in your preferred image generation tool. 
                        Then, upload the image you generated below to perform QA and get refined studio & lifestyle prompts.
                    </p>

                    <div className="bg-zinc-800 p-6 rounded-xl shadow-xl">
                        <label htmlFor="generatedFashionImageInput" className="block text-md font-medium text-sky-300 mb-3">
                            Upload Your Generated Image (from Initial Prompt)
                        </label>
                        {generatedFashionImagePreviewUrl ? (
                            <div className="mb-4 text-center">
                                <img src={generatedFashionImagePreviewUrl} alt="Generated fashion preview" className="max-h-72 w-auto mx-auto rounded-md shadow-md mb-3 object-contain" />
                                <Button variant="secondary" onClick={clearGeneratedFashionImage} className="text-sm !py-1.5 !px-3">
                                    <XCircleIcon className="w-4 h-4" /> Clear Generated Image
                                </Button>
                            </div>
                        ) : (
                            <div 
                                className="border-2 border-dashed border-zinc-600 hover:border-sky-500 rounded-lg p-8 text-center cursor-pointer transition-colors duration-200"
                                onClick={() => document.getElementById('generatedFashionImageInput')?.click()}
                                role="button" tabIndex={0}
                                aria-label="Upload generated fashion image"
                            >
                                <input
                                    type="file"
                                    id="generatedFashionImageInput"
                                    accept="image/*"
                                    onChange={handleGeneratedFashionImageFileChange}
                                    className="hidden"
                                    aria-hidden="true"
                                />
                                <UploadIcon className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
                                <p className="text-gray-400">Click or drag & drop image here.</p>
                                <p className="text-xs text-zinc-500 mt-1">Max {MAX_FILE_SIZE_MB}MB. PNG, JPG, etc.</p>
                            </div>
                        )}
                        <Button
                            onClick={handleQaAndRefineStudioPrompts}
                            disabled={!canSubmitFashionQa()}
                            className="w-full mt-6 text-lg"
                            aria-label="Perform QA and generate refined studio and lifestyle prompts"
                        >
                            {fashionQaIsLoading ? <Spinner /> : <WandSparklesIcon className="w-5 h-5" />}
                            Perform QA & Generate All Prompts
                        </Button>
                    </div>

                    {refinedStudioPrompts && refinedStudioPrompts.length > 0 && !fashionQaIsLoading && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-semibold text-sky-400">Refined Studio & Lifestyle Prompts</h2>
                            {refinedStudioPrompts.map((item) => (
                            <div key={item.id} className="bg-zinc-800 p-5 rounded-lg shadow-lg">
                                <h3 className="font-semibold text-sky-300 mb-2">{item.title}</h3>
                                {item.error ? (
                                <Alert type="error" message={item.error} />
                                ) : (
                                <div className="space-y-3">
                                    <p className="text-gray-200 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-48 overflow-y-auto">
                                    {item.prompt}
                                    </p>
                                    <Button 
                                        onClick={() => copyRefinedStudioPrompt(item.id)}
                                        variant="secondary" 
                                        className="w-full sm:w-auto text-sm !py-2 !px-4"
                                        aria-label={`Copy prompt for ${item.title} to clipboard`}
                                    >
                                    {item.isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                    {item.isCopied ? 'Copied!' : 'Copy Prompt'}
                                    </Button>
                                </div>
                                )}
                            </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}


        {generatedPrompts.length > 0 && inputMode !== 'characterSheet' && inputMode !== 'fashionPrompt' && (
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
                        onClick={() => copyGeneratedPrompt(item.id)}
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

        {characterSheetPrompts.length > 0 && inputMode === 'characterSheet' && (
            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-sky-400">Generated Character Sheet Prompts</h2>
                {characterSheetPrompts.map((item) => (
                <div key={item.id} className="bg-zinc-800 p-5 rounded-lg shadow-lg">
                    <h3 className="font-semibold text-sky-300 mb-2">{item.title}</h3>
                    {item.error ? (
                    <Alert type="error" message={item.error} />
                    ) : (
                    <div className="space-y-3">
                        <p className="text-gray-200 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-48 overflow-y-auto">
                        {item.prompt}
                        </p>
                        <Button 
                            onClick={() => copyCharacterSheetPrompt(item.id)}
                            variant="secondary" 
                            className="w-full sm:w-auto text-sm !py-2 !px-4"
                            aria-label={`Copy prompt for ${item.title} to clipboard`}
                        >
                        {item.isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                        {item.isCopied ? 'Copied!' : 'Copy Prompt'}
                        </Button>
                    </div>
                    )}
                </div>
                ))}
            </div>
        )}


        {hasSuccessfulPrompts && inputMode !== 'characterSheet' && inputMode !== 'fashionPrompt' && (
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
        
        {hasCharacterSheetPrompts && inputMode === 'characterSheet' && (
            <div className="bg-zinc-800 p-6 rounded-xl shadow-xl mt-8">
                <h2 className="text-xl font-semibold text-sky-400 mb-3">Refine Character Sheet Prompts</h2>
                <textarea
                value={characterSheetSuggestionsText}
                onChange={(e) => setCharacterSheetSuggestionsText(e.target.value)}
                placeholder="e.g., Make the outfit futuristic, add cybernetic eye, change background of scene shots to a rainy city..."
                className="w-full h-28 p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 resize-none placeholder-zinc-500 pretty-scrollbar"
                aria-label="Suggestions for refining character sheet prompts"
                disabled={isLoading}
                />
                <Button
                onClick={handleRefineCharacterSheetPrompts}
                disabled={isLoading || characterSheetSuggestionsText.trim() === '' || !characterSheetImageInput}
                className="w-full mt-4 text-lg"
                aria-label="Refine all character sheet prompts with the provided suggestions"
                >
                {isLoading && characterSheetSuggestionsText.trim() !== '' ? <Spinner /> : <WandSparklesIcon className="w-5 h-5" />}
                Refine Character Sheet with Suggestions
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
