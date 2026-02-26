---
title: Visual Workflow Builder
created: 2026-01-20
owner: Tommy
log:
  - 2026-01-20: Initial requirements documented
  - 2026-01-20: Added multi-engine detection system (OCR, pixel, image), Wind Mouse algorithm, click jitter
  - 2026-01-20: Added natural language workflow creation (text + voice) via OpenRouter
  - 2026-01-20: Resolved all open questions - added design decisions, macro recording, routines, profile quality tiers
  - 2026-01-20: Added safety features, debug mode, scheduling, session behavior, sound detection, notifications, workflow chaining, analytics, game profiles
  - 2026-01-20: Added full cross-platform support (Windows, macOS, Linux X11/Wayland) with platform-specific documentation
  - 2026-02-23: Expanded game-aware AI workflow generation with hybrid game selection, internal game context packs, and evaluation requirements
  - 2026-02-23: Implemented initial game-aware AI generation in app (OpenRouter, model selection, Codex fallback, editor composer UI)
---

# Visual Workflow Builder

## Problem

Users currently need to write code manually to create automation scripts for video games. This requires programming knowledge, is time-consuming, and makes iteration difficult. Additionally, simple automation tools produce robotic, detectable behavior patterns (straight-line mouse movements, identical timing) that can trigger anti-cheat systems or simply look unnatural.

## Business Context

Workflow Studio aims to be a premium automation tool for gamers. The visual workflow builder is the core differentiating feature that transforms the app from a simple script runner into a powerful no-code automation platform. The human-like movement system provides a competitive advantage over existing tools.

## Goals & KPIs

### Goals
1. Enable non-programmers to create complex game automation workflows
2. Produce human-like, undetectable automation behavior
3. Provide a professional, intuitive workflow building experience
4. Store all data locally for privacy and offline use
5. Generate game-relevant workflow drafts from natural language with minimal manual correction

### KPIs
- Time to create first working workflow < 5 minutes
- User can create a 10-action workflow without documentation
- Mouse movement patterns pass visual "human test" (no straight lines)
- Zero data sent to external servers
- For supported games, first AI draft accepted with only minor edits in >= 70% of sessions
- AI-assisted generation roundtrip (submit prompt -> editable draft) p95 < 12 seconds

## Personas & Journeys

### Primary Persona: The Grinder
- Plays MMOs, gacha games, or games with repetitive tasks
- Wants to automate farming, daily tasks, or resource collection
- Has basic computer skills but limited programming knowledge
- Values efficiency and time savings

### User Journey
1. User opens Workflow Studio and clicks "New Workflow"
2. User names their workflow and optionally sets a trigger image
3. User adds actions (move mouse, click, type, wait)
4. User configures each action with coordinates, delays, and optional image triggers
5. User captures screenshots for image triggers using built-in capture tool
6. User tests the workflow with a preview/dry-run mode
7. User runs the workflow, which loops until stopped

## Functional Requirements

### F1: Workflow Management

#### F1.1: Create/Edit/Delete Workflows
- User can create new workflows with a name and optional description
- User can edit existing workflows
- User can duplicate workflows
- User can delete workflows with confirmation
- Workflows are saved as JSON files in the scripts directory

#### F1.2: Scripts Directory Configuration
- Default location: `~/Documents/WorkflowStudio/workflows/`
- User can change directory via Settings modal
- App validates directory exists and is writable
- Directory selection uses native OS file picker

#### F1.3: Workflow Structure
```typescript
interface Workflow {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  triggerImage?: string; // Image ID to start workflow
  loopCount: number | 'infinite';
  loopDelay: { min: number; max: number }; // ms between loops
  actions: Action[];
}
```

### F2: Action Types

All actions support an optional `trigger` field that specifies a detection condition that must be met before the action executes. See F3 for detection types.

#### F2.1: Mouse Move
- Target: Absolute coordinates (x, y) OR relative to detected element
- Movement style: Human-like Wind Mouse algorithm
- Duration: Range (min/max ms) for natural variation
- Optional: Trigger condition (wait for detection before moving)

```typescript
interface MouseMoveAction {
  type: 'mouse_move';
  target:
    | { mode: 'absolute'; x: number; y: number }
    | { mode: 'detection'; detectionId: string; offsetX?: number; offsetY?: number };
  duration: { min: number; max: number };
  trigger?: DetectionTrigger;
}
```

#### F2.2: Mouse Click
- Click type: Left, Right, Middle
- Click style: Single, Double, Hold (with duration)
- Click jitter: Random offset within radius (Gaussian distribution)
- Optional: Move to position before clicking
- Optional: Trigger condition

```typescript
interface MouseClickAction {
  type: 'mouse_click';
  button: 'left' | 'right' | 'middle';
  clickType: 'single' | 'double' | { hold: { min: number; max: number } };
  position?:
    | { mode: 'absolute'; x: number; y: number }
    | { mode: 'detection'; detectionId: string; offsetX?: number; offsetY?: number }
    | { mode: 'current' }; // Click at current mouse position
  jitter: {
    enabled: boolean;
    radius: number;           // Max pixels from center (default: 3)
    distribution: 'gaussian' | 'uniform';  // Gaussian = more likely near center
  };
  trigger?: DetectionTrigger;
}
```

#### F2.3: Keyboard Type
- Text input: Type a string of characters with human-like timing
- Key press: Single key or key combination (Ctrl+C, etc.)
- Typing speed: Range (min/max ms between keystrokes)
- Typo simulation: Optional random typos with correction (for realism)
- Optional: Trigger condition

```typescript
interface KeyboardAction {
  type: 'keyboard';
  mode: 'type' | 'press';
  value: string; // Text to type or key combo (e.g., "ctrl+shift+a")
  speed?: { min: number; max: number }; // ms between keys (default: 50-150)
  humanize?: {
    enabled: boolean;
    burstSpeed: boolean;      // Type faster in "bursts" like humans
    occasionalPause: boolean; // Random longer pauses (thinking)
  };
  trigger?: DetectionTrigger;
}
```

#### F2.4: Wait/Delay
- Fixed delay with random variation
- Wait for detection condition to become true (with timeout)
- Wait for detection condition to become false

```typescript
interface WaitAction {
  type: 'wait';
  mode:
    | { type: 'delay'; duration: { min: number; max: number } }
    | { type: 'detect_true'; detection: DetectionConfig; timeout: number }
    | { type: 'detect_false'; detection: DetectionConfig; timeout: number };
}
```

#### F2.5: Conditional
- If detection condition is true → execute sub-actions
- Else → execute alternate actions (optional)
- Supports nested conditionals

```typescript
interface ConditionalAction {
  type: 'conditional';
  condition: DetectionConfig;
  thenActions: Action[];
  elseActions?: Action[];
}
```

#### F2.6: Loop
- Repeat a set of actions N times or until condition
- Configurable delay between iterations

```typescript
interface LoopAction {
  type: 'loop';
  iterations: number | 'infinite';
  untilCondition?: DetectionConfig; // Stop when this becomes true
  delay: { min: number; max: number };
  actions: Action[];
}
```

### F3: Detection System

The detection system provides multiple methods for triggering actions based on screen state. Users can choose the most appropriate method for each situation.

#### F3.1: Detection Methods Overview

| Method | Engine | Speed | Best For | Accuracy |
|--------|--------|-------|----------|----------|
| Pixel/Color | Native | ~1ms | Health bars, button states, simple indicators | High for exact colors |
| Image Template | nut.js | ~30-50ms | UI elements, icons, static images | High |
| Image Template | OpenCV | ~50-100ms | Complex matching, slight variations | Very High |
| Image Template | sharp | ~20-40ms | Fast comparisons, exact matches | High |
| OCR | Tesseract.js | ~150-300ms | Reading text, numbers, quest objectives | Medium-High |

#### F3.2: Detection Configuration

```typescript
// Base trigger that can be attached to any action
interface DetectionTrigger {
  detection: DetectionConfig;
  timeout: number;           // Max ms to wait for detection
  retryInterval: number;     // Ms between detection attempts (default: 100)
  failAction: 'skip' | 'error' | 'continue';  // What to do if timeout
}

// Union of all detection types
type DetectionConfig =
  | PixelDetection
  | ColorRegionDetection
  | ImageDetection
  | OCRDetection;
```

#### F3.3: Pixel/Color Detection
Fastest detection method. Checks specific pixel(s) for exact or similar colors.

**Use Cases:**
- Health/mana bar levels (check if pixel is red/blue)
- Button active states (highlighted vs grayed out)
- Loading screen detection (screen goes black)
- Simple UI state changes

```typescript
interface PixelDetection {
  type: 'pixel';
  mode: 'single' | 'region_average' | 'region_any' | 'region_all';

  // For single pixel
  position?: { x: number; y: number };

  // For region checks
  region?: { x: number; y: number; width: number; height: number };

  // Color matching
  color: {
    r: number; g: number; b: number;
    tolerance: number;  // 0-255, how much each channel can differ
  };

  // Optional: check for color NOT being present
  invert?: boolean;
}

interface ColorRegionDetection {
  type: 'color_region';
  region: { x: number; y: number; width: number; height: number };

  // What percentage of pixels must match
  matchPercentage: { min: number; max?: number };  // e.g., { min: 0.8 } = 80%+

  color: {
    r: number; g: number; b: number;
    tolerance: number;
  };
}
```

#### F3.4: Image Template Detection
Find images on screen using template matching. User selects which engine to use.

**Engine Selection:**
- **Default**: nut.js (handles 80% of use cases)
- **Override**: Per-action engine selection in advanced settings
- **Fallback**: Optional secondary engine if primary fails (e.g., nut.js → OpenCV)

**Engines:**

**nut.js (Default)**
- Built into automation library
- Good balance of speed and accuracy
- Best for most use cases
- Recommended for: static UI elements, icons, buttons

**OpenCV.js**
- More sophisticated matching algorithms
- Better with slight variations, scaling
- Supports multiple match methods (TM_CCOEFF, TM_SQDIFF, etc.)
- Higher CPU usage
- Recommended for: dynamic content, color variations, when nut.js struggles

**sharp**
- Fastest for exact/near-exact matches
- Lower memory footprint
- Best for pixel-perfect UI elements
- Recommended for: performance-critical loops, exact match scenarios

**Fallback Chain Configuration:**
```typescript
interface ImageDetectionWithFallback extends ImageDetection {
  fallback?: {
    engine: 'nutjs' | 'opencv' | 'sharp';
    confidence: number;
    // Only try fallback if primary confidence below threshold
    triggerThreshold: number;
  };
}
```

```typescript
interface ImageDetection {
  type: 'image';
  imageId: string;           // Reference to saved image

  engine: 'nutjs' | 'opencv' | 'sharp';

  // Common options
  confidence: number;        // 0.0-1.0, minimum match confidence
  searchRegion?: {           // Limit search area for performance
    x: number; y: number;
    width: number; height: number;
  };

  // Engine-specific options
  options?: {
    // OpenCV specific
    method?: 'TM_CCOEFF_NORMED' | 'TM_CCORR_NORMED' | 'TM_SQDIFF_NORMED';
    grayscale?: boolean;     // Convert to grayscale before matching
    scale?: number[];        // Try multiple scales [0.9, 1.0, 1.1]

    // nut.js specific
    searchMultipleScales?: boolean;

    // sharp specific
    exactMatch?: boolean;    // Faster but requires pixel-perfect match
  };

  // Output: where was it found?
  returnCenter?: boolean;    // Return center point (default: true)
  returnAllMatches?: boolean; // Find all instances, not just first
}
```

#### F3.5: OCR Detection
Read text from screen regions using Tesseract.js.

**Use Cases:**
- Quest objective text
- Item counts/quantities
- Chat messages
- Cooldown timers
- Any dynamic text

**Language Packs:**
- English (eng) bundled by default
- Additional languages downloaded on-demand from settings
- Cached locally after first download
- Supported: all Tesseract language packs (100+ languages)

```typescript
interface OCRDetection {
  type: 'ocr';
  region: { x: number; y: number; width: number; height: number };

  // What text to look for
  match:
    | { mode: 'exact'; text: string }
    | { mode: 'contains'; text: string }
    | { mode: 'regex'; pattern: string }
    | { mode: 'number_comparison'; operator: '>' | '<' | '==' | '>=' | '<='; value: number };

  // OCR options
  options?: {
    language?: string;       // Default: 'eng', downloads on-demand if not installed
    whitelist?: string;      // Limit to these characters (e.g., '0123456789' for numbers)
    preprocessor?: 'none' | 'threshold' | 'sharpen';  // Image preprocessing
    psm?: number;            // Tesseract page segmentation mode
  };

  // For number comparisons, extract and parse number
  parseAsNumber?: boolean;
}
```

#### F3.6: Screenshot Capture Tool
Universal tool for capturing regions for any detection type.

- User clicks "Capture" button in detection config
- Screen dims with crosshair cursor
- User clicks and drags to select region
- Preview shows selected region with:
  - Pixel color at cursor (for pixel detection)
  - OCR preview text (for OCR detection)
  - Image preview (for image detection)
- User names the capture and saves
- Images stored in `{scriptsDir}/images/` as PNG
- Pixel/color configs stored in workflow JSON

#### F3.7: Detection Library
Centralized library of saved detections for reuse across workflows.

```typescript
interface SavedDetection {
  id: string;
  name: string;
  description?: string;
  type: 'image' | 'pixel' | 'color_region' | 'ocr';
  config: DetectionConfig;

  // For image type
  imageFilename?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  usageCount: number;        // How many workflows use this
}
```

**Library Features:**
- Grid/list view of all saved detections
- Filter by type (image, pixel, OCR)
- Search by name
- Preview detection (test against current screen)
- Duplicate, edit, delete
- Shows which workflows use each detection

### F4: Human-like Mouse Movement

#### F4.1: Wind Mouse Algorithm
The Wind Mouse algorithm simulates natural human mouse movement using physics-inspired "wind" and "gravity" forces. This produces realistic curved paths with natural speed variation.

**Algorithm Overview:**
```
WindMouse(start, end, gravity, wind, targetArea):
  1. Calculate distance to target
  2. While not at target:
     a. Apply "wind" force (random lateral movement, simulates hand tremor)
     b. Apply "gravity" force (pulls toward target)
     c. Limit velocity to maxStep
     d. Add small random micro-movements
     e. Move mouse, wait proportional to distance
  3. Final approach with deceleration
```

**Key Parameters (Configurable per-user profile):**
```typescript
interface WindMouseParams {
  gravity: number;        // Pull toward target (default: 9.0)
  wind: number;           // Random lateral force (default: 3.0)
  minWait: number;        // Min ms between steps (default: 2)
  maxWait: number;        // Max ms between steps (default: 10)
  maxStep: number;        // Max pixels per step (default: 10)
  targetArea: number;     // Radius for "close enough" (default: 8)
}
```

**Movement Phases:**
1. **Acceleration**: Start slow, build up speed
2. **Cruise**: Maintain variable speed with wind effects
3. **Deceleration**: Slow down approaching target
4. **Final Approach**: Precise movement to exact coordinates

#### F4.2: Overshoot & Correction
Humans frequently overshoot targets slightly and correct. This behavior is simulated:

**Overshoot Triggers:**
- Fast movements (longer distances)
- Small targets
- Random chance based on profile

**Correction Behavior:**
```typescript
interface OvershootConfig {
  frequency: number;          // 0.0-1.0, how often overshoots occur (default: 0.15)
  distanceMultiplier: {       // Overshoot distance as % of movement
    min: number;              // default: 0.05 (5%)
    max: number;              // default: 0.15 (15%)
  };
  correctionSpeed: {          // Correction is slower, more careful
    min: number;              // default: 0.3 (30% of normal speed)
    max: number;              // default: 0.6 (60% of normal speed)
  };
  pauseBeforeCorrection: {    // Brief pause after overshoot (human reaction)
    min: number;              // default: 50ms
    max: number;              // default: 150ms
  };
}
```

**Overshoot Pattern:**
1. Move past target by calculated distance
2. Brief pause (simulates recognition of overshoot)
3. Slower, more careful movement back to target

#### F4.3: User Movement Learning (Unique Behavior)
Each user develops a unique movement signature by optionally recording their natural movements.

**Recording Phase:**
1. User enables "Learn My Style" in settings
2. App records mouse movements during normal use (not during automation)
3. Records: positions, timestamps, velocities, accelerations
4. Minimum 30 minutes of data before profile generation

**Pattern Extraction:**
```typescript
interface MovementSample {
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  duration: number;
  points: Array<{ x: number; y: number; timestamp: number }>;
  distance: number;
  averageSpeed: number;
  maxSpeed: number;
  curveDeviation: number;    // How far from straight line
}

interface ExtractedPatterns {
  averageCurveDeviation: number;
  speedProfile: number[];       // Normalized speed curve
  accelerationPattern: number[];
  jitterFrequency: number;
  jitterMagnitude: number;
  overshootRate: number;
  pausePatterns: number[];      // Natural pause durations
}
```

**Profile Generation:**
```typescript
interface MovementProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  sampleCount: number;
  totalRecordedTime: number;    // ms

  // Wind Mouse parameter adjustments (relative to defaults)
  windMultiplier: number;       // 0.5-2.0
  gravityMultiplier: number;    // 0.5-2.0
  speedMultiplier: number;      // 0.5-2.0

  // Behavior characteristics
  curveIntensity: number;       // 0.0-1.0, how curved movements are
  jitterAmount: number;         // 0.0-1.0, micro-movement intensity
  jitterFrequency: number;      // How often jitter occurs

  // Overshoot characteristics
  overshootFrequency: number;   // 0.0-1.0
  overshootDistance: number;    // Multiplier
  correctionStyle: 'quick' | 'careful' | 'mixed';

  // Speed characteristics
  accelerationCurve: number[];  // Normalized acceleration profile
  preferredSpeed: 'slow' | 'medium' | 'fast';

  // Raw samples for advanced interpolation
  samples: MovementSample[];
}
```

**Profile Evolution:**
- Profile updates continuously as user uses app normally
- Weighted average: recent samples weighted higher
- Minimum samples maintained; old ones pruned
- User can reset profile to start fresh

**Profile Quality Tiers:**
| Tier | Recording Time | Sample Count | Uniqueness |
|------|---------------|--------------|------------|
| Basic | 15 min | 50+ | Low - usable but patterns may be generic |
| Good | 1 hour | 200+ | Medium - recommended minimum |
| Excellent | 3+ hours | 500+ | High - truly unique patterns |

**Quality Indicator UI:**
```typescript
interface ProfileQuality {
  tier: 'none' | 'basic' | 'good' | 'excellent';
  percentage: number;           // 0-100, progress to next tier
  totalRecordingTime: number;   // ms
  sampleCount: number;
  diversityScore: number;       // 0-1, variety of movement types
  recommendation: string;       // "Keep recording for better uniqueness"
}
```

- Displayed in Settings and workflow builder sidebar
- Visual: progress bar with tier label
- Tooltip explains benefits of higher tiers
- Gentle reminder if using Basic tier during workflow execution

#### F4.4: Click Jitter System
Never click the exact same pixel twice. Implements human-like imprecision.

**Jitter Configuration:**
```typescript
interface ClickJitterConfig {
  enabled: boolean;             // Default: true
  radius: number;               // Max pixels from target (default: 3)
  distribution: 'gaussian' | 'uniform';  // Gaussian = more clicks near center

  // Gaussian distribution parameters
  sigma?: number;               // Standard deviation (default: radius/3)

  // Advanced: different jitter for different scenarios
  profiles?: {
    smallTarget: { radius: number; sigma: number };   // Buttons, icons
    largeTarget: { radius: number; sigma: number };   // Panels, areas
    preciseClick: { radius: number; sigma: number };  // When precision needed
  };
}
```

**Jitter Application:**
```
ApplyJitter(targetX, targetY, config):
  1. If config.distribution == 'gaussian':
     - offsetX = gaussianRandom(0, config.sigma)
     - offsetY = gaussianRandom(0, config.sigma)
     - Clamp to radius
  2. If config.distribution == 'uniform':
     - angle = random(0, 2π)
     - distance = random(0, config.radius)
     - offsetX = cos(angle) * distance
     - offsetY = sin(angle) * distance
  3. Return (targetX + offsetX, targetY + offsetY)
```

#### F4.5: Timing Humanization
All delays incorporate human-like variation.

```typescript
interface HumanizedTiming {
  // Base delay range
  delay: { min: number; max: number };

  // Advanced humanization
  distribution: 'uniform' | 'gaussian' | 'exponential';

  // Fatigue simulation (optional)
  fatigue?: {
    enabled: boolean;
    increasePerHour: number;    // % increase in delays per hour
    maxIncrease: number;        // Cap on delay increase
  };

  // Occasional longer pauses (simulates distraction)
  occasionalPause?: {
    frequency: number;          // 0.0-1.0
    duration: { min: number; max: number };
  };
}
```

### F5: Workflow Builder UI

#### F5.1: Canvas/Timeline View
- Visual representation of workflow as connected action cards
- Drag-and-drop to reorder actions
- Click action to edit properties in side panel
- Visual connection lines between actions
- Color-coded action types

#### F5.2: Action Palette
- Sidebar with draggable action types
- Quick-add buttons for common actions
- Search/filter actions

#### F5.3: Properties Panel
- Context-sensitive panel showing selected action's properties
- Coordinate picker with "Pick from Screen" button
- Image selector dropdown with preview
- Numeric inputs with sliders for ranges
- Real-time validation

#### F5.4: Toolbar
- Play/Stop workflow
- Test mode (execute once without loop)
- Save workflow
- Undo/Redo
- Zoom controls (for complex workflows)

### F5.5: Natural Language Input (AI-Assisted Workflow Creation)

Users can create and edit workflows using natural language via text or voice input. An LLM (GPT 5.2 Codex via OpenRouter) interprets the input and generates/modifies the workflow JSON.

#### Game-Aware Generation Scope (New)

The AI assistant must use game-specific context when available so requests like "shift click my whole inventory" resolve to game-relevant workflow logic instead of generic click loops.

**Key requirements:**
- AI generation works even when user does not explicitly choose a game
- Optional game selector is available to improve precision and reduce ambiguity
- Active game context is always visible and overrideable before submit
- If context confidence is low, AI must ask a clarification question before applying changes

#### Game Context Resolution Strategy

Game context is resolved in this priority order:
1. Explicitly selected game in AI composer
2. Current game profile selected in sidebar
3. Inference from user prompt text + active window/process metadata
4. Fallback to generic mode (no game-specific assumptions)

```typescript
interface GameContextResolution {
  gameId: string | null;            // null means generic mode
  source: 'selector' | 'profile' | 'inference' | 'generic';
  confidence: number;               // 0.0-1.0
  inferredFrom?: {
    promptMentions?: string[];      // e.g., ["RuneScape 3", "shift click"]
    windowTitle?: string;
    processName?: string;
  };
}
```

**Clarification behavior:**
- If `confidence < 0.75`, return `action: "clarify"` with a short game disambiguation prompt
- If `0.75 <= confidence < 0.9`, proceed but show "Using inferred game context" warning in review step
- If `confidence >= 0.9`, proceed normally

#### Game Selector UX (Optional, Recommended)

- AI composer includes a compact game selector chip/dropdown
- Default value: current game profile, if one is selected
- Includes `Generic (No game context)` option
- Search by game name + aliases
- Keyboard accessible (`Cmd/Ctrl+K` focus, arrows to select, Enter to confirm)
- Selector choice persists per-workflow and can be changed at any time

#### Internal Game Context Packs

Supported games provide structured context packs consumed by prompt assembly.

```typescript
interface GameContextPack {
  id: string;                      // "runescape-3"
  name: string;                    // "RuneScape 3"
  aliases: string[];               // ["RS3", "RuneScape"]
  terminology: Array<{
    phrase: string;                // "shift click inventory"
    meaning: string;               // Domain interpretation for AI
    canonicalIntent: string;       // "inventory.bulk_action"
  }>;
  canonicalIntents: Array<{
    id: string;                    // "inventory.bulk_action"
    promptHints: string[];         // How users usually ask for it
    workflowPatterns: Action[];    // Reusable action templates
  }>;
  constraints: {
    requiresDetectionFor?: string[];   // Intents requiring image/pixel detection
    riskyPatterns?: string[];          // Patterns to discourage
    notes: string[];                   // Game-specific caveats
  };
  version: string;
  updatedAt: string;
}
```

**Pack lifecycle:**
- Packs ship with app releases as versioned JSON assets
- Packs can be patched via signed update bundle
- Users can disable individual packs
- Unknown games remain supported through generic mode

#### Input Methods

**Text Input:**
- Persistent text input bar at bottom of workflow builder
- Multi-line support for complex descriptions
- Command history (up arrow for previous inputs)
- Supports both creation and editing:
  - "Create a new workflow that clicks the attack button every 2 seconds"
  - "Add a wait step before the click"
  - "Change the click delay to 3-5 seconds"
  - "Delete the last two actions"

**Voice Input:**
- Microphone button next to text input
- Push-to-talk or toggle mode
- Uses Web Speech API (browser) or Whisper API (for accuracy)
- Visual feedback: waveform display while recording
- Transcription shown before sending to LLM (user can edit)

#### OpenRouter Integration

**Configuration:**
```typescript
interface AIConfig {
  provider: 'openrouter';
  apiKey: string;                  // User provides their own key (encrypted storage)

  // Model selection
  primaryModel: string;            // Default: 'openai/gpt-5.2-codex'
  fallbackModel?: string;          // Default: 'anthropic/claude-3.5-sonnet'

  // Optional overrides
  temperature?: number;            // Default: 0.2 (more deterministic)
  maxTokens?: number;              // Default: 4096
}
```

**Supported Models (via OpenRouter):**
| Model | Best For | Cost |
|-------|----------|------|
| openai/gpt-5.2-codex | Code generation, JSON output | $$ |
| anthropic/claude-3.5-sonnet | Complex reasoning, nuanced understanding | $$ |
| openai/gpt-4o | General purpose, reliable | $$ |
| anthropic/claude-3-haiku | Fast, cheap, simple tasks | $ |

**Model Fallback:**
- If primary model fails (rate limit, outage), automatically try fallback
- User configures preferred models in Settings
- Fallback is transparent - user sees which model responded

**API Key Management:**
- User enters OpenRouter API key in Settings
- Key stored securely via electron-store (encrypted)
- Clear indicator when AI features unavailable (no key)
- Link to OpenRouter signup for new users
- Test connection button to verify key works

**Usage Tracking:**
- Display token count after each request (subtle badge)
- Monthly usage summary in Settings
- Link to OpenRouter dashboard for detailed billing
- No pre-request estimates (adds friction)

#### LLM System Prompt

The system prompt provides the workflow schema and context:

```typescript
const SYSTEM_PROMPT = `You are a workflow automation assistant for Workflow Studio, a game automation tool.

Your job is to convert natural language descriptions into workflow JSON or modify existing workflows.

## Game Context

You may receive an active game context pack with terminology, known intents, and constraints.
- Prefer game-context interpretations over generic assumptions when confidence is high.
- Never invent game mechanics not present in the context pack.
- If user intent requires detections/images not available, ask a clarification question.
- If game context is missing or low confidence, ask user to confirm the game before applying risky changes.

## Workflow Schema

A workflow contains actions that execute sequentially. Here are the action types:

### Mouse Move
{
  "type": "mouse_move",
  "target": { "mode": "absolute", "x": 500, "y": 300 }
    // OR { "mode": "detection", "detectionId": "button-image" },
  "duration": { "min": 200, "max": 400 }
}

### Mouse Click
{
  "type": "mouse_click",
  "button": "left" | "right" | "middle",
  "clickType": "single" | "double" | { "hold": { "min": 100, "max": 200 } },
  "position": { "mode": "absolute", "x": 500, "y": 300 },
  "jitter": { "enabled": true, "radius": 3, "distribution": "gaussian" }
}

### Keyboard
{
  "type": "keyboard",
  "mode": "type" | "press",
  "value": "hello" // or "ctrl+c" for key combos
}

### Wait
{
  "type": "wait",
  "mode": { "type": "delay", "duration": { "min": 1000, "max": 2000 } }
    // OR { "type": "detect_true", "detection": {...}, "timeout": 5000 }
}

### Conditional
{
  "type": "conditional",
  "condition": { "type": "pixel", ... },
  "thenActions": [...],
  "elseActions": [...]
}

### Loop
{
  "type": "loop",
  "iterations": 10 | "infinite",
  "delay": { "min": 500, "max": 1000 },
  "actions": [...]
}

## Detection Types

For triggers and conditions, these detection types are available:

- Pixel: { "type": "pixel", "position": {x, y}, "color": {r, g, b, tolerance} }
- Image: { "type": "image", "imageId": "...", "engine": "nutjs", "confidence": 0.9 }
- OCR: { "type": "ocr", "region": {...}, "match": { "mode": "contains", "text": "..." } }

## Response Format

Always respond with valid JSON in this format:
{
  "action": "create" | "modify" | "delete" | "clarify",
  "changes": [...],  // Array of actions to add/modify
  "explanation": "Brief explanation of what was done",
  "assumptions": ["Any assumptions made while generating changes"],
  "context": { "gameId": "runescape-3", "confidence": 0.92 },
  "clarification": "Question if user input is ambiguous"
}

## Guidelines

1. Use realistic delays (humans aren't instant)
2. Enable click jitter by default
3. Ask for clarification if coordinates or images are needed but not provided
4. When user says "click X", they usually mean move + click
5. Interpret game terminology naturally (health potion, inventory, etc.)
`;
```

#### Conversation Context

The LLM receives context about the current editing session:

```typescript
interface AIRequestContext {
  systemPrompt: string;

  // Current workflow state
  currentWorkflow: Workflow | null;

  // Resolved game context (optional)
  activeGameContext?: {
    resolution: GameContextResolution;
    pack?: GameContextPack;
  };

  // Available resources
  savedDetections: SavedDetection[];  // Images, pixels user has captured
  savedImages: CapturedImage[];

  // Recent conversation (per-workflow, persisted)
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;

  // User's request
  userInput: string;
}
```

#### Prompt Assembly Pipeline

Request payload to the LLM is assembled in deterministic order:
1. Base system prompt (schema + safety constraints)
2. Resolved game context summary (if present)
3. Current workflow JSON (if editing)
4. Available detections/images
5. Recent conversation history
6. New user input

Game context summary is token-budgeted and limited to:
- Top 20 terminology mappings
- Top 10 canonical intents by relevance
- High-priority constraints only

**Conversation Persistence:**
- History tied to specific workflow being edited
- Last 10 exchanges stored per workflow
- Cleared when:
  - User clicks "New Conversation" button
  - Workflow is deleted
  - User explicitly clears in settings
- Stored in workflow JSON alongside actions
- Helps AI understand iterative refinements ("make it faster", "add more delay")

#### Example Interactions

**Creating a new workflow:**
```
User: "Make a workflow that presses E every 3 seconds"

AI Response:
{
  "action": "create",
  "changes": [
    {
      "type": "loop",
      "iterations": "infinite",
      "delay": { "min": 2800, "max": 3200 },
      "actions": [
        {
          "type": "keyboard",
          "mode": "press",
          "value": "e"
        }
      ]
    }
  ],
  "explanation": "Created an infinite loop that presses E approximately every 3 seconds (with slight variation for realism)",
  "assumptions": ["No game-specific context was required for this keyboard action"],
  "context": { "gameId": null, "confidence": 1.0 }
}
```

**Editing with context:**
```
User: "Wait for the loot button to appear before pressing E"

AI Response:
{
  "action": "clarify",
  "context": { "gameId": null, "confidence": 0.62 },
  "clarification": "I can add a wait condition, but I need an image of the 'loot button' to detect it. Would you like to capture a screenshot of the button now?"
}
```

**Using existing detections:**
```
Context: User has a saved detection called "loot-button-img"

User: "Click the loot button when it appears"

AI Response:
{
  "action": "create",
  "changes": [
    {
      "type": "mouse_click",
      "button": "left",
      "clickType": "single",
      "position": { "mode": "detection", "detectionId": "loot-button-img" },
      "jitter": { "enabled": true, "radius": 3, "distribution": "gaussian" },
      "trigger": {
        "detection": { "type": "image", "imageId": "loot-button-img", "engine": "nutjs", "confidence": 0.85 },
        "timeout": 10000,
        "retryInterval": 100,
        "failAction": "skip"
      }
    }
  ],
  "explanation": "Added a click action that waits for your saved 'loot-button-img' to appear, then clicks it with natural jitter",
  "assumptions": ["The saved detection label matches the same loot button in current game context"],
  "context": { "gameId": null, "confidence": 0.9 }
}
```

#### UI Integration

**Workflow Builder Integration:**
- AI-generated actions appear in the visual builder immediately
- User can review before accepting
- "Accept" / "Modify" / "Reject" buttons
- Undo fully reverses AI changes
- Review step displays:
  - Active game context (`RuneScape 3`, `Inferred from prompt`, etc.)
  - Key assumptions made by AI ("Assumed inventory panel is already open")
  - Structured diff of workflow changes before apply

**Feedback Loop:**
- If user manually edits AI-generated actions, that's implicit feedback
- "This isn't what I meant" button for explicit correction
- Conversation continues until user is satisfied

#### Voice Input Details

**Speech-to-Text Options:**
```typescript
interface VoiceConfig {
  enabled: boolean;
  engine: 'browser' | 'whisper';

  // Global hotkey (works even when app minimized)
  hotkey: string;            // Default: 'Ctrl+Shift+V'
  hotkeyEnabled: boolean;    // User can disable

  // Browser (Web Speech API)
  browserConfig?: {
    language: string;        // Default: 'en-US'
    continuous: boolean;     // Keep listening
    interimResults: boolean; // Show partial results
  };

  // Whisper (more accurate, requires API call)
  whisperConfig?: {
    model: 'whisper-1';
    apiKey: string;          // OpenAI key (separate from OpenRouter)
  };
}
```

**Global Voice Hotkey:**
- Default: `Ctrl+Shift+V`
- Works when app is minimized or in background
- Opens floating transcription overlay near cursor
- User can rebind or disable in Settings
- Push-to-talk: hold hotkey to record, release to stop

**Voice UX Flow:**
1. User presses hotkey (or clicks microphone in UI)
2. Visual feedback: floating overlay with pulsing mic icon, waveform
3. User speaks: "Add a click at position 500, 300"
4. Transcription appears in overlay
5. User can edit transcription or press Enter to send
6. LLM processes, workflow updates
7. Overlay closes automatically after action completes

#### Error Handling

- Invalid JSON from LLM → Retry with error context
- Ambiguous input → Ask for clarification
- Missing resources (images) → Prompt to capture
- API failure → Show error, allow retry, offer manual creation
- Rate limiting → Queue requests, show status

### F6: Workflow Execution

#### F6.1: Execution Engine
- Execute actions sequentially
- Respect delays and wait conditions
- Handle image trigger timeouts gracefully
- Support infinite loops with manual stop
- Emit events for UI status updates

#### F6.2: Status Display
- Show current action being executed
- Show loop count progress
- Show last matched image (for debugging)
- Execution log with timestamps

#### F6.3: Stop Conditions
- Manual stop button
- Hotkey to stop (configurable, default: Escape)
- Loop count reached
- Error threshold (stop after N consecutive failures)

### F7: Safety Features

Critical safety mechanisms to prevent runaway automation and protect user accounts.

#### F7.1: Emergency Kill Switch
Instant stop for all automation, accessible even when things go wrong.

```typescript
interface SafetyConfig {
  // Panic hotkey - kills ALL workflows instantly
  panicHotkey: string;              // Default: 'Ctrl+Shift+Escape'
  panicHotkeyEnabled: boolean;

  // Dead man's switch - auto-stop if user appears AFK
  deadManSwitch: {
    enabled: boolean;
    triggerAfterMinutes: number;    // Default: 30
    requireMouseMovement: boolean;  // Any mouse movement resets timer
    requireKeyPress: boolean;       // Any key press resets timer
  };

  // Failure threshold
  autoStopOnFailure: {
    enabled: boolean;
    consecutiveFailures: number;    // Default: 5
    action: 'pause' | 'stop';
  };
}
```

**Panic Hotkey Behavior:**
- Works globally, even if app is minimized
- Immediately stops all running workflows
- Releases all held keys/mouse buttons
- Shows notification: "Emergency stop activated"
- Logs the event with timestamp

**Dead Man's Switch:**
- Monitors for user activity (mouse movement, key presses)
- If no activity for X minutes, assumes user is AFK and something went wrong
- Pauses all workflows, shows alert when user returns
- Prevents automation running indefinitely while user is away

#### F7.2: Activity Monitor
Real-time monitoring of workflow health.

```typescript
interface ActivityMonitor {
  // Track recent execution health
  recentFailures: number;
  recentSuccesses: number;
  failureRate: number;             // Rolling window

  // Alerts
  alerts: Array<{
    type: 'high_failure_rate' | 'stuck_action' | 'long_runtime';
    message: string;
    timestamp: string;
    workflowId: string;
  }>;
}
```

**Automatic Alerts:**
- High failure rate (>50% in last 10 actions)
- Stuck action (single action taking >10x expected time)
- Unusually long runtime (workflow running 2x typical duration)

### F8: Game Window Focus Detection

Automatically manage workflow execution based on game window state.

#### F8.1: Focus Tracking

```typescript
interface FocusConfig {
  enabled: boolean;
  targetWindow: {
    mode: 'any' | 'specific';
    windowTitle?: string;          // Partial match, e.g., "World of Warcraft"
    processName?: string;          // e.g., "wow.exe"
  };

  behavior: {
    onFocusLost: 'pause' | 'stop' | 'continue';
    onFocusGained: 'resume' | 'prompt' | 'nothing';
    pauseDelay: number;            // ms to wait before pausing (avoid brief alt-tabs)
    resumeDelay: number;           // ms to wait before resuming
  };
}
```

**Focus Detection Methods (Platform-Specific):**
| Platform | Method | Notes |
|----------|--------|-------|
| Windows | `GetForegroundWindow()` API | Full support |
| macOS | `NSWorkspace` notifications | Full support |
| Linux X11 | `xdotool` / `_NET_ACTIVE_WINDOW` | Full support |
| Linux Wayland | `xdg-desktop-portal` | Limited - may require user confirmation |

**Wayland Fallback:**
On Wayland, if portal API is unavailable:
- Poll window list less frequently
- Offer manual "I'm in game" toggle
- Warn user about limitations in settings

**UX Flow:**
1. User configures target game in workflow settings
2. Workflow starts, game must be focused
3. User alt-tabs → workflow pauses after delay
4. User returns to game → workflow resumes (or prompts)
5. Overlay shows pause/resume status

#### F8.2: Window Binding
- "Bind to Window" button captures current foreground window
- Stores window title and process name
- Warns if bound window not found when starting workflow

### F9: Debug Mode & Dry Run

Tools for testing and debugging workflows without risk.

#### F9.1: Dry Run Mode
Visualize workflow execution without actually performing actions.

```typescript
interface DryRunConfig {
  enabled: boolean;
  visualization: {
    showMousePath: boolean;        // Draw projected mouse movement
    showClickLocations: boolean;   // Highlight where clicks would occur
    showDetectionRegions: boolean; // Show image/pixel search areas
    overlayOpacity: number;        // 0-1
  };
  speed: 'realtime' | 'fast' | 'instant';
}
```

**Dry Run Visualization:**
- Transparent overlay on screen
- Animated cursor shows planned mouse path (cyan trail)
- Click locations marked with pulsing circles
- Detection regions highlighted with dashed borders
- Action labels appear near each action location

#### F9.2: Step-Through Execution
Execute one action at a time for debugging.

```typescript
interface StepThroughConfig {
  enabled: boolean;
  pauseBetweenActions: boolean;
  showActionDetails: boolean;      // Display action config before executing
  allowSkip: boolean;              // Skip current action
  allowEdit: boolean;              // Edit action mid-execution
}
```

**Step-Through Controls:**
- "Next" - Execute current action, pause before next
- "Skip" - Skip current action
- "Run to End" - Disable step-through, run remaining
- "Stop" - Cancel execution

#### F9.3: Detection Tester
Real-time testing of detection configurations.

```typescript
interface DetectionTester {
  // Live view of what detection "sees"
  livePreview: boolean;
  highlightMatches: boolean;
  showConfidenceScores: boolean;
  showSearchRegion: boolean;

  // Test results
  lastResult: {
    found: boolean;
    confidence: number;
    location?: { x: number; y: number };
    executionTime: number;
    screenshot?: string;           // Base64 of what was analyzed
  };
}
```

**Detection Tester UI:**
- Select any saved detection
- Click "Test Now" to run against current screen
- Shows: match/no-match, confidence %, location, time taken
- Highlights matched region on screen
- "Continuous Test" mode for real-time feedback

### F10: Workflow Scheduling

Run workflows automatically at specified times.

#### F10.1: Schedule Configuration

```typescript
interface WorkflowSchedule {
  id: string;
  workflowId: string;
  enabled: boolean;

  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'custom';

    // For 'once'
    runAt?: string;                // ISO datetime

    // For 'daily'
    dailyTime?: string;            // "08:00" (24h format)

    // For 'weekly'
    weeklyDays?: number[];         // 0=Sunday, 1=Monday, etc.
    weeklyTime?: string;

    // For 'custom' (cron-like)
    cronExpression?: string;
  };

  // Randomization to avoid exact-time patterns
  randomOffset: {
    enabled: boolean;
    maxMinutes: number;            // Default: 15 (±15 min)
  };

  // Requirements
  requirements: {
    gameWindowFocused: boolean;
    userPresent: boolean;          // Recent activity detected
  };

  // Notifications
  notifications: {
    beforeStart: number;           // Minutes before, 0 = disabled
    onComplete: boolean;
    onFailure: boolean;
  };
}
```

**Schedule UI:**
- Calendar view showing upcoming scheduled runs
- Quick presets: "Every day at 8am", "Weekdays at noon"
- Random offset toggle with explanation
- "Run Now" button to test scheduled workflow

#### F10.2: Schedule Execution
- App must be running (background/system tray)
- Shows notification before scheduled run
- Respects focus requirements (won't run if game not open)
- Logs all scheduled executions

### F11: Session Behavior & Break Simulation

Anti-detection features for long automation sessions.

#### F11.1: Session Limits

```typescript
interface SessionConfig {
  // Maximum continuous runtime
  maxSessionLength: {
    enabled: boolean;
    minutes: number;               // Default: 180 (3 hours)
    variance: number;              // ±minutes for randomization
    action: 'pause' | 'stop';
  };

  // Mandatory breaks
  breaks: {
    enabled: boolean;
    intervalMinutes: number;       // Default: 60
    intervalVariance: number;      // Default: 10 (±10 min)
    durationMinutes: {
      min: number;                 // Default: 5
      max: number;                 // Default: 15
    };
  };

  // Activity curves (simulate human attention)
  activityCurve: {
    enabled: boolean;
    pattern: 'steady' | 'warmup_cooldown' | 'random_bursts';
    // warmup_cooldown: slower start, peak in middle, taper at end
    // random_bursts: periods of high activity with slower periods
  };
}
```

**Break Simulation:**
- Workflow pauses naturally (completes current action)
- Shows "Taking a break" status
- Optional: move mouse randomly during break (looks AFK)
- Resumes with slight warm-up (slower initial actions)

#### F11.2: Behavioral Randomization

```typescript
interface BehavioralConfig {
  // Random micro-pauses (simulate thinking/distraction)
  microPauses: {
    enabled: boolean;
    frequency: number;             // 0-1, how often
    duration: { min: number; max: number };
  };

  // Occasional "mistakes" (mis-click, move away and back)
  simulateMistakes: {
    enabled: boolean;
    frequency: number;             // Default: 0.02 (2%)
  };

  // Session start randomization
  warmupPeriod: {
    enabled: boolean;
    durationSeconds: number;       // Slower actions at start
    speedMultiplier: number;       // 0.5 = half speed during warmup
  };
}
```

### F12: Sound Detection

Trigger actions based on game audio.

#### F12.1: Audio Capture

```typescript
interface SoundDetectionConfig {
  enabled: boolean;
  audioSource: 'system' | 'application';
  targetApplication?: string;      // Specific app audio only

  // Detection methods
  detections: SoundDetection[];
}

interface SoundDetection {
  id: string;
  name: string;
  type: 'volume_threshold' | 'frequency_pattern' | 'audio_fingerprint';

  // Volume threshold (simplest)
  volumeThreshold?: {
    level: number;                 // 0-1
    duration: number;              // ms above threshold
  };

  // Frequency pattern (detect specific tones)
  frequencyPattern?: {
    frequencyRange: { min: number; max: number };  // Hz
    duration: number;
  };

  // Audio fingerprint (match recorded sound)
  audioFingerprint?: {
    sampleFile: string;            // Path to reference audio
    confidence: number;            // 0-1
  };
}
```

**Use Cases:**
- Achievement/notification sounds → trigger collection
- Combat music starts → activate combat rotation
- Low health warning sound → use potion
- Silence detection → loading screen ended

#### F12.2: Sound Capture Tool
- "Record Sound" button captures system audio
- User plays the target sound in game
- Tool extracts fingerprint for matching
- Test button to verify detection works

#### F12.3: Platform-Specific Audio Capture

| Platform | Method | Setup Required |
|----------|--------|----------------|
| Windows | WASAPI loopback | None (automatic) |
| macOS | Virtual audio device | Install BlackHole or similar |
| Linux | PulseAudio monitor | Select monitor source |
| Linux | PipeWire | PulseAudio compatibility layer |

**Windows:**
- Uses WASAPI loopback capture
- No additional setup required
- Can capture system audio or specific application

**macOS:**
- System audio capture not natively supported
- Requires virtual audio device (BlackHole recommended - free, open source)
- Setup wizard guides user through installation
- Alternative: some games support app-specific audio routing

**Linux:**
- **PulseAudio**: Use monitor source (`pactl list sources | grep monitor`)
- **PipeWire**: PulseAudio compatibility works automatically
- App provides audio source selector
- May require `pavucontrol` for advanced routing

### F13: Notifications

Keep user informed of workflow status.

#### F13.1: Desktop Notifications

```typescript
interface NotificationConfig {
  enabled: boolean;

  // What to notify about
  events: {
    workflowStarted: boolean;
    workflowCompleted: boolean;
    workflowFailed: boolean;
    workflowPaused: boolean;       // Focus lost, break, etc.
    scheduledRunSoon: boolean;     // X minutes before scheduled run
    highFailureRate: boolean;
  };

  // How to notify
  style: {
    sound: boolean;
    soundFile?: string;            // Custom sound
    persistent: boolean;           // Stay until dismissed
  };
}
```

**Notification Types:**
- Native OS notifications (Windows Toast, macOS Notification Center)
- In-app notification panel (history of recent notifications)
- Optional sound alerts

#### F13.2: Mobile Push Notifications (Optional)

```typescript
interface MobilePushConfig {
  enabled: boolean;
  service: 'pushover' | 'ntfy' | 'pushbullet';

  // Service-specific config
  pushover?: {
    userKey: string;
    apiToken: string;
  };
  ntfy?: {
    serverUrl: string;             // Default: https://ntfy.sh
    topic: string;
  };
}
```

- User brings own account/API key
- Useful for monitoring long AFK sessions
- Critical alerts only (failures, unexpected stops)

### F14: Workflow Chaining

Run multiple workflows in sequence.

#### F14.1: Chain Configuration

```typescript
interface WorkflowChain {
  id: string;
  name: string;
  description?: string;

  steps: Array<{
    workflowId: string;
    condition?: 'always' | 'on_success' | 'on_failure';
    delayBefore?: { min: number; max: number };  // ms
  }>;

  // Chain-level settings
  stopOnFirstFailure: boolean;
  loopChain: boolean;
  loopCount?: number | 'infinite';
}
```

**Example Chain:**
```
"Morning Dailies" chain:
1. "Login and Collect Rewards" → on_success →
2. "Spend Stamina on Dungeons" → on_success →
3. "Collect Mail" → always →
4. "Logout"
```

#### F14.2: Chain UI
- Visual chain builder (connect workflow cards)
- Drag to reorder
- Conditional branches (success/failure paths)
- Test chain with dry-run

### F15: Analytics Dashboard

Track workflow performance over time.

#### F15.1: Execution Metrics

```typescript
interface WorkflowAnalytics {
  workflowId: string;

  // Execution stats
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;

  // Timing
  averageExecutionTime: number;    // ms
  fastestRun: number;
  slowestRun: number;

  // Failure analysis
  failureReasons: Array<{
    reason: string;
    count: number;
    lastOccurred: string;
  }>;

  // Detection performance
  detectionStats: Array<{
    detectionId: string;
    attempts: number;
    successes: number;
    averageConfidence: number;
    averageTime: number;
  }>;

  // History
  recentRuns: Array<{
    timestamp: string;
    success: boolean;
    duration: number;
    actionsCompleted: number;
    failureReason?: string;
  }>;
}
```

#### F15.2: Dashboard UI
- Overview: total runs, success rate, time saved
- Per-workflow cards with sparkline charts
- Detection health: "Image X fails 30% of the time"
- Recommendations: "Consider adjusting confidence threshold"
- Export data as CSV

#### F15.3: Insights & Recommendations

```typescript
interface AnalyticsInsight {
  type: 'warning' | 'suggestion' | 'info';
  title: string;
  description: string;
  actionable: boolean;
  action?: {
    label: string;
    workflowId?: string;
    detectionId?: string;
  };
}
```

**Example Insights:**
- "Detection 'loot-button' has 45% success rate. Try increasing confidence threshold or using OpenCV engine."
- "Workflow 'Daily Farm' runs 20% faster on average. Consider reducing delays."
- "You've automated 47 hours of gameplay this month."

### F16: Game Profiles

Organize workflows and settings by game.

#### F16.1: Profile Configuration

```typescript
interface GameProfile {
  id: string;
  name: string;                    // "World of Warcraft"
  icon?: string;                   // Custom icon or extracted from exe

  // Game detection
  detection: {
    windowTitle?: string;          // Partial match
    processName?: string;          // "wow.exe"
    executablePath?: string;       // Full path for auto-launch
  };

  // Profile-specific settings
  settings: {
    movementProfile?: string;      // Different movement style per game
    defaultDetectionEngine: 'nutjs' | 'opencv' | 'sharp';
    coordinateOffset?: { x: number; y: number };  // For windowed mode
    aiContextPackId?: string;      // Links profile to game context pack
    aiContextMode: 'strict' | 'assist' | 'off';   // strict=enforce pack, assist=best effort
  };

  // Associated resources
  workflows: string[];             // Workflow IDs in this profile
  detections: string[];            // Detection IDs
  images: string[];                // Image IDs
}
```

#### F16.2: Profile UI
- Game profile selector in sidebar
- Switching profiles shows only that game's workflows/detections
- "Add Game" wizard:
  1. Detect running game or browse for exe
  2. Auto-capture window title and process
  3. Optional: create default movement profile for this game

#### F16.3: Profile Benefits
- Cleaner organization for multi-game users
- Game-specific movement profiles (FPS vs MMO vs mobile)
- Quick switching between games
- Import/export profiles to share setups

#### F16.4: Profile-AI Coupling
- When a profile is active, AI composer preselects that profile's game context
- If profile has `aiContextMode: strict`, AI cannot silently fall back to another game
- If profile has `aiContextMode: assist`, AI may infer from prompt but must show source and confidence
- If profile has `aiContextMode: off`, AI operates in generic mode

## Non-functional Requirements

### Performance

**Detection Speed Targets:**
| Method | Target | Max Acceptable |
|--------|--------|----------------|
| Pixel/Color | < 5ms | 10ms |
| Image (nut.js) | < 50ms | 100ms |
| Image (sharp) | < 30ms | 60ms |
| Image (OpenCV) | < 100ms | 200ms |
| OCR | < 300ms | 500ms |

**Other Performance Requirements:**
- Mouse movement generation must not cause visible stuttering
- UI must remain responsive during workflow execution
- Detection runs in worker thread to prevent UI blocking
- Movement profile generation is background task

### Storage
- All data stored locally (no cloud sync)
- Workflows exportable as JSON files
- Images stored as PNG in designated folder
- Movement profiles stored in app data directory

### Security
- No external network calls for core non-AI automation functionality
- AI and optional Whisper calls are opt-in and only used with user-provided API keys
- No telemetry or usage tracking
- Workflows are human-readable JSON (auditable)

### Compatibility

#### Supported Platforms
| Platform | Support Level | Notes |
|----------|---------------|-------|
| Windows 10/11 | Full (Primary) | All features supported |
| macOS 12+ | Full (Secondary) | Requires permissions, sound capture needs workaround |
| Linux (X11) | Full | Ubuntu 22.04+, Fedora 38+, Arch tested |
| Linux (Wayland) | Partial | Limited hotkeys and window detection |

#### Platform Feature Matrix

| Feature | Windows | macOS | Linux X11 | Linux Wayland |
|---------|---------|-------|-----------|---------------|
| Core Automation | Full | Full | Full | Full |
| Screen Capture | Full | Permission required | Full | Portal API |
| Global Hotkeys | Full | Full | Full | Limited |
| Window Focus Detection | Full | Full | Full | Limited |
| Sound Capture | Full | Virtual audio device | PulseAudio/PipeWire | PipeWire |
| Notifications | Full | Full | Full | Full |

#### Windows Notes
- All features work out of the box
- Run as Administrator recommended for some games
- Windows Defender may flag automation (add exclusion)

#### macOS Notes
- **Screen Recording Permission**: Required in System Preferences → Privacy & Security
- **Accessibility Permission**: Required for automation (mouse/keyboard control)
- **Sound Capture**: Requires virtual audio device (BlackHole recommended) for system audio
  - Alternative: App-specific audio capture where supported
- Gatekeeper may require app to be explicitly allowed

#### Linux Notes
- **X11 (Recommended for gaming)**:
  - Full feature support
  - Most games run on X11 for compatibility
  - Install: `xdotool`, `xclip` dependencies

- **Wayland Limitations**:
  - Global hotkeys restricted by security model (use X11 for full support)
  - Window detection limited (Portal API fallback)
  - Some features require `xdg-desktop-portal`
  - Consider running app with `GDK_BACKEND=x11` flag

- **Sound Capture**:
  - PulseAudio: Full support via `pulseaudio` module
  - PipeWire: Supported via PulseAudio compatibility layer
  - May require user to select audio source

- **Tested Distributions**:
  - Ubuntu 22.04 LTS, 24.04 LTS
  - Fedora 38+
  - Arch Linux (rolling)
  - Linux Mint 21+
  - Steam Deck (Desktop Mode, X11)

#### Game Mode Compatibility
- Works with windowed and borderless windowed games
- May not work with exclusive fullscreen (OS limitation on all platforms)
- Steam Deck: Works in Desktop Mode

## Performance Strategy & Budgets

### Strategy
- Keep AI context pack retrieval local and deterministic (no remote RAG dependency)
- Cache resolved game context + top intent snippets in memory per workflow session
- Enforce bounded context assembly to prevent prompt bloat
- Validate and diff AI output incrementally to keep review UI responsive

### Budgets

| Path | Target (p95) | Hard Limit |
|------|--------------|------------|
| Game context resolution | < 40ms | 100ms |
| Prompt assembly (including pack summary) | < 80ms | 200ms |
| AI roundtrip (submit -> response) | < 12s | 20s |
| JSON validation + workflow diff generation | < 120ms | 300ms |
| Review panel render after AI response | < 100ms | 250ms |

### Validation
- Add instrumentation for each budgeted stage
- Track regressions in analytics dashboard and local developer logs
- Fail safely: if context resolution breaches hard limit, continue in generic mode with warning

## Security Architecture & Threat Model

### Trust Boundaries
1. User input (text/voice) is untrusted
2. Game context pack files are trusted only after schema + signature validation
3. LLM responses are untrusted until schema and policy checks pass
4. Workflow execution layer is privileged and must enforce policy independently of AI output

### Threats & Mitigations

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Prompt injection through user input | User includes instructions to bypass safeguards | System prompt is immutable, strict JSON schema validation, policy layer rejects disallowed actions |
| Malicious or stale game context pack | Tampered pack file or outdated mapping | Signed pack manifests, version pinning, checksum verification, safe fallback to generic mode |
| Unsafe action generation | AI hallucinates risky loops/actions | Max loop/runtime defaults, risk scanner flags hazardous patterns, explicit user review required |
| Context spoofing | Wrong game inferred from ambiguous text | Confidence thresholds + clarification flow before apply |
| Sensitive data leakage | Sending local file paths/secrets to LLM | Redaction layer for secrets/paths, only minimal required context sent to provider |

### Authorization & Policy
- AI generation never directly executes actions; it only proposes workflow diffs
- Apply step requires explicit user confirmation
- Execution engine enforces existing safety rules (panic hotkey, runtime limits, focus checks)

## Data & Integrations

### Local Storage Structure

**User Data Directory ({scriptsDir}):**
```
{scriptsDir}/
├── workflows/
│   ├── workflow-{id}.json
│   └── ...
├── game-context/
│   ├── packs/
│   │   ├── runescape-3.v1.json
│   │   └── ...
│   ├── overrides/
│   │   ├── user-overrides.json     # Optional user tuning per pack
│   │   └── ...
│   └── index.json                  # Installed packs + versions
├── images/
│   ├── {id}.png              # Captured images for detection
│   └── ...
├── detections/
│   └── library.json          # Saved detection configurations
└── profile/
    ├── movement.json         # Movement profile
    └── samples/              # Raw movement recordings
        ├── session-{timestamp}.json
        └── ...
```

**App Config (electron-store, OS app data directory):**
```
{appData}/workflow-studio/
├── config.json               # App settings
│   ├── scriptsDir            # User's chosen scripts directory
│   ├── theme                 # UI preferences
│   ├── hotkeys               # Global hotkey configuration
│   └── ...
├── secrets.json              # Encrypted sensitive data
│   ├── openRouterApiKey      # User's OpenRouter API key
│   ├── whisperApiKey         # Optional Whisper API key
│   └── ...
└── cache/
    ├── ai-conversations/     # Recent AI conversation history
    └── ai-evals/             # Prompt/response eval metadata (no secrets)
```

**API Key Security:**
- Keys stored in separate `secrets.json` file
- Encrypted at rest using electron-store's encryption
- Never included in workflow exports
- Never sent anywhere except the respective API endpoints

### Technology Stack

#### Core Technologies
| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Automation** | nut.js | Modern, maintained, cross-platform, built-in image matching |
| **Image Detection (Default)** | nut.js | Good balance of speed/accuracy, already included |
| **Image Detection (Advanced)** | OpenCV.js (WASM) | More matching algorithms, handles variations better |
| **Image Detection (Fast)** | sharp | Fastest for exact matches, low memory |
| **OCR** | Tesseract.js | Best JS OCR library, runs in browser/Node |
| **Pixel Detection** | Native Canvas API | Fastest possible, direct pixel access |
| **Screenshot** | Electron desktopCapturer | Native integration, full screen or region capture |
| **Storage** | electron-store + fs | JSON for config, filesystem for workflows/images |
| **Movement Math** | Custom Wind Mouse | Proven algorithm for human-like movement |
| **AI/NLP** | OpenRouter API | Access to GPT 5.2 Codex, user brings own key |
| **Game Context Packs** | Versioned local JSON + schema validator | Deterministic, auditable game-specific knowledge |
| **Speech-to-Text** | Web Speech API / Whisper | Browser native or high-accuracy cloud option |
| **Audio Analysis** | Web Audio API + Meyda | Frequency analysis, volume detection |
| **Audio Fingerprinting** | Chromaprint / AcoustID | Match recorded sounds |
| **Notifications** | Electron Notification API | Native OS notifications |
| **Mobile Push** | Pushover / ntfy APIs | User brings own key, optional |
| **Scheduling** | node-cron | Reliable cron-like scheduling |
| **Analytics Storage** | SQLite (better-sqlite3) | Efficient local analytics storage |

#### Platform-Specific Technologies

**Windows:**
| Component | Technology |
|-----------|------------|
| Window Management | Win32 API via `ffi-napi` |
| Audio Capture | WASAPI loopback |
| Global Hotkeys | Electron globalShortcut |

**macOS:**
| Component | Technology |
|-----------|------------|
| Window Management | NSWorkspace via native module |
| Audio Capture | Virtual audio device (BlackHole) |
| Global Hotkeys | Electron globalShortcut |
| Permissions | `node-mac-permissions` |

**Linux:**
| Component | Technology |
|-----------|------------|
| Window Management (X11) | `xdotool`, `_NET_ACTIVE_WINDOW` |
| Window Management (Wayland) | `xdg-desktop-portal` |
| Audio Capture | PulseAudio / PipeWire |
| Global Hotkeys (X11) | Electron globalShortcut |
| Global Hotkeys (Wayland) | `xdg-desktop-portal` (limited) |
| Dependencies | `xdotool`, `xclip`, `libappindicator` |

#### Linux Dependencies (Package Installation)

**Ubuntu/Debian:**
```bash
sudo apt install xdotool xclip libappindicator3-1
```

**Fedora:**
```bash
sudo dnf install xdotool xclip libappindicator-gtk3
```

**Arch:**
```bash
sudo pacman -S xdotool xclip libappindicator-gtk3
```

### Library Details

**nut.js Capabilities:**
- `mouse.move()` - Move mouse with custom speed
- `mouse.click()` - Click any button
- `keyboard.type()` - Type text with delays
- `keyboard.pressKey()` - Key combinations
- `screen.find()` - Template matching
- `screen.capture()` - Screenshot regions
- `screen.colorAt()` - Pixel color detection

**OpenCV.js Capabilities:**
- Template matching with multiple algorithms
- Grayscale conversion
- Multi-scale matching
- Thresholding for preprocessing
- Edge detection (for complex scenarios)

**sharp Capabilities:**
- Fast image loading/saving
- Pixel-level comparison
- Region extraction
- Color space conversion
- Resize for multi-scale matching

**Tesseract.js Capabilities:**
- Multiple language support
- Character whitelisting
- Confidence scores
- Bounding box output
- Page segmentation modes

### Detection Engine Selection Guide

| Scenario | Recommended Engine | Why |
|----------|-------------------|-----|
| Static UI buttons/icons | nut.js | Fast, reliable for exact matches |
| UI with slight variations | OpenCV | Handles color/brightness changes |
| Performance-critical loops | sharp | Fastest execution |
| Reading item counts | OCR | Purpose-built for text |
| Health bar percentage | Pixel/Color | Instant, exact |
| Button active/inactive | Pixel/Color | Simple color change |
| Loading screens | Pixel/Color | Check for black screen |
| Quest text detection | OCR | Dynamic text content |
| Inventory slot detection | OpenCV | Handles item variations |

## Open Questions

1. Which games are in v1 "supported" list for context packs (top 3, top 10, or community-driven)?
2. Should user-created custom game packs be allowed in v1, or only official signed packs?
3. How aggressive should strict mode be for profile-linked AI context (block apply vs warn-and-continue)?
4. What level of telemetry (if any) is acceptable for measuring intent accuracy while maintaining privacy-first positioning?
5. What is the content review process for game-pack updates to prevent bad or unsafe guidance?

## Design Decisions

Resolved decisions for key architecture and UX questions:

### 1. Exclusive Fullscreen Handling
**Decision: Warn users + document workaround**
- Display tooltip/documentation explaining the limitation
- Suggest users switch to "Borderless Windowed" in game settings
- Most modern games default to borderless windowed anyway
- Not a blocker for 90%+ of use cases

### 2. Multi-monitor Support
**Decision: Absolute coordinates across virtual desktop**
- Use absolute coordinates spanning all monitors (Windows virtual screen)
- Coordinate picker UI shows monitor boundaries visually
- Store which monitor a workflow was designed for
- Warn user if monitor setup changes since workflow creation

### 3. Movement Profile Sharing
**Decision: No export/import in UI**
- Exporting defeats the purpose of unique profiles
- Power users can manually copy profile files if needed
- No UI feature to encourage sharing

### 4. Macro Recording
**Decision: Yes, add in Phase 7**
- Record mouse movements, clicks, keypresses with timestamps
- Generate workflow JSON from recording
- User can refine/edit the generated workflow
- Major UX improvement for "just repeat what I did"

### 5. Action Groups / Sub-workflows
**Decision: Yes, implement as "Routines"**
- Reusable action sequences callable from any workflow
- Example: "Open Inventory" routine used across multiple workflows
- Reduces duplication, easier maintenance
- Add in Phase 7

### 6. Default Detection Engine
**Decision: nut.js default, per-action override available**
- nut.js handles 80% of use cases well
- Engine selector shown in expanded/advanced action settings
- New users see simple UI; power users can customize
- Document when to use each engine

### 7. OCR Language Packs
**Decision: English bundled, others download on-demand**
- Bundle English (en) by default
- Other languages downloaded when user selects them in settings
- Cache downloaded packs locally
- Show download progress indicator

### 8. Detection Fallback Chain
**Decision: Yes, simple two-level fallback**
- Optional setting per detection: "If primary fails, try fallback"
- Maximum two levels (primary + one fallback)
- Example: nut.js → OpenCV if confidence too low
- Advanced setting, not required for basic use

### 9. Movement Profile Recording Minimum
**Decision: 15 minutes minimum, 1 hour recommended**
- 15 minutes = minimum to generate basic profile
- Quality tiers: "Basic" (15min) / "Good" (1hr) / "Excellent" (3hr+)
- Allow use of basic profile with warning about reduced uniqueness
- Encourage continued recording over time

### 10. Profile Quality Score
**Decision: Yes, show quality indicator**
- Visual progress indicator (progress bar + label)
- Based on: sample count, movement diversity, time coverage
- Display: "Profile Quality: Good (73%)"
- Tooltip explains how to improve

### 11. AI Model Fallback
**Decision: Yes, user-configurable model selection**
- Settings page for model preference
- Default: GPT 5.2 Codex
- User can select alternatives: Claude 3.5 Sonnet, GPT-4o, etc.
- Automatic fallback if primary model unavailable
- OpenRouter handles model routing

### 12. AI Conversation Persistence
**Decision: Per-workflow, last 10 exchanges**
- Conversation context tied to workflow being edited
- Store last 10 user/assistant message pairs
- Cleared when workflow closed or user clicks "New Conversation"
- Helps AI understand iterative edit context

### 13. Voice Input Hotkey
**Decision: Yes, configurable global hotkey**
- Default: `Ctrl+Shift+V`
- Works when app is minimized/in background
- Opens floating transcription overlay
- User can disable or rebind in settings

### 14. AI Cost Transparency
**Decision: Show usage after requests, monthly summary**
- Display token count after each AI request (subtle, non-intrusive)
- Monthly usage summary available in settings
- Link to OpenRouter dashboard for detailed billing
- No pre-request estimates (adds friction, often inaccurate)

### 15. Game Selector vs Prompt-Only Context
**Decision: Hybrid approach (optional selector + inference fallback)**
- Include optional game selector in AI composer for precision and fast disambiguation
- Do not require selector; users can still type game names naturally
- Use profile context as default selection when available
- Require clarification on low-confidence inference before applying changes
- Preserve generic mode for unsupported games or game-agnostic workflows

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Anti-cheat detection | Users banned from games | Medium | Human-like movements, unique profiles, conservative timing, click jitter, break simulation |
| Image detection fails | Workflows break | Medium | Multiple engines available, confidence tuning, retry logic, fallback options |
| OCR inaccuracy | Wrong actions triggered | Medium | Preprocessing options, character whitelisting, confidence thresholds |
| Performance issues | Poor UX, stuttering | Low | Worker threads for detection, engine selection guide, search region limits |
| Cross-platform differences | Inconsistent behavior | Medium | Platform abstraction layer, CI testing on all platforms, document limitations |
| OpenCV WASM size | Slow initial load | Low | Lazy load OpenCV only when needed, show loading indicator |
| Movement profile insufficient | Generic-looking movements | Medium | Require minimum recording time, provide quality indicator |
| AI generates invalid JSON | Workflow creation fails | Medium | JSON validation, retry with error context, fallback to manual |
| AI misunderstands intent | Wrong workflow created | Medium | Show preview before applying, easy undo, clarification flow |
| Wrong game context selected/inferred | Workflow semantically incorrect for game | Medium | Show context source + confidence, allow one-click override, strict-mode profiles |
| Game context packs drift over time | Guidance becomes outdated | Medium | Versioned packs, release cadence, deprecation flags, fallback to generic mode |
| Context packs increase token usage | Higher latency/cost | Medium | Budgeted pack summaries, relevance ranking, strict token caps |
| OpenRouter API costs | Unexpected user charges | Low | Show token estimates, usage tracking in UI, model selection |
| API key security | Key exposure | Low | Encrypted storage, never in exports, clear security docs |
| Voice recognition errors | Frustrating UX | Medium | Show transcription before sending, easy edit, fallback to text |
| Runaway automation | Unintended actions while AFK | Medium | Dead man's switch, panic hotkey, activity monitor, failure thresholds |
| Sound detection false positives | Wrong triggers | Medium | Confidence thresholds, fingerprint matching, manual testing tools |
| Scheduled run when unprepared | Workflow fails, resources wasted | Low | Pre-run requirements (game focused), notifications before run |
| Analytics data growth | Storage bloat | Low | Data retention limits, auto-cleanup of old data |
| Focus detection fails | Automation in wrong window | Low | Multiple detection methods (title + process), manual window binding |
| Wayland limitations | Features unavailable on modern Linux | Medium | Recommend X11 for gaming, graceful fallbacks, clear documentation |
| macOS permissions | Features fail without permissions | Medium | Setup wizard, permission checker, clear error messages |
| Linux audio fragmentation | Sound detection fails | Medium | Support both PulseAudio and PipeWire, audio source selector |
| Linux distro variations | Inconsistent behavior | Low | Test on major distros, document dependencies, provide troubleshooting guide |

## Success Metrics

1. **Usability**: 80% of test users can create a working 5-action workflow without assistance
2. **Reliability**: Workflows execute successfully 95%+ of the time when game state is correct
3. **Naturalness**: Blind test - observers cannot distinguish automated movements from human in 70%+ of cases
4. **Performance**: No frame drops or stuttering during workflow execution
5. **Game Intent Accuracy**: For supported games, evaluator marks AI intent interpretation correct in >= 85% of first drafts
6. **Correction Load**: Median manual edits after AI generation <= 3 action-level edits per request

## Rollout Plan

### Phase 1: Foundation (MVP)
- Workflow CRUD operations
- Basic action types (move, click, type, wait)
- Fixed coordinate targeting
- Wind Mouse algorithm with basic parameters
- Click jitter (Gaussian distribution)
- Local file storage with configurable directory
- Settings UI with scripts directory configuration

### Phase 2: Detection System
- Screenshot capture tool
- **Pixel/Color detection** (fastest, simplest)
- **Image detection with nut.js** (default engine)
- Detection library (save & reuse detections)
- Detection-triggered actions
- Wait for detection conditions

### Phase 3: Advanced Detection
- **OpenCV.js integration** (advanced image matching)
- **sharp integration** (fast exact matching)
- **OCR with Tesseract.js** (text recognition)
- Detection method selector per action
- Search region optimization
- Multi-scale matching

### Phase 4: Human-like Behavior
- Overshoot & correction system
- Movement profile recording
- Profile extraction & generation
- Unique per-user profiles
- Timing humanization (fatigue, pauses)
- Profile evolution over time

### Phase 5: AI-Assisted Creation
- OpenRouter integration (GPT 5.2 Codex)
- API key settings (user brings own key, stored encrypted)
- Text input for natural language workflow creation
- Context-aware editing (knows current workflow, saved detections)
- Hybrid game context resolution (selector, profile, inference, generic fallback)
- Game context chip/dropdown in AI composer with confidence indicators
- Initial context pack schema and validator
- Ship first-party context packs for initial supported games
- Clarification flow for ambiguous inputs
- Voice input (Web Speech API)
- Optional Whisper integration for better accuracy

### Phase 6: Advanced Actions
- Conditional actions (if/else)
- Loop actions with conditions
- Nested action groups
- Variables and counters
- Error handling options

### Phase 7: Safety & Focus
- **Emergency Kill Switch**: Panic hotkey (Ctrl+Shift+Escape)
- **Dead Man's Switch**: Auto-stop after X minutes of no user activity
- **Activity Monitor**: Track failure rates, alert on issues
- **Game Window Focus Detection**: Auto-pause when game loses focus
- **Window Binding**: Associate workflows with specific game windows

### Phase 8: Debug & Testing Tools
- **Dry Run Mode**: Visualize workflow without executing
- **Step-Through Execution**: Debug one action at a time
- **Detection Tester**: Real-time detection testing with confidence display
- Execution log improvements
- Undo/redo system

### Phase 9: Scheduling & Sessions
- **Workflow Scheduling**: Run at specific times (daily, weekly, cron)
- **Session Limits**: Max runtime, mandatory breaks
- **Break Simulation**: Automatic pauses to mimic human behavior
- **Activity Curves**: Warmup/cooldown patterns
- **Behavioral Randomization**: Micro-pauses, simulated mistakes

### Phase 10: Polish & UX
- Drag-and-drop workflow builder
- Visual action cards with connections
- Real-time detection preview
- Movement profile visualization
- AI conversation history

### Phase 11: Advanced Features
- **Macro Recording**: Record user actions and generate workflow
- **Routines**: Reusable action groups callable from any workflow
- **Workflow Chaining**: Run multiple workflows in sequence
- Multi-monitor coordinate picker
- Detection fallback chains
- Workflow templates library

### Phase 12: Extended Features
- **Sound Detection**: Trigger on game audio (volume, frequency, fingerprint)
- **Desktop Notifications**: Native OS notifications for workflow events
- **Mobile Push Notifications**: Pushover/ntfy integration (user brings own key)
- **Analytics Dashboard**: Success rates, timing stats, recommendations
- **Game Profiles**: Organize workflows/settings by game
- **Context Pack Updates**: Signed pack updates and version management
- Import/export profiles for sharing

## Next Steps

1. Review and approve PRD
2. Create technical design document for Wind Mouse algorithm
3. Prototype detection engines in Electron:
   - nut.js (image + pixel)
   - OpenCV.js integration
   - Tesseract.js integration
4. Prototype OpenRouter integration:
   - API key management (encrypted storage)
   - System prompt and schema design
   - JSON response parsing and validation
5. Define v1 game context pack schema and authoring checklist
6. Build AI context resolution service (selector/profile/inference/generic)
7. Prototype game-aware prompt assembly with RuneScape 3 sample intents
8. Design workflow builder + AI composer UI mockups
9. Implement detection engine abstraction layer
10. Begin Phase 1 implementation
