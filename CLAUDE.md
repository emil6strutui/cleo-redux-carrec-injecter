# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a car recording system for GTA San Andreas, built on top of the gta-reversed project. It consists of three main components:

1. **gta-reversed**: A complete reversal of GTA San Andreas, creating a DLL that injects into the game and replaces original functions with reversed implementations. This is the core engine that allows modifying game behavior.

2. **car-recording-example**: CLEO script examples demonstrating the car recording system in the game's scripting language. These scripts show how to record vehicle movement data, save it to .cr files, and play it back.

3. **redux-car-recording[mem]**: A TypeScript-based scripting interface that appears to use a modern scripting API for GTA SA.

## Build System & Commands

### Prerequisites
- Visual Studio 2022 (latest)
- Python >= 3.x
- Conan >= 2.x (install via `pip install conan`)
- CMake

### Initial Setup
```bash
# First time setup - detects default Conan profile
conan profile detect

# Run setup script (generates VS solution)
python setup.py

# Optional flags:
python setup.py --buildconf Release        # Build in Release mode (default: Debug)
python setup.py --no-unity-build          # Disable unity build
```

### Building
```bash
# Using generated Visual Studio solution
# Open build/GTASA.sln in Visual Studio

# Or build from command line
cmake --build build

# The output is gta_reversed.asi (DLL with .asi extension)
# Located in: bin/Debug/ or bin/Release/
```

### Installation to Game
```bash
# Run with administrator privileges (required for symlinks on Windows)
python contrib/install.py

# This will:
# 1. Prompt you to select your GTA:SA executable (must be "Compact exe" - exactly 5,189,632 bytes)
# 2. Install ASI Loader and Mouse Fix (dinput8.dll)
# 3. Create symlinks from bin/{debug|release}/ to your GTA SA scripts folder
# 4. Set GTA_SA_EXE and GTA_SA_DIR environment variables
```

### Debugging
1. Ensure latest DLL is in GTA SA scripts folder (automatic if using symlinks from install.py)
2. Launch the game
3. Attach debugger using ReAttach plugin for Visual Studio

## Project Architecture

### gta-reversed Structure

The project is organized as a CMake-based C++23 codebase that hooks into the original GTA SA executable:

- **source/game_sa/**: Core game systems (vehicles, peds, audio, physics, collision, rendering, etc.)
  - Entity hierarchy: `CEntity` → `CPhysical` → `CVehicle`/`CPed`/`CObject`
  - Major systems: `CWorld`, `CTheScripts`, `CCarCtrl`, `CCamera`, `CRadar`

- **source/app/**: Application layer (platform abstraction, input, rendering setup)
  - Platform-specific code in `app/platform/win/` for Windows
  - ImGui-based debug UI integration

- **source/toolsmenu/**: Debug modules system
  - Each debug module has RenderWindow(), RenderMenuEntry(), Render3D() methods
  - Access debug menu with F7 in-game
  - See `source/toolsmenu/DebugModules/!README.md` for how to add new debug modules

- **source/extensions/**: Helper utilities and extensions to the game engine

### Hook System

The project uses a hook system to replace original game functions:
- Functions are hooked at specific memory addresses using `StaticRef<Type, Address>`
- `NOTSA` prefix denotes helper functions added by the project (not in original game)
- Bug fixes are wrapped in `notsa::IsFixBugs()` checks or `#ifdef FIX_BUGS`

### Car Recording System

The car-recording-example scripts demonstrate:
- Recording vehicle matrix (position, rotation) every frame
- Recording movement/turn speed, steering angle, pedal positions, horn status
- Compressing float values to int16 for efficiency (rotation ×30000, speed ×10000)
- Frame format: 0x30 (48) bytes per frame
  - 4 bytes: timestamp
  - 6×2 bytes: rotation matrix (right.xyz, up.xyz as int16)
  - 3×4 bytes: position (x,y,z as float)
  - 6×2 bytes: movement/turn speed (as int16)
  - 5 bytes: steering angle, accelerator, brake, handbrake, horn

## Coding Guidelines

### Code Style
- 4-space indentation, LF line endings
- No Hungarian notation
- Member prefixes: `m_` (non-static), `ms_` (static), `s_` (file-scope global), `g_` (global)
- Use `get`/`set` methods over raw member access
- Use `auto` when type is obvious from context
- Use `f` suffix on float literals: `1.0f` not `1.0`
- Use `constexpr` instead of `#define` for constants
- Use `static inline` for static class members instead of `extern`

### Modern C++ Practices
- Use range-based for loops and `std::ranges` (aliased as `rng::`/`rngv::`)
- Use `std::span` for dynamic-count fixed-size arrays
- Use `rngv::enumerate` when needing both index and element
- Use `std::array` over C-style arrays
- Use fixed-width integer types: `uint8`, `int32`, not `DWORD`
- Prefer SA types over RW types except `RwMatrix` (e.g., `CVector` not `RwV3d`)

### Function Organization
- Mark file-local helper functions as `static`
- Use lambdas for repetitive procedures within functions
- `CVector`/`CVector2D` are interchangeable with 3/2 floats in function args

### GXT Text Handling
- GXT is partial ASCII superset: `^`→`¡`, `[`→`<`, `]`→`>`
- Use `AsciiToGxtChar`/`GxtCharToUTF8` for safe conversion
- Use `AsciiFromGxtChar` or `""_gxt` only when all chars are ASCII

## Build Configuration Options

CMake options (set in conanfile.py or CMake):
- `GTASA_WITH_OPENAL`: Use OpenAL instead of DirectSound
- `GTASA_WITH_SDL3`: Use SDL3 instead of DirectInput (default: ON)
- `GTASA_WITH_SCRIPT_COMMAND_HOOKS`: Enable script command hooks in UI
- `GTASA_UNITY_BUILD`: Enable unity/jumbo build
- `GTASA_WITH_SANITIZERS`: Enable sanitizers for better crash logs
- `GTASA_WITH_LTO`: Enable Link Time Optimization

## Dependencies

Managed via Conan:
- nlohmann_json, spdlog, Tracy (profiling)
- ogg, vorbis (audio)
- imgui (debug UI)
- SDL3 (input/platform)
- libjpeg-turbo

## Important Constraints

- **GTA SA executable must be "Compact" version**: Exactly 5,189,632 bytes (4.94 MiB), NOT the regular 1.0 US version
- Other plugins besides tested ones are unsupported
- Always test changes in-game before creating PRs - use debug menu (F7) for quick testing
- Never skip git hooks or force push to main/master