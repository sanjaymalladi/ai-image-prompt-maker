
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not set. Please ensure it is configured.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });
const model = 'gemini-2.5-flash-preview-04-17';

interface ImageInput {
  base64: string;
  mimeType: string;
}

interface GeneratePromptParams {
  image?: ImageInput; // For single image mode
  images?: ImageInput[]; // For image fusion mode
  textConcept?: string;
  refinementSuggestions?: string;
}

export const generateDetailedPrompt = async ({ image, images, textConcept, refinementSuggestions }: GeneratePromptParams): Promise<string> => {
  if (!image && (!images || images.length === 0) && !textConcept) {
    throw new Error("Either a single image, multiple images for fusion, or a text concept must be provided.");
  }

  let systemInstruction: string;
  const parts: any[] = [];

  if (refinementSuggestions) {
    // --- Refinement Logic ---
    if (images && images.length > 0) { // Refining a fused prompt
        systemInstruction = `You are an expert prompt engineer. You previously analyzed multiple images and generated a "fused" prompt.
Now, you must refine that initial analysis based on the following user suggestions: "${refinementSuggestions}".
The original images are provided again.

Your critical task is to generate a NEW, updated prompt that:
1.  Incorporates the user's suggestions.
2.  Continues to synthesize elements from **EACH AND EVERY** original image into a single, cohesive scene. Do not default to describing only one image or favoring one image over others. The final prompt must be a true amalgamation.
3.  If a suggestion conflicts with the images, prioritize the suggestion where it makes creative sense, or subtly blend it while still respecting the core elements from all images.

Focus on vivid details, describing a single cohesive scene that logically integrates elements from all images (considering subject appearance, actions, emotions, attire, setting, composition, lighting, color palette, artistic style, and mood) AND incorporates the new refinement suggestions.
Output only the single, refined, comprehensive text prompt. Do not add any conversational text or explanations.
The output MUST be a single prompt.`;
        
        images.forEach(img => parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
        parts.push({ text: "Based on all provided images and the system instructions (which include refinement suggestions), generate the single refined detailed prompt." });

    } else if (image) { // Refining a single image prompt
      systemInstruction = `You are an expert prompt engineer. You previously analyzed an image and generated a prompt for it.
Now, you need to refine that initial analysis based on the following user suggestions: "${refinementSuggestions}".
The original image is provided again.
Your task is to generate a NEW, updated prompt that incorporates these suggestions while building upon the image's content.
If a suggestion conflicts with the image, prioritize the suggestion where it makes creative sense, or subtly blend it.
Focus on vivid details, including subject appearance, actions, emotions, attire, setting, composition, lighting, color palette, artistic style, and mood.
Output only the single, refined, comprehensive text prompt. Do not add any conversational text or explanations.`;
      
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
      parts.push({ text: "Based on the image provided and the system instructions (which include refinement suggestions), generate the refined detailed prompt." });

    } else if (textConcept) { // Refining a text concept prompt
      systemInstruction = `You are an expert prompt engineer. You previously expanded a text concept: "${textConcept}" into a detailed prompt.
Now, you need to refine that initial prompt based on the following user suggestions: "${refinementSuggestions}".
Your task is to generate a NEW, updated prompt that incorporates these suggestions while building upon the original concept.
Focus on vivid details, including subject appearance, actions, emotions, attire, setting, composition, lighting, color palette, artistic style, and mood.
Output only the single, refined, comprehensive text prompt. Do not add any conversational text or explanations.`;
      parts.push({ text: `Refine the prompt for the concept: "${textConcept}", using the refinement suggestions outlined in the system instruction.` });
    } else {
         throw new Error("Invalid parameters for refinement: Missing original image(s) or text concept.");
    }
  } else { 
    // --- Initial Prompt Generation Logic ---
    if (images && images.length > 0) { // Image Fusion mode
        systemInstruction = `You are an expert prompt engineer. Multiple images are provided.
Your critical task is to synthesize elements from **EACH AND EVERY** provided image into a **SINGLE, NEW, AND COHERENT** scene description. Do not simply describe one image and ignore the others, or heavily favor one image. The final prompt must be a true amalgamation and reflect contributions from all inputs.

For instance:
- If images show different clothing items (e.g., a specific shirt, unique pants, a hat) and a person, the prompt MUST describe that person wearing or interacting with ALL those specific items in a unified outfit or scene.
- If images show the same subject (e.g., a girl) in different settings, performing different actions, or with different expressions/styles, the prompt should create a NEW scenario for that subject that intelligently incorporates or is inspired by elements from EACH of those distinct situations. For example, she might be in a setting that combines features from the input images, or performing an action that blends aspects of her activities, or exhibiting a combined style.
- If images show entirely different subjects or objects, create a plausible scene where they interact or coexist, ensuring that key characteristics from each image are represented and integrated.

Identify a central theme or narrative that creatively binds elements from all images.
Describe this synthesized scene with vivid details:
1.  **Overall Scene:** The new, unified scene created by combining elements from all images.
2.  **Subject(s):** The main subject(s), clearly drawing and combining features, attire, actions, and expressions from across **ALL** images. If it's the same subject in different contexts, describe them in a new, synthesized context.
3.  **Setting/Background:** A shared environment that logically integrates background elements, themes, or atmospheres from **ALL** images.
4.  **Composition & Framing:** How are the combined elements arranged? Describe camera angle, perspective, ensuring it fits the synthesized scene.
5.  **Lighting:** Consistent lighting across the fused scene, potentially drawing inspiration from lighting styles in multiple images to create a cohesive whole.
6.  **Color Palette:** A harmonious color scheme for the combined scene, potentially blending or complementing colors from the various inputs.
7.  **Artistic Style:** A single artistic style that applies to the entire synthesized scene.
8.  **Mood/Atmosphere:** The overall feeling of the newly created scene, reflecting influences from all images.
9.  **Key Details & Textures:** Prominently feature and integrate important, distinct details or textures visible in **ANY** of the provided images, ensuring they fit within the new scene.

Include technical keywords if appropriate (e.g., "4k", "hyperrealistic", "cinematic lighting").
Format your output as one rich, coherent paragraph. Start the prompt directly. Do not use conversational introductions or explanations.
The output MUST be a single prompt representing the fusion of all images.`;

        images.forEach(img => parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
        parts.push({ text: "Based on ALL the images provided, generate a single fused detailed prompt as per the system instructions. Ensure elements from every image contribute to the final prompt." });

    } else if (image) { // Single Image mode
      systemInstruction = `You are an expert prompt engineer specializing in creating highly descriptive prompts for advanced AI image generation models (like DALL-E, Midjourney, Stable Diffusion).
Analyze the provided image in meticulous detail. Your goal is to generate a single, comprehensive text prompt that an AI image generator could use to recreate or reimagine a similar image with high fidelity.
The prompt must cover:
1.  **Subject(s):** Primary focus, appearance, actions, attire, expressions. Consider including specific actions or emotions to enhance realism and storytelling (e.g., "looking directly at camera with a soft expression," "wind blowing hair").
2.  **Setting/Background:** Environment, location, time of day, weather, specific landmarks.
3.  **Composition & Framing:** Camera angle (e.g., low-angle, bird's-eye view, eye-level macro crop), perspective, depth of field, shot type (e.g., close-up, wide shot, single eye macro focus), and specific compositional choices (e.g., 10 degree Dutch tilt).
4.  **Lighting:** Source (e.g., natural, studio, warm golden flare backlight), quality (e.g., soft, harsh, dappled, soft volumetric haze lighting, high key soft box illumination), color, mood it creates (e.g., cinematic, dramatic, ethereal).
5.  **Color Palette:** Dominant colors, accent colors, overall color harmony or contrast, temperature (warm/cool).
6.  **Artistic Style:** Photorealistic, impressionistic, surreal, abstract, specific art movements (e.g., Art Nouveau, Cyberpunk), or artist styles (e.g., "in the style of Van Gogh").
7.  **Mood/Atmosphere:** The overall feeling (e.g., serene, chaotic, mysterious, nostalgic, futuristic, whimsical).
8.  **Key Details & Textures:** Specific objects, patterns, textures (e.g., "rough stone texture", "silky fabric", "metallic sheen", "dewy skin sheen texture", "matte porcelain skin texture", "pebbled leather micro texture").
9.  **Technical Keywords:** Include terms like "4k resolution", "highly detailed", "ultra-detailed skin texture", "volumetric lighting", "cinematic composition", "unreal engine render", "hyperrealistic", "micro-pore detail" if appropriate.
Format your output as one rich, coherent paragraph. Start the prompt directly. Do not use conversational introductions or explanations about your process. Focus solely on crafting the descriptive prompt itself.`;
      
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
      parts.push({ text: "Based on the image provided, generate the detailed prompt as per the system instructions." });

    } else if (textConcept) { // Text Concept mode
      systemInstruction = `You are an expert prompt engineer specializing in creating highly descriptive prompts for advanced AI image generation models (like DALL-E, Midjourney, Stable Diffusion).
Take the following text concept and expand it into a rich, detailed, and highly effective text prompt. The concept is: "${textConcept}".
Your generated prompt should vividly imagine and detail:
1.  **Subject(s):** Clearly define main subjects. Describe potential appearance, actions, attire, expressions. Consider suggesting actions, emotions, or expressions to make the subject(s) more vivid and realistic (e.g., "intense eyes," "subtle smile," "contemplative pose").
2.  **Setting/Background:** Envision a suitable environment. Describe location, time of day, weather, specific landmarks that fit the concept.
3.  **Composition & Framing:** Suggest element arrangement. Think about camera/lens choices (e.g., <camera / focal length>), angle (e.g., low-angle hero close up, eye-level macro crop), perspective, depth of field, shot type (e.g., close-up, wide shot).
4.  **Lighting:** Propose lighting that enhances the mood. Describe source (e.g., natural, studio, warm golden flare backlight), quality (e.g., soft, harsh, dappled, soft volumetric haze lighting), color, and its effect (e.g., cinematic, dramatic, ethereal).
5.  **Color Palette:** Suggest dominant colors, accent colors, overall color harmony or contrast, temperature (warm/cool).
6.  **Artistic Style:** Recommend an artistic style (e.g., photorealistic, impressionistic, surreal, abstract, fantasy art, sci-fi concept art, watercolor, oil painting). Mention specific artist styles if they enhance the concept.
7.  **Mood/Atmosphere:** Define the desired overall feeling (e.g., epic, whimsical, gritty, futuristic, serene, mysterious).
8.  **Key Details & Textures:** Brainstorm specific objects, patterns, textures (e.g., "ancient ruins", "glowing runes", "sleek metallic surfaces", "dewy skin sheen texture", "matte porcelain skin").
9.  **Technical Keywords:** Include terms like "8k resolution", "hyperrealistic", "dynamic pose", "ethereal glow", "volumetric lighting", "ultra-detailed skin texture" where appropriate.
Format your output as one rich, coherent paragraph. Start the prompt directly. Do not use conversational introductions or explanations. Focus solely on crafting the descriptive prompt itself.`;
      parts.push({ text: `Generate a detailed prompt for the concept: "${textConcept}", following the system instructions.` });
    } else {
      // This case should ideally not be reached due to the initial check, but as a safeguard:
      throw new Error("Invalid parameters: No image(s) or text concept provided for initial generation.");
    }
  }
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
      }
    });
    
    const resultText = response.text;
    if (!resultText) {
        throw new Error("The API returned an empty prompt. Please try a different input or refine your concept/suggestions.");
    }
    return resultText.trim();

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid")) {
        throw new Error("The API key is invalid or not configured correctly. Please check your environment setup.");
      }
      if (error.message.includes("Quota") || error.message.includes("quota")) {
         throw new Error("API quota exceeded. Please check your Google AI Studio account or try again later.");
      }
      // Check for content policy errors specifically for image inputs
      if ((image || (images && images.length > 0)) && (error.message.includes("blockedBy Vez") || error.message.includes("SAFETY") || error.message.includes("prompt was blocked"))) {
        throw new Error("The prompt generation was blocked due to the content policy, likely related to the input image(s). Please try with different images.");
      }
      throw new Error(`Failed to generate prompt from Gemini API: ${error.message}`);
    }
    throw new Error("An unknown error occurred while communicating with the Gemini API.");
  }
};
