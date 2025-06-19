# AI Image Prompt Generator

A powerful React-based application that leverages Google's Gemini AI to generate detailed, high-quality prompts for AI image generation models. Transform images or text concepts into comprehensive prompts optimized for AI art creation.

![AI Image Prompt Generator](https://img.shields.io/badge/AI-Powered-blue) ![React](https://img.shields.io/badge/React-19.1.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue) ![Vite](https://img.shields.io/badge/Vite-6.2.0-green)

## 🌟 Features

### 🖼️ **Multi-Modal Input Support**
- **Image Upload**: Drag & drop, paste, or upload images (up to 4MB each)
- **Text Concepts**: Enter descriptive text that will be expanded into detailed prompts
- **Image Fusion**: Combine multiple images (2-5) into a single cohesive prompt
- **Batch Processing**: Process up to 10 images simultaneously

### 🎭 **Specialized Prompt Modes**

#### **Character Sheet Generation**
- Upload a character image to generate 6 detailed prompts:
  - Full body front, back, and side views
  - Cinematic front and back shots with scene integration
  - Creative "realistic crazy shot" with unique lighting and backgrounds
- Customizable background ideas for creative shots
- Refinement capabilities based on user suggestions

#### **Fashion Prompt Studio**
- Upload garment images (1-2 items) for comprehensive fashion analysis
- Generate detailed garment analysis and QA checklists
- Create studio-ready prompts for fashion photography
- Support for lifestyle and studio shot variations

### 🔧 **Advanced Features**
- **Prompt Refinement**: Iteratively improve generated prompts with custom suggestions
- **One-Click Copy**: Instantly copy prompts to clipboard
- **Real-time Preview**: See image previews before processing
- **Error Handling**: Comprehensive error messages and validation
- **Responsive Design**: Works seamlessly across devices

## 🚀 Live Demo

Visit the live application: [ai-image-prompt-maker.vercel.app](https://ai-image-prompt-maker.vercel.app)

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- Google AI Studio API key

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/sanjaymalladi/ai-image-prompt-maker.git
   cd ai-image-prompt-maker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   API_KEY=your_gemini_api_key_here
   ```
   
   Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173` to start using the application

## 📋 Usage Guide

### Image Mode
1. Select "Image" mode from the top navigation
2. Upload images by dragging & dropping, clicking the upload area, or pasting from clipboard
3. Click "Generate Detailed Prompt" to create optimized prompts
4. Copy the generated prompts and use them in your favorite AI image generator

### Text Mode
1. Select "Text" mode
2. Enter your concept or idea in the text area
3. Click "Generate Detailed Prompt" to expand your concept
4. Optionally refine the prompt with additional suggestions

### Image Fusion Mode
1. Select "Image Fusion" mode
2. Upload 2-5 images that you want to combine
3. The AI will create a single cohesive prompt that incorporates elements from all images
4. Perfect for creating unique compositions and mashups

### Character Sheet Mode
1. Select "Character Sheet" mode
2. Upload a single character image
3. Optionally add background ideas for the creative shot
4. Generate 6 different prompts showing your character from various angles and in different scenes

### Fashion Prompt Mode
1. Select "Fashion Prompt" mode
2. Upload 1-2 garment images
3. Generate comprehensive fashion analysis
4. Upload a generated fashion image for QA and refined studio prompts

## 🏗️ Project Structure

```
ai-image-prompt-maker/
├── components/          # Reusable UI components
│   ├── Alert.tsx       # Error/success notifications
│   ├── Button.tsx      # Styled button component
│   ├── Icons.tsx       # SVG icon components
│   ├── Modal.tsx       # Modal dialog component
│   ├── PromptingGuide.tsx  # User guidance component
│   └── Spinner.tsx     # Loading spinner
├── services/
│   └── geminiService.ts # Google Gemini AI integration
├── utils/
│   └── fileUtils.ts    # File handling utilities
├── App.tsx             # Main application component
├── index.tsx           # Application entry point
└── index.html          # HTML template
```

## 🔑 Key Technologies

- **React 19.1.0** - Modern React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Google Gemini AI** - Advanced AI model for prompt generation
- **Modern CSS** - Responsive and accessible design

## 🎯 Use Cases

- **Digital Artists**: Generate detailed prompts for AI art tools like Midjourney, DALL-E, Stable Diffusion
- **Character Designers**: Create consistent character references from multiple angles
- **Fashion Designers**: Analyze garments and create professional fashion prompts
- **Content Creators**: Transform rough ideas into polished, detailed prompts
- **Game Developers**: Generate consistent character and environment descriptions

## 🔒 Privacy & Security

- Images are processed locally and sent securely to Google's Gemini AI
- No images are permanently stored on our servers
- API keys are securely managed through environment variables
- All file processing includes validation and sanitization

## 🤝 Contributing

We welcome contributions! Please feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/sanjaymalladi/ai-image-prompt-maker/issues)
- **API Issues**: Check your Gemini API key and quota limits
- **File Upload Issues**: Ensure images are under 4MB and in supported formats (JPEG, PNG, WebP, etc.)

## 🔄 Version History

- **v1.0.0** - Initial release with core prompt generation features
- **v1.1.0** - Added character sheet generation mode
- **v1.2.0** - Introduced fashion prompt studio functionality
- **v1.3.0** - Enhanced image fusion capabilities and UI improvements

## 🙏 Acknowledgments

- Google Gemini AI team for the powerful language model
- React team for the amazing framework
- Vite team for the excellent build tool
- The open-source community for inspiration and support

---

**Made with ❤️ by the AI Image Prompt Generator team**

*Transform your creative vision into perfect AI prompts*
