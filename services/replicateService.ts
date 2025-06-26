interface ReplicateInputs {
  prompt: string;
  aspect_ratio: string; // e.g., "1:1", "16:9"
  input_image_1?: string; // Data URL or public URL
  input_image_2?: string; // Data URL or public URL
  // Add other Replicate model-specific inputs if needed
}

interface ReplicatePrediction {
  id: string;
  model: string;
  version: string;
  input: Record<string, any>;
  logs: string | null;
  error: any | null;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  urls: {
    get: string;
    cancel: string;
  };
  output?: any; // Output structure varies by model
}

const MODEL_VERSION = '6cccace56f579a06294257df73f5283051484ebcc76309a35dcd91f962b21a96';
const POLLING_INTERVAL_MS = 3000; // 3 seconds
const MAX_POLLING_ATTEMPTS = 100; // Max attempts (100 * 3s = 5 minutes)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateImageViaReplicate = async (inputs: ReplicateInputs): Promise<string> => {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error("REPLICATE_API_TOKEN is not set in environment variables.");
    throw new Error("Replicate API token is not configured.");
  }

  // The flux-kontext-apps/multi-image-kontext-max model requires both input images
  if (!inputs.input_image_1 || !inputs.input_image_2) {
    throw new Error("This model requires both input images (input_image_1 and input_image_2) to be provided. Please select two garment images before generating.");
  }

  const input = {
    prompt: inputs.prompt,
    aspect_ratio: inputs.aspect_ratio,
    input_image_1: inputs.input_image_1,
    input_image_2: inputs.input_image_2,
  };

  console.log('Using model: flux-kontext-apps/multi-image-kontext-max:%s', MODEL_VERSION);
  console.log('With input: %O', input);

  try {
    console.log('Creating prediction...');
    
    // Create prediction using Vite proxy
    const createResponse = await fetch('/api/replicate/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: input,
      }),
    });

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      console.error("Replicate API error (create prediction):", createResponse.status, errorBody);
      throw new Error(`Failed to create prediction: ${createResponse.status} ${errorBody}`);
    }

    const prediction: ReplicatePrediction = await createResponse.json();
    console.log('Prediction created:', prediction.id);

    // Poll for completion
    let attempts = 0;
    while (attempts < MAX_POLLING_ATTEMPTS) {
      attempts++;
      await delay(POLLING_INTERVAL_MS);

      const pollUrl = prediction.urls.get.replace('https://api.replicate.com/v1', '/api/replicate');
      const pollResponse = await fetch(pollUrl);

      if (!pollResponse.ok) {
        const errorBody = await pollResponse.text();
        console.error("Replicate API polling error:", pollResponse.status, errorBody);
        if (pollResponse.status === 429) {
          console.warn("Rate limited. Waiting longer before retrying.");
          await delay(POLLING_INTERVAL_MS * 2);
          continue;
        }
        throw new Error(`Polling error: ${pollResponse.status} ${errorBody}`);
      }

      const polledPrediction: ReplicatePrediction = await pollResponse.json();
      console.log(`Polling attempt ${attempts}: Status - ${polledPrediction.status}`);

      if (polledPrediction.status === "succeeded") {
        if (polledPrediction.output && Array.isArray(polledPrediction.output) && polledPrediction.output.length > 0) {
          console.log("Prediction succeeded. Output:", polledPrediction.output[0]);
          return polledPrediction.output[0];
        } else if (polledPrediction.output && typeof polledPrediction.output === 'string') {
          console.log("Prediction succeeded. Output:", polledPrediction.output);
          return polledPrediction.output;
        } else {
          console.error("Prediction succeeded, but output format is unexpected:", polledPrediction.output);
          throw new Error("Prediction succeeded, but output format is unexpected.");
        }
      } else if (polledPrediction.status === "failed") {
        console.error("Prediction failed. Error:", polledPrediction.error);
        throw new Error(`Prediction failed: ${polledPrediction.error || "Unknown error"}`);
      } else if (polledPrediction.status === "canceled") {
        console.warn("Prediction was canceled.");
        throw new Error("Prediction was canceled.");
      }
    }

    throw new Error("Prediction timed out after maximum polling attempts.");
  } catch (error) {
    console.error("Error running Replicate model:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating image.");
  }
};
