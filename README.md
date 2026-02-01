# Adventure Forge API

The robust backend engine powering the Adventure Forge interactive storytelling platform.

## 🚀 Overview

Built with **NestJS**, this API handles the orchestration of AI models, user authentication, and game state persistence. It is designed to be highly modular and resilient, ensuring a seamless experience for players exploring AI-generated worlds.

## 🛠️ Key Features

- **AI Orchestration:** Managing calls to multiple Generative AI providers (Google GenAI, etc.) with a built-in fallback system.
- **State Management:** Complex game logic and session persistence handled via **Mongoose** and **MongoDB**.
- **Secure Authentication:** Integrated **Google OAuth 2.0** for secure user sessions and account management.
- **Scalable Architecture:** Structured using NestJS best practices for clean separation of concerns and high maintainability.

## ⚙️ Tech Stack

- **Framework:** NestJS (Node.js)
- **Database:** MongoDB / Mongoose
- **AI Integration:** Google Generative AI (@google/genai)
- **Security:** Passport.js + Google OAuth
- **Environment:** Docker-ready configuration
