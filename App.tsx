
import React, { useState, useCallback, ChangeEvent, useEffect, DragEvent } from 'react';
import { generateDetailedPrompt, generateCharacterSheetPrompts, refineCharacterSheetPrompts, generateFashionAnalysisAndInitialJsonPrompt, performQaAndGenerateStudioPrompts, buildDefaultFashionAnalysisSystemInstruction, getDefaultFashionQaSystemInstruction } from './services/geminiService';
import { generateImageViaReplicate } from './services/replicateService'; // New service
import { fileToBase64WithType, FileConversionResult } from './utils/fileUtils';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { Alert } from './components/Alert';
import { UploadIcon, TextIcon, ClipboardIcon, CheckIcon, SparklesIcon, XCircleIcon, WandSparklesIcon, SquaresPlusIcon, UserCircleIcon, ShirtIcon, PhotoIcon, UserGroupIcon, RocketLaunchIcon, ArrowDownTrayIcon, ArrowRightCircleIcon } from './components/Icons'; // Added RocketLaunchIcon


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

export interface FashionPromptData { 
  garmentAnalysis: string;
  qaChecklist: string;
  initialJsonPrompt: string;
}

interface RefinedStudioPromptItem { 
  id: string;
  title: string;
  prompt: string;
  isCopied: boolean;
  error?: string;
  generatedImageUrl?: string;
  isGeneratingImage?: boolean;
  imageError?: string;
}

interface ReplicateInputImage {
  file: File;
  dataUrl: string; // For preview and potential payload
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
  const [fashionBackgroundRefFiles, setFashionBackgroundRefFiles] = useState<File[]>([]);
  const [fashionBackgroundRefPreviewUrls, setFashionBackgroundRefPreviewUrls] = useState<string[]>([]);
  const [fashionModelRefFiles, setFashionModelRefFiles] = useState<File[]>([]);
  const [fashionModelRefPreviewUrls, setFashionModelRefPreviewUrls] = useState<string[]>([]);

  const [fashionIsLoadingAnalysis, setFashionIsLoadingAnalysis] = useState<boolean>(false);
  const [fashionAnalysisError, setFashionAnalysisError] = useState<string | null>(null);
  const [fashionPromptData, setFashionPromptData] = useState<FashionPromptData | null>(null);
  const [fashionInitialJsonPromptCopied, setFashionInitialJsonPromptCopied] = useState<boolean>(false);
  const [initialPromptGeneratedImageUrl, setInitialPromptGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingInitialImage, setIsGeneratingInitialImage] = useState<boolean>(false);
  const [initialImageError, setInitialImageError] = useState<string | null>(null);
  
  const [generatedFashionImageFile, setGeneratedFashionImageFile] = useState<File | null>(null);
  const [generatedFashionImagePreviewUrl, setGeneratedFashionImagePreviewUrl] = useState<string | null>(null);
  const [fashionQaIsLoading, setFashionQaIsLoading] = useState<boolean>(false);
  const [fashionQaError, setFashionQaError] = useState<string | null>(null);
  const [refinedStudioPrompts, setRefinedStudioPrompts] = useState<RefinedStudioPromptItem[] | null>(null);
  const [fashionQaFindings, setFashionQaFindings] = useState<string | null>(null);
  const [fashionAnalysisSystemPrompt, setFashionAnalysisSystemPrompt] = useState<string>(() => localStorage.getItem('fashionAnalysisSystemPrompt') || '');
  const [fashionQaSystemPrompt, setFashionQaSystemPrompt] = useState<string>(() => localStorage.getItem('fashionQaSystemPrompt') || '');

  useEffect(() => { localStorage.setItem('fashionAnalysisSystemPrompt', fashionAnalysisSystemPrompt); }, [fashionAnalysisSystemPrompt]);
  useEffect(() => { localStorage.setItem('fashionQaSystemPrompt', fashionQaSystemPrompt); }, [fashionQaSystemPrompt]);

  // State for Replicate Image Generation
  const [showReplicatePanel, setShowReplicatePanel] = useState<boolean>(false);
  const [replicatePromptText, setReplicatePromptText] = useState<string>('');
  const [replicatePromptTitle, setReplicatePromptTitle] = useState<string>('');
  const [replicateAspectRatio, setReplicateAspectRatio] = useState<string>('1:1');
  const [replicateInputImage1, setReplicateInputImage1] = useState<ReplicateInputImage | null>(null);
  const [replicateInputImage2, setReplicateInputImage2] = useState<ReplicateInputImage | null>(null);
  const [isReplicateLoading, setIsReplicateLoading] = useState<boolean>(false);
  const [replicateResultImageUrl, setReplicateResultImageUrl] = useState<string | null>(null);
  const [replicateError, setReplicateError] = useState<string | null>(null);
  const [availableGarmentImagesForReplicate, setAvailableGarmentImagesForReplicate] = useState<ReplicateInputImage[]>([]);


  const MAX_FILE_SIZE_MB = 4;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  
  const MAX_FILES_BATCH_UPLOAD = 10;
  const MIN_FILES_FUSION = 2;
  const MAX_FILES_FUSION = 5;
  const MAX_FILES_CHARACTER_SHEET = 1;
  const MAX_FILES_FASHION_PROMPT = 2; 
  const MAX_FILES_FASHION_BACKGROUND_REF = 3;
  const MAX_FILES_FASHION_MODEL_REF = 3;


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
    
    setFashionGarmentFiles([]);
    setFashionGarmentPreviewUrls([]);
    setFashionBackgroundRefFiles([]);
    setFashionBackgroundRefPreviewUrls([]);
    setFashionModelRefFiles([]);
    setFashionModelRefPreviewUrls([]);
    setFashionIsLoadingAnalysis(false);
    setFashionAnalysisError(null);
    setFashionPromptData(null);
    setFashionInitialJsonPromptCopied(false);
    setInitialPromptGeneratedImageUrl(null);
    setIsGeneratingInitialImage(false);
    setInitialImageError(null);
    setGeneratedFashionImageFile(null);
    setGeneratedFashionImagePreviewUrl(null);
    setFashionQaIsLoading(false);
    setFashionQaError(null);
    setRefinedStudioPrompts(null);
    setFashionQaFindings(null);

    // Reset Replicate states
    setShowReplicatePanel(false);
    setReplicatePromptText('');
    setReplicatePromptTitle('');
    setReplicateAspectRatio('1:1');
    setReplicateInputImage1(null);
    setReplicateInputImage2(null);
    setIsReplicateLoading(false);
    setReplicateResultImageUrl(null);
    setReplicateError(null);
    setAvailableGarmentImagesForReplicate([]);
  }

  const setInputMode = (mode: InputMode) => {
    setInputModeInternal(mode);
    resetCommonStates();
  };

  const processFiles = useCallback(async (
    filesToProcess: FileList | File[], 
    fileType: 'garment' | 'backgroundRef' | 'modelRef' | 'general' = 'general'
  ) => {
    if (!filesToProcess || filesToProcess.length === 0) {
      return;
    }

    let currentMaxFiles;
    let currentFilesArray: File[];
    let setFilesFunction: React.Dispatch<React.SetStateAction<File[]>>;

    switch(fileType) {
        case 'garment':
            currentMaxFiles = MAX_FILES_FASHION_PROMPT;
            currentFilesArray = fashionGarmentFiles;
            setFilesFunction = setFashionGarmentFiles;
            break;
        case 'backgroundRef':
            currentMaxFiles = MAX_FILES_FASHION_BACKGROUND_REF;
            currentFilesArray = fashionBackgroundRefFiles;
            setFilesFunction = setFashionBackgroundRefFiles;
            break;
        case 'modelRef':
            currentMaxFiles = MAX_FILES_FASHION_MODEL_REF;
            currentFilesArray = fashionModelRefFiles;
            setFilesFunction = setFashionModelRefFiles;
            break;
        default: 
            if (inputMode === 'imageFusion') currentMaxFiles = MAX_FILES_FUSION;
            else if (inputMode === 'characterSheet') currentMaxFiles = MAX_FILES_CHARACTER_SHEET;
            else currentMaxFiles = MAX_FILES_BATCH_UPLOAD; 
            currentFilesArray = selectedFiles;
            setFilesFunction = setSelectedFiles;
            break;
    }
    
    const newValidFiles: File[] = [];
    const rejectedFilesMessages: string[] = [];
    let currentBatchError: string | null = null;

    Array.from(filesToProcess).forEach(file => {
      const countForRejectionCheck = (fileType !== 'general' || inputMode === 'characterSheet' || inputMode === 'imageFusion')
                                        ? newValidFiles.length
                                        : currentFilesArray.length + newValidFiles.length;

      if (countForRejectionCheck >= currentMaxFiles && 
          (fileType !== 'general' || !currentFilesArray.find(sf => sf.name === file.name && sf.lastModified === file.lastModified))) 
      {
         if(!(inputMode === 'image' && fileType === 'general' && countForRejectionCheck < currentMaxFiles)) { 
            rejectedFilesMessages.push(`${file.name} (limit of ${currentMaxFiles} file${currentMaxFiles > 1 ? 's' : ''} for this type reached)`);
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
    
    if (fileType !== 'general') {
        setFilesFunction(newValidFiles.slice(0, currentMaxFiles));
    } else {
        const combinedFiles = (inputMode === 'image' && (event?.target as HTMLInputElement)?.multiple) 
                                ? [...currentFilesArray, ...newValidFiles].slice(0, currentMaxFiles) 
                                : newValidFiles.slice(0, currentMaxFiles);
        setFilesFunction(combinedFiles);
    }

    if (rejectedFilesMessages.length > 0) {
      currentBatchError = `Some files were not added: ${rejectedFilesMessages.join(', ')}. Max ${currentMaxFiles} file${currentMaxFiles > 1 ? 's' : ''}, ${MAX_FILE_SIZE_MB}MB/file, images only.`;
    }
    setError(currentBatchError); 

    if (fileType === 'general') {
        setTextConcept(''); 
        setGeneratedPrompts([]);
        setCharacterSheetPrompts([]); 
        setGlobalProcessingError(null);
        setSuggestionsText('');
        setCharacterSheetSuggestionsText('');

        if (inputMode === 'characterSheet') {
            const filesForCharSheet = selectedFiles; 
            if (filesForCharSheet.length === 1 && newValidFiles.length > 0) { 
                try {
                    const imageInput = await fileToBase64WithType(filesForCharSheet[0]);
                    setCharacterSheetImageInput(imageInput);
                    if (currentBatchError) setError(currentBatchError);
                    else setError(null);
                } catch (err: any) {
                    const specificErrorMsg = `Error processing image for character sheet: ${err.message || 'Unknown error'}. Please try a different image.`;
                    setError(specificErrorMsg);
                    setCharacterSheetImageInput(null);
                }
            } else if (filesForCharSheet.length !== 1) {
                setCharacterSheetImageInput(null);
                if (filesForCharSheet.length > 1 && !currentBatchError) {
                     setError(`Please select only ${MAX_FILES_CHARACTER_SHEET} image for Character Sheet mode.`)
                } else if (currentBatchError) {
                    setError(currentBatchError);
                }
            }
        } else {
            setCharacterSheetImageInput(null);
        }
    } else if (fileType === 'garment') { 
        clearSubsequentFashionStates();
        // Prepare garment images for Replicate selection
        const replicateReadyImages = await Promise.all(
            newValidFiles.slice(0, MAX_FILES_FASHION_PROMPT).map(async (file) => {
                const reader = new FileReader();
                return new Promise<ReplicateInputImage>((resolve, reject) => {
                    reader.onloadend = () => resolve({ file, dataUrl: reader.result as string });
                    reader.onerror = () => reject(new Error(`Failed to read ${file.name} for Replicate selection.`));
                    reader.readAsDataURL(file);
                });
            })
        );
        setAvailableGarmentImagesForReplicate(replicateReadyImages);
        setReplicateInputImage1(null); // Clear selections if garment files change
        setReplicateInputImage2(null);

    } 

  }, [selectedFiles, fashionGarmentFiles, fashionBackgroundRefFiles, fashionModelRefFiles, inputMode, MAX_FILES_CHARACTER_SHEET, MAX_FILES_FASHION_PROMPT, MAX_FILES_FASHION_BACKGROUND_REF, MAX_FILES_FASHION_MODEL_REF, MAX_FILES_FUSION, MAX_FILES_BATCH_UPLOAD, MAX_FILE_SIZE_BYTES]);


  useEffect(() => {
    if ((inputMode === 'image' || inputMode === 'characterSheet') && selectedFiles.length === 1) {
      const file = selectedFiles[0];
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.onerror = () => { setError("Error reading image for preview."); setPreviewUrl(null); };
      reader.readAsDataURL(file);
    } else if (inputMode === 'image' && selectedFiles.length > 1) {
      setPreviewUrl(null); 
    } else if (inputMode !== 'fashionPrompt' && inputMode !== 'imageFusion' && inputMode !== 'characterSheet') { 
      setPreviewUrl(null);
    }

    if (inputMode === 'imageFusion' && selectedFiles.length > 0) {
      const filePromises = selectedFiles.map(file => 
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        })
      );
      Promise.all(filePromises)
        .then(setImagePreviews)
        .catch(err => {
          setError("Error creating previews for fusion images.");
          setImagePreviews([]);
        });
    } else if (inputMode !== 'imageFusion') {
      setImagePreviews([]);
    }

    if (inputMode === 'fashionPrompt' && fashionGarmentFiles.length > 0) {
        const filePromises = fashionGarmentFiles.map(file => 
            new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error(`Failed to read ${file.name} for fashion garment preview.`));
                reader.readAsDataURL(file);
            })
        );
        Promise.all(filePromises)
            .then(setFashionGarmentPreviewUrls)
            .catch(err => {
                setError(err.message || "Error creating previews for fashion garment images.");
                setFashionGarmentPreviewUrls([]);
            });
    } else if (inputMode !== 'fashionPrompt') {
       setFashionGarmentPreviewUrls([]);
    }
    
    if (inputMode === 'fashionPrompt' && fashionBackgroundRefFiles.length > 0) {
        const filePromises = fashionBackgroundRefFiles.map(file => 
            new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error(`Failed to read ${file.name} for background ref preview.`));
                reader.readAsDataURL(file);
            })
        );
        Promise.all(filePromises)
            .then(setFashionBackgroundRefPreviewUrls)
            .catch(err => {
                setError(err.message || "Error creating previews for background reference images.");
                setFashionBackgroundRefPreviewUrls([]);
            });
    } else if (inputMode !== 'fashionPrompt') {
       setFashionBackgroundRefPreviewUrls([]);
    }

    if (inputMode === 'fashionPrompt' && fashionModelRefFiles.length > 0) {
        const filePromises = fashionModelRefFiles.map(file => 
            new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error(`Failed to read ${file.name} for model ref preview.`));
                reader.readAsDataURL(file);
            })
        );
        Promise.all(filePromises)
            .then(setFashionModelRefPreviewUrls)
            .catch(err => {
                setError(err.message || "Error creating previews for model reference images.");
                setFashionModelRefPreviewUrls([]);
            });
    } else if (inputMode !== 'fashionPrompt') {
       setFashionModelRefPreviewUrls([]);
    }

  }, [selectedFiles, inputMode, fashionGarmentFiles, fashionBackgroundRefFiles, fashionModelRefFiles]);


  const clearSubsequentFashionStates = (clearFullReplicate: boolean = true) => {
    setFashionPromptData(null);
    setFashionAnalysisError(null);
    setGeneratedFashionImageFile(null);
    setGeneratedFashionImagePreviewUrl(null);
    setRefinedStudioPrompts(null);
    setFashionQaFindings(null);
    setFashionQaError(null);
    setFashionInitialJsonPromptCopied(false);

    if (clearFullReplicate) {
        setShowReplicatePanel(false);
        setReplicatePromptText('');
        setReplicatePromptTitle('');
        setReplicateInputImage1(null);
        setReplicateInputImage2(null);
        setReplicateResultImageUrl(null);
        setReplicateError(null);
        setIsReplicateLoading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, fileType: 'garment' | 'backgroundRef' | 'modelRef' | 'general' = 'general') => {
    if (event.target.files) {
      const target = event.target as HTMLInputElement; 
      if (fileType === 'garment') {
          setFashionGarmentFiles([]); 
          setFashionGarmentPreviewUrls([]);
          clearSubsequentFashionStates(); 
          setAvailableGarmentImagesForReplicate([]); 
      } else if (fileType === 'backgroundRef') {
          setFashionBackgroundRefFiles([]);
          setFashionBackgroundRefPreviewUrls([]);
          clearSubsequentFashionStates(false); 
      } else if (fileType === 'modelRef') {
          setFashionModelRefFiles([]);
          setFashionModelRefPreviewUrls([]);
          clearSubsequentFashionStates(false);
      } else if (inputMode === 'characterSheet' || inputMode === 'imageFusion' || (inputMode === 'image' && !target.multiple) ) {
          setSelectedFiles([]); 
          setImagePreviews([]);
          setPreviewUrl(null);
          setCharacterSheetImageInput(null); 
      }
      await processFiles(event.target.files, fileType);
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
            setAvailableGarmentImagesForReplicate([]);
            await processFiles(pastedFiles, 'garment');
        } else if (inputMode === 'characterSheet' || inputMode === 'imageFusion' || (inputMode === 'image' && pastedFiles.length === 1) ) {
            setSelectedFiles([]); 
            setImagePreviews([]);
            setPreviewUrl(null);
            setCharacterSheetImageInput(null); 
            await processFiles(pastedFiles, 'general');
        } else if (inputMode === 'image') { 
            await processFiles(pastedFiles, 'general');
        }
    }
  }, [inputMode, isLoading, fashionIsLoadingAnalysis, fashionQaIsLoading, processFiles]);

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>, fileType: 'garment' | 'backgroundRef' | 'modelRef' | 'general' = 'general') => {
    event.preventDefault();
    event.stopPropagation();
    if ((inputMode !== 'image' && inputMode !== 'imageFusion' && inputMode !== 'characterSheet' && inputMode !== 'fashionPrompt') || isLoading || fashionIsLoadingAnalysis || fashionQaIsLoading) return;
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      if (fileType === 'garment') {
          setFashionGarmentFiles([]); 
          setFashionGarmentPreviewUrls([]);
          clearSubsequentFashionStates();
          setAvailableGarmentImagesForReplicate([]);
      } else if (fileType === 'backgroundRef') {
          setFashionBackgroundRefFiles([]);
          setFashionBackgroundRefPreviewUrls([]);
          clearSubsequentFashionStates(false);
      } else if (fileType === 'modelRef') {
          setFashionModelRefFiles([]);
          setFashionModelRefPreviewUrls([]);
          clearSubsequentFashionStates(false);
      } else if (inputMode === 'characterSheet' || inputMode === 'imageFusion' || (inputMode === 'image' && event.dataTransfer.files.length ===1) ) {
          setSelectedFiles([]); 
          setImagePreviews([]);
          setPreviewUrl(null);
          setCharacterSheetImageInput(null); 
      }
      await processFiles(event.dataTransfer.files, fileType);
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

  const clearSelectedFilesForMode = (fileType: 'garment' | 'backgroundRef' | 'modelRef' | 'general' = 'general') => { 
    if (fileType === 'garment') {
        setFashionGarmentFiles([]);
        setFashionGarmentPreviewUrls([]);
        clearSubsequentFashionStates(); 
        setAvailableGarmentImagesForReplicate([]);
        setReplicateInputImage1(null);
        setReplicateInputImage2(null);
    } else if (fileType === 'backgroundRef') {
        setFashionBackgroundRefFiles([]);
        setFashionBackgroundRefPreviewUrls([]);
        clearSubsequentFashionStates(false); 
    } else if (fileType === 'modelRef') {
        setFashionModelRefFiles([]);
        setFashionModelRefPreviewUrls([]);
        clearSubsequentFashionStates(false); 
    } else { 
        setSelectedFiles([]);
        setPreviewUrl(null);
        setImagePreviews([]);
        setCharacterSheetImageInput(null);
        setGeneratedPrompts([]); 
        setCharacterSheetPrompts([]);
        setSuggestionsText('');
        setCharacterSheetSuggestionsText('');
        setCrazyShotBackgroundIdea('');
    }
    setError(null); 
    setGlobalProcessingError(null);
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
        setFashionQaFindings(null);
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
    setFashionQaFindings(null);
    setFashionQaError(null);
  };


  const handleSubmit = async () => {
    setIsLoading(true);
    setGeneratedPrompts([]);
    setCharacterSheetPrompts([]);
    setError(null); 
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
            const imageInputs = await Promise.all(filesToFuse.map(file => fileToBase64WithType(file)));
            const promptText = await generateDetailedPrompt({ imagesToProcess: imageInputs });
            setGeneratedPrompts([{ id: itemId, fileName: 'Fused Prompt', prompt: promptText, isCopied: false, originalInput: { type: 'imageFusion', files: filesToFuse } }]);
        } catch (err: any) {
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
        setGeneratedPrompts([{ id: itemId, fileName: 'Text Concept', error: err.message || "Failed to generate prompt from text concept.", isCopied: false, originalInput: { type: 'text' as 'text', concept: currentTextConcept } }]);
        setGlobalProcessingError(err.message || "Failed to generate prompt from text concept.");
      }
    } else {
      if (inputMode === 'image' && selectedFiles.length === 0) setError("Please select one or more image files.");
      else if (inputMode === 'imageFusion' && (selectedFiles.length < MIN_FILES_FUSION || selectedFiles.length > MAX_FILES_FUSION)) setError(`Please select ${MIN_FILES_FUSION} to ${MAX_FILES_FUSION} images for fusion.`);
      else if (inputMode === 'characterSheet') {
        if (selectedFiles.length !== MAX_FILES_CHARACTER_SHEET) setError(`Please select ${MAX_FILES_CHARACTER_SHEET} image for the character sheet.`);
        else if (!characterSheetImageInput) setError(`Image for character sheet not processed or invalid. Please re-select or try a different image.`);
      }
      else if (inputMode === 'text' && textConcept.trim() === '') setError("Please enter a text concept.");
    }
    setIsLoading(false);
  };

  const handleGenerateFashionAnalysis = async () => {
    if (fashionGarmentFiles.length === 0) {
        setFashionAnalysisError(`Please upload 1 or ${MAX_FILES_FASHION_PROMPT} garment image(s) first.`);
        return;
    }
    setFashionIsLoadingAnalysis(true);
    setFashionAnalysisError(null); 
    setFashionPromptData(null);    
    clearSubsequentFashionStates(); 

    try {
        const garmentImageInputs = await Promise.all(fashionGarmentFiles.map(file => fileToBase64WithType(file)));
        const backgroundRefImageInputs = fashionBackgroundRefFiles.length > 0 
            ? await Promise.all(fashionBackgroundRefFiles.map(file => fileToBase64WithType(file)))
            : undefined;
        const modelRefImageInputs = fashionModelRefFiles.length > 0
            ? await Promise.all(fashionModelRefFiles.map(file => fileToBase64WithType(file)))
            : undefined;

        const results = await generateFashionAnalysisAndInitialJsonPrompt(
            garmentImageInputs,
            backgroundRefImageInputs,
            modelRefImageInputs,
            fashionAnalysisSystemPrompt || undefined
        );
        setFashionPromptData(results);
    } catch (err: any) {
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
    setFashionQaFindings(null);
    setShowReplicatePanel(false); // Hide replicate panel if it was open for a previous QA'd prompt

    try {
        const originalGarmentImageInputs = await Promise.all(fashionGarmentFiles.map(file => fileToBase64WithType(file)));
        const generatedFashionImageInput = await fileToBase64WithType(generatedFashionImageFile);

        const results = await performQaAndGenerateStudioPrompts(
            originalGarmentImageInputs,
            generatedFashionImageInput,
            fashionPromptData,
            fashionQaSystemPrompt || undefined
        );
        
        setFashionQaFindings(results.qaFindings);
        setRefinedStudioPrompts(results.prompts.map(p => ({
            id: `${p.title.replace(/\s+/g, '-')}-${Date.now()}`,
            title: p.title,
            prompt: p.prompt,
            isCopied: false,
        })));

    } catch (err: any) {
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
      if (!item.prompt || item.error) return item; 
      try {
        let refinedPromptText = '';
        if (item.originalInput.type === 'image') {
          const { base64, mimeType } = await fileToBase64WithType(item.originalInput.file);
          refinedPromptText = await generateDetailedPrompt({ 
            imagesToProcess: [{ base64, mimeType }], 
            refinementSuggestions: suggestionsText.trim()
          });
        } else if (item.originalInput.type === 'imageFusion') {
            const imageInputs = await Promise.all(item.originalInput.files.map(file => fileToBase64WithType(file)));
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
      setGlobalProcessingError(err.message || "Failed to refine character sheet prompts.");
    }
    setIsLoading(false);
  };


  const handleCopyToClipboard = (textToCopy: string, onCopySuccess: () => void, onCopyError?: (err: any) => void) => {
    navigator.clipboard.writeText(textToCopy)
        .then(onCopySuccess)
        .catch(err => {
            console.error("Failed to copy:", err);
            if (onCopyError) onCopyError(err);
        });
  };

  const handleCopyImageToClipboard = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      // Could add UI feedback here
    } catch (err) {
      console.error('Failed to copy image:', err);
      // Fallback: copy the URL instead
      navigator.clipboard.writeText(imageUrl);
    }
  };

  const handleDownloadImage = async (imageUrl: string, filename: string = 'generated-image') => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download image:', err);
    }
  };

  const handleSendToQA = async (imageUrl: string) => {
    try {
      // Convert image URL to File object
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'generated-initial-image.png', { type: 'image/png' });
      
      // Set the generated fashion image
      setGeneratedFashionImageFile(file);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(blob);
      setGeneratedFashionImagePreviewUrl(previewUrl);
      
      // Scroll to QA section
      setTimeout(() => {
        const qaSection = document.getElementById('qa-section');
        if (qaSection) {
          qaSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      console.error('Failed to send image to QA:', err);
    }
  };

  const copyGeneratedPrompt = (itemId: string) => {
    const promptItem = generatedPrompts.find(p => p.id === itemId);
    if (promptItem && promptItem.prompt) {
        handleCopyToClipboard(promptItem.prompt, 
            () => {
                setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: true } : p));
                setTimeout(() => setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: false } : p)), 2000);
            },
            () => setGeneratedPrompts(prev => prev.map(p => p.id === itemId ? { ...p, error: (p.error || "") + " Copy failed." } : p))
        );
    }
  };

  const copyCharacterSheetPrompt = (itemId: string) => {
    const promptItem = characterSheetPrompts.find(p => p.id === itemId);
     if (promptItem && promptItem.prompt) {
        handleCopyToClipboard(promptItem.prompt,
            () => {
                setCharacterSheetPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: true } : p));
                setTimeout(() => setCharacterSheetPrompts(prev => prev.map(p => p.id === itemId ? { ...p, isCopied: false } : p)), 2000);
            },
            () => setCharacterSheetPrompts(prev => prev.map(p => p.id === itemId ? { ...p, error: (p.error || "") + " Copy failed." } : p))
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
            () => setFashionAnalysisError((prevError) => (prevError ? prevError + " " : "") + "Failed to copy initial JSON prompt.")
        );
    }
  };

  const handleGenerateInitialPromptImage = async () => {
    if (!fashionPromptData?.initialJsonPrompt || !fashionGarmentFiles.length) return;

    setIsGeneratingInitialImage(true);
    setInitialImageError(null);
    
    try {
      // Prepare garment images if not already available
      let garmentImages = availableGarmentImagesForReplicate;
      if (garmentImages.length === 0) {
        garmentImages = await Promise.all(
          fashionGarmentFiles.map(async (file) => {
            const reader = new FileReader();
            return new Promise<ReplicateInputImage>((resolve, reject) => {
              reader.onloadend = () => resolve({ file, dataUrl: reader.result as string });
              reader.onerror = () => reject(new Error(`Failed to read ${file.name} for generation.`));
              reader.readAsDataURL(file);
            });
          })
        );
      }

      const replicateInputs: any = {
        prompt: fashionPromptData.initialJsonPrompt,
        aspect_ratio: '1:1',
      };

      // Use first two garment images if available
      if (garmentImages.length >= 2) {
        replicateInputs.input_image_1 = garmentImages[0].dataUrl;
        replicateInputs.input_image_2 = garmentImages[1].dataUrl;
      } else if (garmentImages.length === 1) {
        // Use the same image twice if only one is available
        replicateInputs.input_image_1 = garmentImages[0].dataUrl;
        replicateInputs.input_image_2 = garmentImages[0].dataUrl;
      } else {
        throw new Error("No garment images available for generation.");
      }

      const resultUrl = await generateImageViaReplicate(replicateInputs);
      setInitialPromptGeneratedImageUrl(resultUrl);
    } catch (err: any) {
      setInitialImageError(err.message || 'Failed to generate image for initial prompt.');
    } finally {
      setIsGeneratingInitialImage(false);
    }
  };

  const handleGenerateQAPromptImage = async (itemId: string) => {
    if (!refinedStudioPrompts) return;
    
    const promptItem = refinedStudioPrompts.find(p => p.id === itemId);
    if (!promptItem?.prompt) return;

    setRefinedStudioPrompts(prev => 
      prev!.map(p => p.id === itemId ? { ...p, isGeneratingImage: true, imageError: undefined } : p)
    );

    try {
      // Prepare garment images if not already available
      let garmentImages = availableGarmentImagesForReplicate;
      if (garmentImages.length === 0) {
        garmentImages = await Promise.all(
          fashionGarmentFiles.map(async (file) => {
            const reader = new FileReader();
            return new Promise<ReplicateInputImage>((resolve, reject) => {
              reader.onloadend = () => resolve({ file, dataUrl: reader.result as string });
              reader.onerror = () => reject(new Error(`Failed to read ${file.name} for generation.`));
              reader.readAsDataURL(file);
            });
          })
        );
      }

      const replicateInputs: any = {
        prompt: promptItem.prompt,
        aspect_ratio: '1:1',
      };

      let inputStrategy = '';

      // Strategy: Use garment as first image, and studio front-facing image as second if available
      if (garmentImages.length >= 1) {
        replicateInputs.input_image_1 = garmentImages[0].dataUrl;
        
        // Look for a studio front-facing generated image to use as second input
        const studioFrontPrompt = refinedStudioPrompts.find(p => 
          p.generatedImageUrl && 
          (p.title.toLowerCase().includes('studio') && p.title.toLowerCase().includes('front'))
        );
        
        if (studioFrontPrompt?.generatedImageUrl) {
          // Use the studio front-facing image as second input
          replicateInputs.input_image_2 = studioFrontPrompt.generatedImageUrl;
          inputStrategy = `Using: Garment + Studio Front-Facing Image (${studioFrontPrompt.title})`;
        } else if (garmentImages.length >= 2) {
          // Fallback to second garment image
          replicateInputs.input_image_2 = garmentImages[1].dataUrl;
          inputStrategy = 'Using: First Garment + Second Garment Image';
        } else {
          // Use the same garment image twice
          replicateInputs.input_image_2 = garmentImages[0].dataUrl;
          inputStrategy = 'Using: Garment Image (duplicated for both inputs)';
        }
      } else {
        throw new Error("No garment images available for generation.");
      }

      console.log(`Generation strategy for ${promptItem.title}: ${inputStrategy}`);

      const resultUrl = await generateImageViaReplicate(replicateInputs);
      
      setRefinedStudioPrompts(prev => 
        prev!.map(p => p.id === itemId ? { 
          ...p, 
          isGeneratingImage: false, 
          generatedImageUrl: resultUrl,
          imageError: undefined 
        } : p)
      );
    } catch (err: any) {
      setRefinedStudioPrompts(prev => 
        prev!.map(p => p.id === itemId ? { 
          ...p, 
          isGeneratingImage: false, 
          imageError: err.message || 'Failed to generate image.'
        } : p)
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
                setTimeout(() => setRefinedStudioPrompts(prev => prev!.map(p => p.id === itemId ? { ...p, isCopied: false } : p)), 2000);
            },
            () => setRefinedStudioPrompts(prev => prev!.map(p => p.id === itemId ? { ...p, error: (p.error || "") + " Copy failed." } : p))
        );
    }
  };

  const handleOpenReplicatePanel = (promptText: string, promptTitle: string) => {
    setReplicatePromptText(promptText);
    setReplicatePromptTitle(promptTitle);
    setShowReplicatePanel(true);
    setReplicateResultImageUrl(null);
    setReplicateError(null);
    // setReplicateInputImage1(null); // Keep previous selections or clear? Let's clear for fresh start.
    // setReplicateInputImage2(null);
    // setReplicateAspectRatio('1:1'); // Keep previous or reset? Reset.
    // Update available garment images from current fashionGarmentFiles
    Promise.all(
        fashionGarmentFiles.map(async (file) => {
            const reader = new FileReader();
            return new Promise<ReplicateInputImage>((resolve, reject) => {
                reader.onloadend = () => resolve({ file, dataUrl: reader.result as string });
                reader.onerror = () => reject(new Error(`Failed to read ${file.name} for Replicate selection.`));
                reader.readAsDataURL(file);
            });
        })
    ).then(images => {
        setAvailableGarmentImagesForReplicate(images);
        // Auto-select first two images if available and none selected
        if (images.length >= 2 && !replicateInputImage1 && !replicateInputImage2) {
            setReplicateInputImage1(images[0]);
            setReplicateInputImage2(images[1]);
        } else if (images.length >= 1 && !replicateInputImage1) {
            setReplicateInputImage1(images[0]);
        }
    }).catch(err => {
        console.error("Error preparing garment images for Replicate:", err);
        setReplicateError("Error preparing garment images for selection.");
    });
  };

  const handleToggleReplicateImageSelection = (image: ReplicateInputImage, slot: 1 | 2) => {
    const isSameFile = (img1: ReplicateInputImage | null, img2: ReplicateInputImage) => {
        return img1?.file.name === img2.file.name && img1?.file.lastModified === img2.file.lastModified;
    };

    if (slot === 1) {
        // If clicking on currently selected image in slot 1, deselect it
        if (isSameFile(replicateInputImage1, image)) {
            setReplicateInputImage1(null);
        } else {
            // Select it for slot 1
            setReplicateInputImage1(image);
        }
    } else { // slot === 2
        // If clicking on currently selected image in slot 2, deselect it
        if (isSameFile(replicateInputImage2, image)) {
            setReplicateInputImage2(null);
        } else {
            // Select it for slot 2
            setReplicateInputImage2(image);
        }
    }
  };

  const handleGenerateWithReplicate = async () => {
    setIsReplicateLoading(true);
    setReplicateResultImageUrl(null);
    setReplicateError(null);

    const replicateInputs: any = {
      prompt: replicatePromptText,
      aspect_ratio: replicateAspectRatio,
    };

    if (replicateInputImage1) {
      // In a real scenario, you'd upload this file and get a public URL, or send base64 if supported by API.
      // For this mock, we'll use the dataUrl we prepared for previews.
      replicateInputs.input_image_1 = replicateInputImage1.dataUrl;
    }
    if (replicateInputImage2) {
      replicateInputs.input_image_2 = replicateInputImage2.dataUrl;
    }
    
    // The Replicate model flux-kontext-apps/multi-image-kontext-max seems to prefer input_image_1 if images are used.
    // If only one image is selected for Replicate, ensure it goes to input_image_1.
    if (!replicateInputs.input_image_1 && replicateInputs.input_image_2) {
        replicateInputs.input_image_1 = replicateInputs.input_image_2;
        delete replicateInputs.input_image_2;
    }


    try {
      const resultUrl = await generateImageViaReplicate(replicateInputs);
      setReplicateResultImageUrl(resultUrl);
    } catch (err: any) {
      setReplicateError(err.message || 'Failed to generate image with Replicate.');
    } finally {
      setIsReplicateLoading(false);
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

  const canSubmitReplicate = (): boolean => {
    if (isReplicateLoading || !replicatePromptText) return false;
    // The flux-kontext-apps/multi-image-kontext-max model requires both input images
    return !!(replicateInputImage1 && replicateInputImage2);
  };

  const hasSuccessfulPrompts = generatedPrompts.some(p => p.prompt && !p.error);
  const hasCharacterSheetPrompts = characterSheetPrompts.some(p => p.prompt && !p.error);
  
  const getUploadAreaMessage = (
    type: 'garment' | 'backgroundRef' | 'modelRef' | 'general' = 'general'
    ) => {
    if (type === 'garment') {
        const remainingSlots = MAX_FILES_FASHION_PROMPT - fashionGarmentFiles.length;
        if (fashionGarmentFiles.length > 0 && fashionGarmentFiles.length < MAX_FILES_FASHION_PROMPT) {
             return `Add up to ${remainingSlots} more garment image(s), or click to replace. (Max ${MAX_FILES_FASHION_PROMPT})`;
        }
        return `Drag & drop 1 or ${MAX_FILES_FASHION_PROMPT} garment images, or click.`;
    }
    if (type === 'backgroundRef') {
        return `Optional: Drag & drop up to ${MAX_FILES_FASHION_BACKGROUND_REF} background refs, or click.`;
    }
    if (type === 'modelRef') {
        return `Optional: Drag & drop up to ${MAX_FILES_FASHION_MODEL_REF} model refs, or click.`;
    }
    // General types
    if (inputMode === 'imageFusion') {
      if (selectedFiles.length > 0 && selectedFiles.length < MIN_FILES_FUSION) {
        return `Need ${MIN_FILES_FUSION - selectedFiles.length} more image(s) for fusion. (Min ${MIN_FILES_FUSION}, Max ${MAX_FILES_FUSION})`;
      }
      return `Drag & drop ${MIN_FILES_FUSION}-${MAX_FILES_FUSION} images, or click.`;
    }
    if (inputMode === 'characterSheet') {
      return `Drag & drop ${MAX_FILES_CHARACTER_SHEET} image for character sheet, or click.`;
    }
    // Default (image batch)
    const remainingSlots = MAX_FILES_BATCH_UPLOAD - selectedFiles.length;
    if (inputMode === 'image' && selectedFiles.length > 0 && selectedFiles.length < MAX_FILES_BATCH_UPLOAD) {
        return `Add up to ${remainingSlots} more image(s), or click to replace current. (Max ${MAX_FILES_BATCH_UPLOAD})`;
    }
    return `Drag & drop images, or click. (Max ${MAX_FILES_BATCH_UPLOAD})`;
  };

  const renderFileUploadArea = (
    areaType: 'garment' | 'backgroundRef' | 'modelRef' | 'general',
    files: File[],
    previewUrls: string[],
    maxFiles: number,
    inputAccept: string = "image/*",
    isMultiple: boolean = true,
    mainIcon?: React.ReactNode,
    title?: string,
    fileInputIdSuffix: string = areaType
  ) => {
    let CurrentSpecificIconComponent = mainIcon || UploadIcon; 
    if (areaType === 'garment') CurrentSpecificIconComponent = ShirtIcon;
    else if (areaType === 'backgroundRef') CurrentSpecificIconComponent = PhotoIcon;
    else if (areaType === 'modelRef') CurrentSpecificIconComponent = UserGroupIcon;
    else if (inputMode === 'imageFusion' && areaType === 'general') CurrentSpecificIconComponent = SquaresPlusIcon;
    else if (inputMode === 'characterSheet' && areaType === 'general') CurrentSpecificIconComponent = UserCircleIcon;


    let previewContent = null;
    if (previewUrls.length > 0 && (areaType !== 'general' || (inputMode !== 'image' && inputMode !== 'characterSheet'))) {
         previewContent = (
            <div className="mb-4">
                {title && <h3 className="font-semibold text-sky-400 mb-2 text-left">{title} ({previewUrls.length}/{maxFiles}):</h3>}
                 <div className={`flex flex-wrap justify-center items-center gap-2 ${previewUrls.length === 1 ? 'max-h-52' : 'max-h-32 md:max-h-40'} overflow-y-auto pretty-scrollbar p-1`}>
                    {previewUrls.map((src, index) => (
                        <img 
                            key={`${areaType}-${index}`} 
                            src={src} 
                            alt={`${areaType} preview ${index + 1}`} 
                            className={`object-contain rounded-md shadow-md border border-zinc-700 ${previewUrls.length === 1 ? 'max-h-48 w-auto mx-auto' : 'h-20 w-20 md:h-28 md:w-28'}`} 
                        />
                    ))}
                </div>
            </div>
        );
    } else if (areaType === 'general' && (inputMode === 'image' || inputMode === 'characterSheet') && previewUrl && files.length === 1) { 
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
    } else if (areaType === 'general' && inputMode === 'image' && files.length > 0) { 
        previewContent = (
            <div className="mb-4 text-left">
                <h3 className="font-semibold text-sky-400 mb-2">Selected Files ({files.length}/{maxFiles}):</h3>
                <ul className="list-disc list-inside text-gray-300 max-h-40 overflow-y-auto space-y-1 text-sm pretty-scrollbar pr-2">
                    {files.map(file => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}
                </ul>
            </div>
        );
    } else { 
        const IconToRender = CurrentSpecificIconComponent; 
        previewContent = (
            <div className="flex flex-col items-center">
                 {React.isValidElement(IconToRender) ? (
                    IconToRender 
                 ) : typeof IconToRender === 'function' ? (
                    <IconToRender className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
                 ) : (
                    <UploadIcon className="w-12 h-12 text-zinc-500 mx-auto mb-3" /> 
                 )}
            </div>
        );
    }
    
    let fileLimitsText = '';
    if (areaType === 'garment') fileLimitsText = `1 or ${maxFiles} images. `;
    else if (areaType === 'backgroundRef') fileLimitsText = `Max ${maxFiles} images. `;
    else if (areaType === 'modelRef') fileLimitsText = `Max ${maxFiles} images. `;
    else if (inputMode === 'imageFusion') fileLimitsText = `Min ${MIN_FILES_FUSION}, Max ${maxFiles} images. `;
    else if (inputMode === 'characterSheet') fileLimitsText = `Exactly ${maxFiles} image. `;
    else fileLimitsText = `Max ${maxFiles} files. `;

    return (
        <div 
          className="border-2 border-dashed border-zinc-600 hover:border-sky-500 rounded-lg p-4 md:p-6 text-center cursor-pointer transition-colors duration-200"
          onDrop={(e) => handleDrop(e, areaType)}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById(`fileInput-${fileInputIdSuffix}`)?.click()}
          role="button"
          tabIndex={0}
          aria-label={`${title || areaType} image upload area: ${getUploadAreaMessage(areaType)}`}
        >
          <input
            type="file"
            id={`fileInput-${fileInputIdSuffix}`}
            accept={inputAccept}
            multiple={isMultiple}
            onChange={(e) => handleFileChange(e, areaType)}
            className="hidden"
            aria-hidden="true"
          />
          {previewContent}
          <p className="text-gray-400 text-sm">{getUploadAreaMessage(areaType)}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {fileLimitsText}
            {MAX_FILE_SIZE_MB}MB per image. PNG, JPG, GIF, WEBP.
          </p>
          {files.length > 0 && (
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); clearSelectedFilesForMode(areaType); }} className="mt-3 text-xs !py-1 !px-2">
                <XCircleIcon className="w-3.5 h-3.5" /> Clear Selection
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
        {replicateError && inputMode === 'fashionPrompt' && showReplicatePanel && <Alert type="error" message={replicateError} onClose={() => setReplicateError(null)} />}


        <div className="bg-zinc-800 p-6 rounded-xl shadow-xl space-y-6">
          {inputMode === 'text' ? (
            <textarea
              value={textConcept}
              onChange={(e) => setTextConcept(e.target.value)}
              placeholder="e.g., A futuristic cityscape at sunset, neon lights reflecting on wet streets, a lone figure walking towards a massive skyscraper..."
              className="w-full h-40 p-4 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 resize-none placeholder-zinc-500 pretty-scrollbar"
              aria-label="Text concept input"
            />
          ) : inputMode === 'fashionPrompt' ? (
            <>
              {renderFileUploadArea('garment', fashionGarmentFiles, fashionGarmentPreviewUrls, MAX_FILES_FASHION_PROMPT, "image/*", true, <ShirtIcon className="w-12 h-12 text-zinc-500 mx-auto mb-3" />, "Garment Image(s)")}
              {renderFileUploadArea('backgroundRef', fashionBackgroundRefFiles, fashionBackgroundRefPreviewUrls, MAX_FILES_FASHION_BACKGROUND_REF, "image/*", true, <PhotoIcon className="w-12 h-12 text-zinc-500 mx-auto mb-3" />, "Background Reference Image(s) (Optional)")}
              {renderFileUploadArea('modelRef', fashionModelRefFiles, fashionModelRefPreviewUrls, MAX_FILES_FASHION_MODEL_REF, "image/*", true, <UserGroupIcon className="w-12 h-12 text-zinc-500 mx-auto mb-3" />, "Model Reference Image(s) (Optional)")}

              <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 mt-4 space-y-4">
                <h3 className="font-semibold text-sky-300">Advanced: System Prompt Overrides (Optional)</h3>
                <div>
                  <label className="block text-sm font-medium text-sky-300 mb-1">Analysis System Prompt Override</label>
                  <p className="text-xs text-zinc-400 mb-1">Default shown below. Edit the textarea to override it.</p>
                  <pre className="text-xs bg-zinc-900 border border-zinc-700 rounded-md p-2 mb-2 whitespace-pre-wrap pretty-scrollbar max-h-40 overflow-y-auto">
                    {buildDefaultFashionAnalysisSystemInstruction(
                      fashionGarmentFiles.length,
                      fashionBackgroundRefFiles.length > 0,
                      fashionModelRefFiles.length > 0
                    )}
                  </pre>
                  <textarea
                    value={fashionAnalysisSystemPrompt}
                    onChange={(e) => setFashionAnalysisSystemPrompt(e.target.value)}
                    placeholder="Leave blank to use the built-in analysis system prompt..."
                    className="w-full h-28 p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 resize-none placeholder-zinc-500 pretty-scrollbar text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-300 mb-1">QA System Prompt Override</label>
                  <p className="text-xs text-zinc-400 mb-1">Default shown below. Edit the textarea to override it.</p>
                  <pre className="text-xs bg-zinc-900 border border-zinc-700 rounded-md p-2 mb-2 whitespace-pre-wrap pretty-scrollbar max-h-40 overflow-y-auto">
                    {getDefaultFashionQaSystemInstruction()}
                  </pre>
                  <textarea
                    value={fashionQaSystemPrompt}
                    onChange={(e) => setFashionQaSystemPrompt(e.target.value)}
                    placeholder="Leave blank to use the built-in QA system prompt..."
                    className="w-full h-28 p-3 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 resize-none placeholder-zinc-500 pretty-scrollbar text-sm"
                  />
                </div>
                <p className="text-xs text-zinc-400">These values are saved locally in your browser and apply immediately without redeploying.</p>
              </div>
            </>
          ) : ( 
            renderFileUploadArea('general', selectedFiles, imagePreviews, 
                inputMode === 'imageFusion' ? MAX_FILES_FUSION : 
                inputMode === 'characterSheet' ? MAX_FILES_CHARACTER_SHEET : MAX_FILES_BATCH_UPLOAD,
                "image/*",
                inputMode === 'image' || inputMode === 'imageFusion'
            )
          )}

          {inputMode !== 'fashionPrompt' && (
            <Button 
                onClick={handleSubmit} 
                disabled={!canSubmitGeneral()}
                className="w-full text-lg"
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
                className="w-full text-lg"
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
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                        <h3 className="font-semibold text-sky-300">Initial JSON Prompt (Step 4)</h3>
                        <Button
                            onClick={() => handleOpenReplicatePanel(fashionPromptData.initialJsonPrompt, "Initial JSON Prompt")}
                            variant="secondary"
                            className="text-xs !py-1 !px-2 mt-2 sm:mt-0"
                            aria-label="Generate image with Replicate using Initial JSON Prompt"
                        >
                            <RocketLaunchIcon className="w-3.5 h-3.5" /> Generate with Replicate
                        </Button>
                    </div>
                    <p className="text-gray-200 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-72 overflow-y-auto">
                      {fashionPromptData.initialJsonPrompt}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                      <Button 
                          onClick={copyFashionInitialJsonPrompt}
                          variant="secondary" 
                          className="flex-1 sm:flex-none text-sm !py-2 !px-4"
                          aria-label="Copy initial JSON prompt to clipboard"
                      >
                        {fashionInitialJsonPromptCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                        {fashionInitialJsonPromptCopied ? 'Copied!' : 'Copy Prompt'}
                      </Button>
                      <Button 
                          onClick={handleGenerateInitialPromptImage}
                          disabled={isGeneratingInitialImage || !fashionGarmentFiles.length}
                          variant="primary" 
                          className="flex-1 sm:flex-none text-sm !py-2 !px-4"
                          aria-label="Generate image from initial JSON prompt"
                      >
                        {isGeneratingInitialImage ? <Spinner /> : <WandSparklesIcon className="w-5 h-5" />}
                        {isGeneratingInitialImage ? 'Generating...' : 'Create Image'}
                      </Button>
                    </div>
                    
                    {initialImageError && (
                      <Alert type="error" message={initialImageError} />
                    )}
                    
                    {initialPromptGeneratedImageUrl && (
                      <div className="mt-4 border-t border-zinc-700 pt-4">
                        <h4 className="font-medium text-sky-300 mb-2">Generated Image:</h4>
                        <div className="text-center">
                          <img 
                            src={initialPromptGeneratedImageUrl} 
                            alt="Generated from initial prompt" 
                            className="max-h-80 w-auto mx-auto rounded-md shadow-md mb-3 object-contain" 
                          />
                          <div className="flex justify-center gap-2 flex-wrap">
                            <Button 
                              onClick={() => handleCopyImageToClipboard(initialPromptGeneratedImageUrl)}
                              variant="secondary" 
                              size="sm"
                              className="text-xs !py-1 !px-2"
                            >
                              <ClipboardIcon className="w-4 h-4" /> Copy Image
                            </Button>
                            <Button 
                              onClick={() => handleDownloadImage(initialPromptGeneratedImageUrl, 'initial-prompt-image')}
                              variant="secondary" 
                              size="sm"
                              className="text-xs !py-1 !px-2"
                            >
                              <ArrowDownTrayIcon className="w-4 h-4" /> Download
                            </Button>
                            <Button 
                              onClick={() => handleSendToQA(initialPromptGeneratedImageUrl)}
                              variant="primary" 
                              size="sm"
                              className="text-xs !py-1 !px-2"
                            >
                              <ArrowRightCircleIcon className="w-4 h-4" /> Send to QA
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
                
                <div id="qa-section" className="border-t-2 border-zinc-700 pt-6 mt-8 space-y-6">
                    <h2 className="text-2xl font-semibold text-sky-400 mb-1">Step 2: QA & Prompt Generation</h2>
                    <p className="text-gray-400 text-sm mb-4">
                        Use the "Initial JSON Prompt" above or generate an image with Replicate. 
                        Then, upload the image you generated below to perform QA and get refined studio & lifestyle prompts.
                    </p>

                    <div className="bg-zinc-800 p-6 rounded-xl shadow-xl">
                        <label htmlFor="generatedFashionImageInput" className="block text-md font-medium text-sky-300 mb-3">
                            Upload Your Generated Image (from Initial Prompt or Replicate)
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

                    {fashionQaFindings && !fashionQaIsLoading && (
                        <div className="space-y-3">
                            <h2 className="text-2xl font-semibold text-sky-400">QA Findings</h2>
                            <p className="text-gray-200 bg-zinc-800 p-4 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-60 overflow-y-auto">
                                {fashionQaFindings}
                            </p>
                        </div>
                    )}

                    {refinedStudioPrompts && refinedStudioPrompts.length > 0 && !fashionQaIsLoading && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-semibold text-sky-400">Refined Studio & Lifestyle Prompts</h2>
                            {refinedStudioPrompts.map((item) => (
                            <div key={item.id} className="bg-zinc-800 p-5 rounded-lg shadow-lg">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                                    <h3 className="font-semibold text-sky-300">{item.title}</h3>
                                    <Button
                                        onClick={() => handleOpenReplicatePanel(item.prompt, item.title)}
                                        variant="secondary"
                                        className="text-xs !py-1 !px-2 mt-2 sm:mt-0"
                                        aria-label={`Generate image with Replicate using prompt: ${item.title}`}
                                    >
                                        <RocketLaunchIcon className="w-3.5 h-3.5" /> Generate with Replicate
                                    </Button>
                                </div>
                                {item.error ? (
                                <Alert type="error" message={item.error} />
                                ) : (
                                <div className="space-y-3">
                                    <p className="text-gray-200 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-48 overflow-y-auto">
                                    {item.prompt}
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <Button 
                                          onClick={() => copyRefinedStudioPrompt(item.id)}
                                          variant="secondary" 
                                          className="flex-1 sm:flex-none text-sm !py-2 !px-4"
                                          aria-label={`Copy prompt for ${item.title} to clipboard`}
                                      >
                                      {item.isCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                                      {item.isCopied ? 'Copied!' : 'Copy Prompt'}
                                      </Button>
                                      <Button 
                                          onClick={() => handleGenerateQAPromptImage(item.id)}
                                          disabled={item.isGeneratingImage || !fashionGarmentFiles.length}
                                          variant="primary" 
                                          className="flex-1 sm:flex-none text-sm !py-2 !px-4"
                                          aria-label={`Generate image from prompt: ${item.title}`}
                                      >
                                        {item.isGeneratingImage ? <Spinner /> : <WandSparklesIcon className="w-5 h-5" />}
                                        {item.isGeneratingImage ? 'Generating...' : 'Create Image'}
                                      </Button>
                                    </div>
                                    
                                    {item.imageError && (
                                      <Alert type="error" message={item.imageError} />
                                    )}
                                    
                                    {item.generatedImageUrl && (
                                      <div className="mt-4 border-t border-zinc-700 pt-4">
                                        <h4 className="font-medium text-sky-300 mb-2">Generated Image:</h4>
                                        <div className="text-center">
                                          <img 
                                            src={item.generatedImageUrl} 
                                            alt={`Generated from ${item.title}`} 
                                            className="max-h-80 w-auto mx-auto rounded-md shadow-md mb-3 object-contain" 
                                          />
                                          <div className="flex justify-center gap-2">
                                            <Button 
                                              onClick={() => handleCopyImageToClipboard(item.generatedImageUrl!)}
                                              variant="secondary" 
                                              size="sm"
                                              className="text-xs !py-1 !px-2"
                                            >
                                              <ClipboardIcon className="w-4 h-4" /> Copy Image
                                            </Button>
                                            <Button 
                                              onClick={() => handleDownloadImage(item.generatedImageUrl!, `${item.title.toLowerCase().replace(/\s+/g, '-')}-image`)}
                                              variant="secondary" 
                                              size="sm"
                                              className="text-xs !py-1 !px-2"
                                            >
                                              <ArrowDownTrayIcon className="w-4 h-4" /> Download
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                </div>
                                )}
                            </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {inputMode === 'fashionPrompt' && showReplicatePanel && (
          <div className="mt-8 border-t-2 border-sky-700 pt-6 space-y-6 bg-zinc-800 p-6 rounded-xl shadow-xl">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-sky-400">Replicate Image Generation</h2>
                <Button variant="secondary" onClick={() => setShowReplicatePanel(false)} className="!py-1 !px-2 text-xs">
                    <XCircleIcon className="w-4 h-4" /> Close Panel
                </Button>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label htmlFor="replicatePromptDisplay" className="block text-sm font-medium text-sky-300 mb-1">Using Prompt for: "{replicatePromptTitle}"</label>
                    <p id="replicatePromptDisplay" className="text-gray-300 bg-zinc-700 p-3 rounded-md whitespace-pre-wrap text-sm leading-relaxed pretty-scrollbar max-h-32 overflow-y-auto">
                        {replicatePromptText}
                    </p>
                </div>

                <div>
                    <label htmlFor="replicateAspectRatio" className="block text-sm font-medium text-sky-300 mb-1">Aspect Ratio</label>
                    <select
                        id="replicateAspectRatio"
                        value={replicateAspectRatio}
                        onChange={(e) => setReplicateAspectRatio(e.target.value)}
                        className="w-full p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200"
                    >
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3 (Landscape)</option>
                        <option value="3:4">3:4 (Portrait)</option>
                        <option value="3:2">3:2 (Landscape)</option>
                        <option value="2:3">2:3 (Portrait)</option>
                    </select>
                </div>

                {availableGarmentImagesForReplicate.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <p className="text-sm font-medium text-sky-300">Select Garment Images as Input (Required: Both slots must be filled)</p>
                            {availableGarmentImagesForReplicate.length >= 2 && (
                                <Button 
                                    onClick={() => {
                                        setReplicateInputImage1(availableGarmentImagesForReplicate[0]);
                                        setReplicateInputImage2(availableGarmentImagesForReplicate[1]);
                                    }}
                                    variant="secondary" 
                                    size="sm"
                                    className="text-xs !py-1 !px-2"
                                >
                                    Quick Select Both
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1">
                                    Input Image 1: {replicateInputImage1 ? `✅ ${replicateInputImage1.file.name}` : '❌ Not selected'}
                                </label>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {availableGarmentImagesForReplicate.map((img, idx) => (
                                        <button
                                            key={`repl-img1-sel-${idx}`}
                                            onClick={() => handleToggleReplicateImageSelection(img, 1)}
                                            className={`p-1 border-2 rounded-md transition-all ${
                                                replicateInputImage1?.file.name === img.file.name && replicateInputImage1?.file.lastModified === img.file.lastModified
                                                    ? 'border-sky-500 ring-2 ring-sky-500' 
                                                    : 'border-zinc-600 hover:border-sky-400'
                                            }`}
                                            aria-pressed={replicateInputImage1?.file.name === img.file.name && replicateInputImage1?.file.lastModified === img.file.lastModified}
                                            aria-label={`Select ${img.file.name} for Replicate Input Image 1`}
                                        >
                                            <img src={img.dataUrl} alt={img.file.name} className="h-16 w-16 object-contain rounded-sm"/>
                                        </button>
                                    ))}
                                    {replicateInputImage1 && (
                                        <Button variant="secondary" size="sm" onClick={() => setReplicateInputImage1(null)} className="text-xs !py-0.5 !px-1.5 self-start">
                                            <XCircleIcon className="w-3 h-3"/> Clear Slot 1
                                        </Button>
                                    )}
                                </div>
                            </div>
                             <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1">
                                    Input Image 2: {replicateInputImage2 ? `✅ ${replicateInputImage2.file.name}` : '❌ Not selected'}
                                </label>
                                 <div className="flex flex-wrap gap-2 items-center">
                                    {availableGarmentImagesForReplicate.map((img, idx) => (
                                        <button
                                            key={`repl-img2-sel-${idx}`}
                                            onClick={() => handleToggleReplicateImageSelection(img, 2)}
                                            className={`p-1 border-2 rounded-md transition-all ${
                                                replicateInputImage2?.file.name === img.file.name && replicateInputImage2?.file.lastModified === img.file.lastModified
                                                    ? 'border-sky-500 ring-2 ring-sky-500' 
                                                    : 'border-zinc-600 hover:border-sky-400'
                                            }`}
                                            aria-pressed={replicateInputImage2?.file.name === img.file.name && replicateInputImage2?.file.lastModified === img.file.lastModified}
                                            aria-label={`Select ${img.file.name} for Replicate Input Image 2`}
                                        >
                                            <img src={img.dataUrl} alt={img.file.name} className="h-16 w-16 object-contain rounded-sm"/>
                                        </button>
                                    ))}
                                    {replicateInputImage2 && (
                                         <Button variant="secondary" size="sm" onClick={() => setReplicateInputImage2(null)} className="text-xs !py-0.5 !px-1.5 self-start">
                                            <XCircleIcon className="w-3 h-3"/> Clear Slot 2
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                         <p className="text-xs text-zinc-500 mt-1">
                            The Replicate model being used requires both input images to work. Please select exactly two of your uploaded garment images.
                        </p>
                    </div>
                )}


                <Button
                    onClick={handleGenerateWithReplicate}
                    disabled={!canSubmitReplicate()}
                    className="w-full text-lg"
                    aria-label="Generate image using Replicate with current settings"
                >
                    {isReplicateLoading ? <Spinner /> : <RocketLaunchIcon className="w-5 h-5" />}
                    Start Image Generation (Replicate)
                </Button>
                
                {!canSubmitReplicate() && !isReplicateLoading && replicatePromptText && (
                    <p className="text-amber-400 text-sm mt-2 text-center">
                        ⚠️ Please select both input images (Image 1 and Image 2) to generate with this model.
                    </p>
                )}
            </div>

            {isReplicateLoading && (
                <div className="mt-4 p-4 bg-zinc-700 rounded-md text-center">
                    <Spinner className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sky-300">Generating image with Replicate...</p>
                     <p className="text-xs text-zinc-400 mt-1">This may take a few minutes depending on the model and queue.</p>
                </div>
            )}
            
            {replicateResultImageUrl && !isReplicateLoading && (
                <div className="mt-6">
                    <h3 className="text-xl font-semibold text-sky-300 mb-3">Generated Image:</h3>
                    <div className="bg-zinc-700 p-3 rounded-lg shadow-inner">
                        <img 
                            src={replicateResultImageUrl} 
                            alt="Image generated by Replicate" 
                            className="max-w-full h-auto mx-auto rounded-md shadow-md"
                            onError={() => {
                                setReplicateError("Failed to load the generated image. The URL might be invalid or expired (this is a mock URL).");
                                setReplicateResultImageUrl(null);
                            }}
                        />
                    </div>
                     <p className="text-xs text-zinc-500 mt-2 text-center">
                        Generated image from Replicate. You can drag this image to your desktop or right-click to save.
                    </p>
                </div>
            )}
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
        <p>&copy; {new Date().getFullYear()} Detailed Prompt Generator AI. Powered by Gemini & Replicate (mock).</p>
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
