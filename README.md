# NotePilot 🚀

**NotePilot** is a premium, AI-powered sticky notes application built with **Tauri** and **React**. It transforms the traditional sticky note experience into a seamless, intelligent productivity tool that stays out of your way while keeping your ideas front and center.
 
## ✨ Features

- **AI-Powered Note Creation**: Generate notes instantly using AI. Just type a prompt, and let NotePilot handle the rest.
- **Smart Resizing**: Notes automatically adjust their size based on content, ensuring a perfect fit every time.
- **Always on Top**: Keep your notes visible above all other applications.
- **Transparent & Frameless**: A beautiful, modern UI that blends into your desktop.
- **Privacy-Focused**: Built with Tauri, ensuring your data stays local and secure.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Rust (Tauri)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+)
- **Rust** (v1.70+)
- **Cargo** (Rust package manager)

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd NotePilot
    ```

2.  **Install Dependencies**
    ```bash
    # Install frontend dependencies
    cd src-tauri
    npm install
    
    # Install Rust dependencies (handled by Cargo)
    ```

3.  **Run the Application**
    ```bash
    # Start development mode
    npm run tauri dev
    ```

## 📂 Project Structure

```
NotePilot/
├── src-tauri/        # Rust backend and Tauri configuration
│   ├── src/
│   │   ├── main.rs    # Tauri application entry point
│   │   └── lib.rs     # Rust library code
│   └── Cargo.toml     # Rust dependencies
├── src/               # React frontend
│   ├── components/    # Reusable UI components
│   ├── App.tsx        # Main application component
│   └── main.tsx       # React entry point
├── public/            # Static assets
├── index.html         # HTML entry point
└── package.json       # Frontend dependencies and scripts
```

## 🎨 Development

### Running in Development Mode

```bash
npm run tauri dev
```

This command will:
1.  Compile the Rust backend.
2.  Start the React development server.
3.  Launch the application with hot-reload support.

### Building for Production

```bash
npm run tauri build
```

This will create a production-ready executable in the `src-tauri/target/release/` directory.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
