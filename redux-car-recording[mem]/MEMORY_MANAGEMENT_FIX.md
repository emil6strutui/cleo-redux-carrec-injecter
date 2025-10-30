# Memory Management Fix for Car Recording Injector

## The Problem: Heap Mismatch Crash 💥

The game was **crashing** when:
1. Playback finished naturally
2. Using `Streaming.RemoveCarRecording(900)` opcode
3. Reference count hit zero and game tried to free memory

### Root Cause

**CRITICAL MISTAKE**: Allocating memory with one heap, freeing with another!

```typescript
// ❌ WRONG - Causes crash!
this.allocatedMemory = Memory.Allocate(totalSize);  // CLEO Redux heap
// ... inject into StreamingArray ...
// Later: Game calls CMemoryMgr::Free() on CLEO memory → CRASH!
```

### Why It Crashed

GTA SA has its own memory manager (`CMemoryMgr`) that manages game memory:

```cpp
// When playback ends or REMOVE_CAR_RECORDING is called:
void CPath::RemoveRef() {
    m_nRefCount--;
    if (m_nRefCount <= 0) {
        CMemoryMgr::Free(m_pData);  // ❌ Tries to free CLEO memory with game heap!
        m_pData = nullptr;
    }
}
```

**The Issue:**
- `Memory.Allocate()` uses **CLEO Redux's heap** (separate allocator)
- `CMemoryMgr::Free()` uses **GTA SA's heap** (game's allocator)
- Freeing memory from one heap using another heap's allocator = **INSTANT CRASH**

## The Solution: Use Game's Memory Manager ✅

### Memory Architecture

GTA SA has a sophisticated memory manager:

```
CMemoryMgr (0x72F420 - Malloc, 0x72F430 - Free)
    ↓
Multiple Heaps (Primary, Secondary, Scratch)
    ↓
Tracking & Debugging (per-category memory usage)
    ↓
Reference Counting (automatic cleanup)
```

### Memory Categories (Hints)

From `MemoryMgr.h eMemoryId`:
```cpp
enum eMemoryId {
    MEM_STREAMING = 7,     // For streamed resources
    MEM_PATHS = 29,        // For car recording paths ← We use this!
    // ... 33 categories total
};
```

### The Fix

**Allocate with game's allocator:**

```typescript
// ✅ CORRECT - No crash!
const mallocFn = Memory.Fn.Cdecl(0x72F420);  // CMemoryMgr::Malloc
this.allocatedMemory = mallocFn(totalSize, 29);  // MEM_PATHS hint

// Now game can safely free it later!
```

**Free with game's allocator:**

```typescript
// ✅ CORRECT - Must match allocation!
const freeFn = Memory.Fn.Cdecl(0x72F430);  // CMemoryMgr::Free
freeFn(this.allocatedMemory);
```

## Function Addresses

From `gta-reversed/source/game_sa/MemoryMgr.cpp`:

| Function | Address | Signature | Convention |
|----------|---------|-----------|------------|
| `CMemoryMgr::Malloc` | `0x72F420` | `void* (uint32 size, uint32 hint)` | cdecl |
| `CMemoryMgr::Free` | `0x72F430` | `void (void* memory)` | cdecl |

## How Reference Counting Works

When you inject a recording, the game manages its lifetime:

```cpp
// Initial state (after injection)
CPath path;
path.m_nRefCount = 0;  // We set this

// When car.startPlayback(900) is called
CVehicleRecording::StartPlaybackRecordedCar() {
    CPath* path = FindRecording(900);
    path->AddRef();  // m_nRefCount++ (now 1)
    // ... setup playback ...
}

// When playback stops
CVehicleRecording::StopPlaybackRecordedCar() {
    path->RemoveRef();  // m_nRefCount-- (back to 0)
    if (path->m_nRefCount <= 0) {
        CMemoryMgr::Free(path->m_pData);  // ✅ Now safe! Same heap!
    }
}
```

## Updated Implementation

### NativeCarRecordingInjector.ts

```typescript
export class NativeCarRecordingInjector {
    // Game memory manager addresses
    private static readonly ADDR_CMEMORY_MGR_MALLOC = 0x72F420;
    private static readonly ADDR_CMEMORY_MGR_FREE = 0x72F430;

    // Memory hints
    private static readonly MEM_PATHS = 29;

    injectIntoGame(fileNumber?: number): number {
        // Allocate using GAME'S heap
        const mallocFn = Memory.Fn.Cdecl(0x72F420);
        this.allocatedMemory = mallocFn(totalSize, 29);  // MEM_PATHS

        // ... write frames ...
        // ... setup CPath ...

        return fileNumber;
    }

    removeFromGame(): void {
        // Free using GAME'S heap (must match!)
        const freeFn = Memory.Fn.Cdecl(0x72F430);
        freeFn(this.allocatedMemory);

        // ... clear CPath ...
    }
}
```

## Benefits of This Approach

✅ **No crashes** - Memory allocated and freed on same heap
✅ **Game manages lifetime** - Reference counting works correctly
✅ **Native opcodes work** - `REMOVE_CAR_RECORDING` opcode safe
✅ **Proper cleanup** - Automatic when playback ends
✅ **Memory tracking** - Game tracks memory usage under MEM_PATHS
✅ **Debug friendly** - Game's memory debugger can see our allocations

## Testing

### Before Fix:
```
1. car.startPlayback(900) ✅
2. Wait for playback to finish... 💥 CRASH
3. Streaming.RemoveCarRecording(900) 💥 CRASH
```

### After Fix:
```
1. car.startPlayback(900) ✅
2. Wait for playback to finish ✅ No crash!
3. Streaming.RemoveCarRecording(900) ✅ No crash!
4. Multiple inject/remove cycles ✅ No memory leaks!
```

## Key Takeaways

1. **Always match allocators** - Free with the same heap you allocated from
2. **Use game's memory manager** - Call `CMemoryMgr::Malloc/Free` for game-managed data
3. **Respect reference counting** - Game increments/decrements automatically
4. **Use memory hints** - Helps with debugging and memory tracking

## Analogies

Think of it like this:

**Bad (Crashes):**
```
Borrow book from Library A
Return book to Library B ← They don't have it in their system! CRASH!
```

**Good (Works):**
```
Borrow book from Library A
Return book to Library A ← Perfect! System updated correctly.
```

**In our case:**
- Library A = CLEO Redux heap (`Memory.Allocate/Free`)
- Library B = GTA SA heap (`CMemoryMgr::Malloc/Free`)
- Book = Allocated memory for recording frames

You can't mix them!

## Related Issues

This same pattern applies to **any data** you inject into game structures that the game might later try to free:
- Custom textures
- Custom models
- Custom scripts
- Custom audio streams

**Rule of thumb:** If the game might call `Free()` on it, allocate it with `CMemoryMgr::Malloc()`!

## References

- `gta-reversed/source/game_sa/MemoryMgr.h` - Memory manager interface
- `gta-reversed/source/game_sa/MemoryMgr.cpp:210` - Malloc implementation @ 0x72F420
- `gta-reversed/source/game_sa/MemoryMgr.cpp:240` - Free implementation @ 0x72F430
- `gta-reversed/source/game_sa/VehicleRecording.h` - Recording structures
- `gta-reversed/source/game_sa/VehicleRecording.cpp` - Reference counting logic
