# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains two independent modules. A car recording system for GTA San Andreas under the example folder and the gta-reversed project. It consists of three main components:

1. **gta-reversed**: A complete reversal of GTA San Andreas, creating a DLL that injects into the game and replaces original functions with reversed implementations. This is the core engine that allows modifying game behavior.

2. **example**: CLEO script examples demonstrating the car recording system in the game's scripting language. These scripts show how to record vehicle movement data.

3. **redux-car-recording[mem]**: A TypeScript-based scripting interface for GTA SA. In this we will implement the same system as in car-recording-example but with modern CLEO Redux syntax

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