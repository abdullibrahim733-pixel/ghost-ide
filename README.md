# Ghost IDE

> Embedded AI Development Platform with Ghost Language Support

Ghost IDE is a comprehensive Integrated Development Environment for the Ghost programming language - a domain-specific language designed for edge AI and real-time embedded computing.

## Features

- **Ghost Language Support** - Syntax highlighting, autocomplete, linting for Ghost v0.1
- **Embedded Targets** - STM32F411, ESP32-S3, ESP32, ESP32-C3 with one-click build/flash
- **Edge AI Integration** - Built-in tensor operations, model inference, plasticity (reward/punish/mutate)
- **Serial Monitor** - Real-time device communication with timestamps and logging
- **Integrated Terminal** - Multiple terminal instances with xterm.js
- **Git Integration** - Planned (the source-control panel is UI-only; no Git commands are wired up yet)
- **Debug Support** - Planned (breakpoints/variables/call stack panels are placeholders; no debugger is attached)
- **Cross-platform** - Windows, macOS, Linux

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Project Structure

```
ghost-ide/
├── src/
│   ├── main/           # Main process (Electron)
│   │   └── main.js     # Main entry point
│   ├── preload/        # Preload scripts
│   │   └── preload.js  # Secure IPC bridge
│   └── renderer/       # Renderer process (UI)
│       ├── index.html  # Main HTML
│       ├── styles/     # CSS styles
│       ├── ghost-mode.js      # CodeMirror Ghost language mode
│       ├── editor.js          # Editor management
│       ├── filetree.js        # File explorer
│       ├── terminal.js        # Terminal (xterm.js)
│       ├── serial.js          # Serial monitor
│       ├── ui.js              # UI management
│       └── main.js            # Renderer entry point
├── resources/
│   └── icons/          # Application icons
├── tree-sitter-ghost/  # Tree-sitter grammar (optional)
└── package.json
```

## Ghost Language Features

The IDE provides first-class support for Ghost language features:

### Syntax Highlighting
- Keywords: `let`, `changeable`, `async`, `task`, `loop`, `wait`, `if`, `elif`, `else`
- Plasticity: `reward`, `punish`, `mutate_lifecycle` (special highlighting)
- Types: `tensor<T, [shape]>`, `Pin<Port, Num, Mode>`, primitives
- Built-ins: `print`, `println`, `random`, `tensor`, `gpio_*`, `i2c_*`, etc.

### Code Intelligence
- Autocomplete for keywords, built-ins, types
- Linting: plasticity operations, tensor shapes, missing pull statements
- Go to definition, find references

### Build & Flash
```bash
# Build for target
ghc build src/main.ghost --target stm32f411

# Run on host VM
ghc run src/main.ghost

# Flash to device
ghc flash build/main.bin --target stm32f411 --port /dev/ttyACM0
```

## Targets Supported

| Target | Architecture | AI Acceleration | Status |
|--------|-------------|-----------------|--------|
| STM32F411 | ARM Cortex-M4F | CMSIS-NN | ✅ Primary |
| ESP32-S3 | Xtensa LX7 | ESP-NN | ✅ Primary |
| ESP32 | Xtensa LX6 | Reference | ✅ Supported |
| ESP32-C3 | RISC-V | Reference | ✅ Supported |

## Plasticity (On-Device Learning)

Ghost's unique feature is built-in reinforcement learning:

```ghost
async task main()
    let weights = tensor(4)
    loop
        let sensor = read_sensor()
        let prediction = weights * sensor
        
        if prediction > threshold
            reward weights by 0.1
        else
            punish weights by 0.05
        
        mutate_lifecycle weights by 0.02
        wait 100
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New File | `Ctrl+N` |
| Open File | `Ctrl+O` |
| Save | `Ctrl+S` |
| Save All | `Ctrl+K S` |
| Command Palette | `Ctrl+Shift+P` |
| Toggle Sidebar | `Ctrl+B` |
| Toggle Panel | `Ctrl+J` |
| Terminal | `Ctrl+\`` |
| Build | `Ctrl+Shift+B` |
| Run | `F5` |
| Flash | `Ctrl+F` |
| Check Syntax | `Ctrl+Shift+C` |
| Format | `Shift+Alt+F` |
| Settings | `Ctrl+,` |

## Configuration

Settings are stored in `electron-store` and can be accessed via `Ctrl+,`:

- **Editor**: Font size, tab size, word wrap, minimap, line numbers
- **Ghost**: Compiler path, default target, optimization level, extra args
- **Terminal**: Shell, font size, cursor style, scrollback
- **Serial**: Default baud rate, timestamps, logging
- **Theme**: Dark, Light, High Contrast

## Development

### Prerequisites
- Node.js 18+
- npm 9+
- Rust 1.70+ (for Ghost compiler)
- LLVM 19+ (for native codegen)

### Building the Ghost Compiler
```bash
cd ../ghost
cargo build --release
sudo cp target/release/ghc /usr/local/bin/
```

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## License

MIT License - see LICENSE file for details.

## Links

- [Ghost Language Documentation](https://ghost-lang.dev/docs)
- [Ghost GitHub Repository](https://github.com/ghost-lang/ghost)
- [Report Issues](https://github.com/ghost-lang/ghost-ide/issues)