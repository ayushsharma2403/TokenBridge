# TokenBridge ⚡

A token-efficient AI proxy & liquid-glass workspace interface built for developers, students, and power users.

## ✨ Features & Enhancements

- **Real-Time Factual Grounding & Temporal Synchronicity**: Dynamically grounds all model providers (Claude, OpenAI, Gemini) with live date/time context and real-time news, crypto, and encyclopedic search retrieval for up-to-date answers.
- **Obsidian Liquid Glass Design System**: Ultra-clear frosted glassmorphism UI featuring live specular boundary refraction shine (`glassBorderRefract`), subtle pointer-tracked ambient lighting, and smooth physics-based transitions for all popups, drawers, and panels.
- **Multi-Format Automatic File Generation**: Instant on-demand generation and format conversion for `.pdf`, `.docx`, `.pptx`, `.xlsx`, and `.png`/`.jpg` images with direct download links.
- **HorizonX Orb-Breathing Typing Indicator**: Custom canvas-rendered breathing orb typing indicator providing responsive visual feedback during AI inference.
- **Prompt Engineering Engine**: Rewrites and optimizes raw prompts on the fly to maximize response quality while conserving tokens.
- **Context Compression & Budget Guardrails**: Automatically compresses long chat histories to cut token usage by 40–70% while maintaining context integrity.
- **Persistent Checkpointing**: Automatic session saving to MySQL for seamless cross-device resumes.
- **TokenVault & Analytics**: Real-time tracking of token consumption and estimated costs per AI provider.
- **Multi-Provider AI Support**: Anthropic Claude 3.5 Haiku, OpenAI GPT-4o-mini, and Google Gemini 3.6 Flash.
- **Multi-Factor Authentication**: Email/password, Google OAuth 2.0, and Firebase Phone OTP.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Real-Time Grounding** | Google News RSS, Wikipedia API, CoinGecko API |
| **Document & Image Gen** | ReportLab (PDF), python-docx (DOCX), python-pptx (PPTX), openpyxl (XLSX), Pillow (Image) |
| **Database** | MySQL 8.0+ |
| **Auth** | JWT, Google OAuth, Firebase Auth |
| **AI Providers** | Anthropic Claude, OpenAI GPT, Google Gemini |
| **Frontend** | Vanilla HTML5, Liquid Glass CSS3, Modern ES6 JavaScript, Marked.js, DOMPurify |

## 🚀 Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ayushsharma2403/TokenBridge.git
   cd TokenBridge
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Database Setup**:
   - Create MySQL Database:
     ```sql
     CREATE DATABASE tokenbridge;
     ```
   - Copy `.env.example` to `.env` in `backend/` and configure database credentials and API keys.

4. **Run Server & Application**:
   - **Start Backend API**:
     ```bash
     cd backend
     python main.py
     ```
   - **Start Frontend Server**:
     ```bash
     cd frontend
     python -m http.server 5500
     ```
   - Access application at: `http://localhost:5500/login.html` (or `http://localhost:8000`)

---

## 👤 Author

Developed by **Ayush Sharma**