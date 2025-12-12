# Adventure Forge - Internal Architecture

## Overview
Adventure Forge is a text-based adventure game powered by multiple AI providers for text, images, and audio. It uses a **Client-Server** architecture where the Frontend handles the UI and game state, while the Backend centralizes AI calls and provider fallback logic.

```mermaid
graph TD
    User[Player] -->|Visit URL| FE[Frontend (GitHub Pages)]
    FE -->|API Calls (Text/Audio/Image)| BE[Backend (Render)]
    
    subgraph "Backend Logic (Smart Fallback)"
        BE -->|Priority 1| Gem[Gemini API]
        BE -->|Priority 2| Pol[Pollinations.ai]
        BE -->|Audio Fallback| Kok[Kokoro TTS (HuggingFace)]
    end
    
    Gem -->|Text/Image| BE
    Pol -->|Text/Audio/Image| BE
    Kok -->|Audio| BE
```

## Components

### 1. Frontend (`adventure-forge`)
- **Tech**: React, TypeScript, Vite/CRA.
- **Hosting**: GitHub Pages.
- **URL**: [https://guillermo94pr.github.io/adventure-forge](https://guillermo94pr.github.io/adventure-forge)
- **Repo**: [guillermopr94/adventure-forge](https://github.com/guillermopr94/adventure-forge)
- **Role**:
    - Manages Game State (History, Inventory).
    - Plays Audio (using `useSmartAudio` hook).
    - Renders Logic.
    - Configuration: `src/config.ts` points to Backend URL in production.

### 2. Backend (`adventure-forge-api`)
- **Tech**: Node.js, NestJS.
- **Hosting**: Render.com (Free Tier).
- **URL**: [https://adventure-forge-api.onrender.com](https://adventure-forge-api.onrender.com)
- **Render Dashboard**: [View Deploys](https://dashboard.render.com/web/srv-d4u0i12dbo4c73akbnk0/deploys/dep-d4u0i1qdbo4c73akbo5g)
- **Repo**: [guillermopr94/adventure-forge-api](https://github.com/guillermopr94/adventure-forge-api)
- **Role**:
    - **Single Point of Entry** for all AI generation.
    - **Masks API Keys**: Clients don't need direct access to provider keys (except specific user overrides).
    - **Fallback Logic**: If Gemini fails (Quota/Error), automatically switches to Pollinations.

### 3. External AI Services

| Service | Purpose | Hosting/Status | Priority |
| :--- | :--- | :--- | :--- |
| **Gemini (Google)** | Text, Image | [Google AI Studio](https://aistudio.google.com/) | Primary (High Quality) |
| **Pollinations.ai** | Text, Audio, Image | Public API | Secondary (Free/Unrestricted) |
| **Kokoro TTS** | Audio | [HuggingFace Space](https://huggingface.co/spaces/willyfox94/kokoro-tts-api) | Backup / Specialized Voice |

## Deployment Workflow

### Frontend
1. Run `deploy_frontend.bat`.
2. This runs `npm run deploy` (gh-pages).
3. Live on GitHub Pages.

### Backend
1. Run `deploy_backend.bat`.
2. This pushes code to GitHub `main` branch.
3. **Render** detects the push and auto-deploys.
