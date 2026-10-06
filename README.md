# TokenBridge ⚡

A token-efficient AI proxy & liquid-glass workspace interface built for developers, students, and power users.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1.svg?logo=mysql&logoColor=white)](https://www.mysql.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

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
- **Unified Architecture**: Single-command startup serving both the FastAPI REST endpoints and the static liquid-glass frontend seamlessly.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Real-Time Grounding** | Google News RSS, Wikipedia API, CoinGecko API |
| **Document & Image Gen** | ReportLab (PDF), python-docx (DOCX), python-pptx (PPTX), openpyxl (XLSX), Pillow (Image) |
| **Database** | MySQL 8.0+ / TiDB Cloud / Aiven (SSL-enabled) |
| **Auth** | JWT, Google OAuth 2.0, Firebase Auth (Phone OTP) |
| **AI Providers** | Anthropic Claude, OpenAI GPT, Google Gemini |
| **Frontend** | Vanilla HTML5, Liquid Glass CSS3, Modern ES6 JavaScript, Marked.js, DOMPurify |
| **Deployment** | Render.com, Procfile, render.yaml blueprint |

---

## 🚀 Quick Setup & Local Development

### 1. Clone the repository
```bash
git clone https://github.com/ayushsharma2403/TokenBridge.git
cd TokenBridge
```

### 2. Environment Configuration
Create a virtual environment and install dependencies:
```bash
# Create and activate virtual environment
python -m venv venv

# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies from root
pip install -r requirements.txt
```

### 3. Configure `.env`
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
- **Database**: Local MySQL or Cloud MySQL (`DATABASE_URL`)
- **JWT**: Random secret string (`JWT_SECRET`)
- **OAuth & Email**: Google OAuth keys, Gmail App Password
- **AI API Keys**: Anthropic, OpenAI, or Google Gemini keys

---

## 💻 Running the Application

A **single command** runs both the backend API and frontend interface on port 8000:

```bash
python -m uvicorn backend.main:app --reload --port 8000
```
*(Alternative: `cd backend && python main.py`)*

### Access Points
- 🔐 **Login / Signup**: [http://localhost:8000/login.html](http://localhost:8000/login.html)
- 💬 **Main Workspace**: [http://localhost:8000](http://localhost:8000)
- 📖 **Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ☁️ Production Deployment (100% Free on Render)

TokenBridge is pre-configured with a `render.yaml` blueprint and `Procfile`.

1. **Database**: Create a free serverless MySQL cluster on [TiDB Cloud](https://tidbcloud.com/) or [Aiven](https://aiven.io/).
2. **Web Service**: In [Render.com](https://render.com/), create a new **Web Service** connected to your repository `ayushsharma2403/TokenBridge`.
3. **Environment Settings**:
   - **Runtime**: `Python 3` (Python 3.11.9 pinned)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free` ($0/month)
4. **Environment Variables**:
   Set `DATABASE_URL`, `JWT_SECRET`, `PYTHON_VERSION=3.11.9`, `APP_URL`, `ALLOWED_ORIGINS`, Google OAuth and Gmail credentials.

---

## 👤 Author

Developed with care by **Ayush Sharma**