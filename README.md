# theDAW

**by GANTASMO**

theDAW is an all-in-one application for music creation. You describe a sound and the generative engine renders it from your prompt or from audio you bring, and the Chimera engine blends and beat-aligns several sources into a single generation. The workspace opens into a full studio for composition, arrangement, editing, and mixing, and into a live rig for DJing and VJing with a deep MIDI mapping system for any controller you own. Audio and visual effects, real-time visualizers, and an interactive genealogy graph round out the environment. From idea to live performance, theDAW can do it all.

Live coding and Unity integration are on the way.

> **Complete documentation:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md) is the source of truth for every feature, endpoint, and control. The in-app **Docs** button renders it as an interactive modal with PDF export.

[User Guide](docs/USER_GUIDE.md) · [Windows Setup](docs/windows/setup-guide.md)

---

## Repository Structure

| Component | Location | Description |
|---|---|---|
| **Upstream ML pipeline** | `stable_audio_3/` | DiT diffusion transformer, SAME autoencoder, all samplers, LoRA training and inference, distribution-shift schedules. |
| **FastAPI backend** | `backend/server.py` | Async HTTP wrapper. Manages a job queue for generation, synchronous FFmpeg-based audio processing, model introspection endpoints. Binds to port 8600. |
| **Backend modules** | `backend/modules/` | Plugin system. Each subdirectory holds `module.json` (metadata, enabled flag, API prefix) and `router.py` (FastAPI APIRouter). The loader mounts every enabled module at startup and isolates any module that fails to load. Shipped modules: `analysis` (`/api/analysis`), `chimera` (`/api/chimera`), `controllervision` (`/api/controllervision`), `effects` (`/api/studio`), `library` (`/api/library`), `midi` (`/api/midi`), `settings` (`/api/settings`), `stems` (`/api/stems`), `vj` (`/api/vj`), and `ytimport` (`/api/ytimport`). |
| **theDAW interface** | `frontend/` | React 19, Vite 6, Tailwind 4, Zustand 5. The full studio across seven workspaces (MAKE, EDIT, MIX, DJ, VJ, TRAIN, LEARN): generation with Chimera blending, the multi-track waveform editor, step sequencer, piano roll, live mixer, the two-deck DJ console with live stems and MIDI control, the VJ visualizer, the persistent library, the spectral analyzer, and the LEARN genealogy graph. Proxies `/api/*` to the backend. Runs on port 5173 in development. |

---

## Quick Start

### Launch (Windows one-shot)

```powershell
.\start-dev.bat
```

The launcher kills stale processes on ports 5173 and 8600, starts the backend, waits for it to bind, then starts the Vite dev server and opens `http://localhost:5173`.

### Launch (macOS experimental)

```bash
./start-dev.command
```

The macOS launcher mirrors the development workflow: it checks for `uv`, Node,
npm, and FFmpeg, syncs dependencies, starts the backend and frontend, then opens
`http://localhost:5173`. `scripts/macos/create-app.sh` creates a local
`build/theDAW.app` wrapper with a native WebKit window, and
`scripts/macos/create-dmg.sh` packages that wrapper into a drag-to-Applications
DMG. This is not yet a fully self-contained, signed, or notarized macOS
distribution; the app wrapper launches the checked-out repository.

### Manual launch

```bash
# Terminal 1: backend
uv run uvicorn backend.server:app --host 0.0.0.0 --port 8600 --reload

# Terminal 2: frontend
cd frontend && npm run dev
```

### Dependencies

```bash
# Python (Windows: installs CUDA 12.8 torch and Flash Attention automatically)
uv sync

# Frontend
cd frontend && npm install
```

On Windows, `pyproject.toml` includes CUDA 12.8 wheel sources for torch and torchaudio, plus the pre-built Flash Attention wheel for Python 3.10. `uv sync` installs all of them without additional flags. On Linux, install the appropriate CUDA wheel index manually if the default does not match your CUDA version:

```bash
uv pip install torch==2.7.1 torchaudio==2.7.1 --index-url https://download.pytorch.org/whl/cu126
```

See [§3 of the User Guide](docs/USER_GUIDE.md#3-installation) for full installation details.

---

## Inference Modes

### Text-to-audio

```python
from stable_audio_3 import StableAudioModel

pipe = StableAudioModel.from_pretrained("medium")
audio = pipe.generate(
    prompt="Lo-fi boom bap meets orchestral strings, 84 BPM",
    duration=180,
)
```

### Audio-to-audio

```python
# Audio-to-audio
import torchaudio

init_audio = torchaudio.load("/path/to/audio.wav")
audio = pipe.generate(
    init_audio=init_audio,
    init_noise_level=0.9,
    prompt="bossa nova bassline",
    duration=30,
)
```

### Inpainting / continuation

```python
inpaint_audio = torchaudio.load("/path/to/audio.wav")
audio = pipe.generate(
    inpaint_audio=inpaint_audio,
    inpaint_mask_start_seconds=4.0,
    inpaint_mask_end_seconds=8.0,
    prompt="punchy kick drum fill",
    duration=30,
)
```

Continuation: set `inpaint_mask_start_seconds` to the source length and `duration` to the desired total output length.

### Autoencoder (standalone)

```python
from stable_audio_3 import AutoencoderModel
import torchaudio

ae = AutoencoderModel.from_pretrained("same-l")
waveform, sr = torchaudio.load("audio.wav")
latents = ae.encode(waveform, sr)
audio_out = ae.decode(latents)
```

See [docs/workflows/autoencoder.md](docs/workflows/autoencoder.md) for batch encoding and dataset pre-encoding.

---

## Models

| Key | Flavor | Params | Autoencoder | Hardware | Max Duration |
|---|---|---|---|---|---|
| `small` | ARC | 433 M | SAME-S | CPU | 120 s |
| `medium` | ARC | 1.4 B | SAME-L | GPU (CUDA) | 380 s |
| `small-rf` | RF | 433 M | SAME-S | CPU | 120 s |
| `medium-rf` | RF | 1.4 B | SAME-L | GPU (CUDA) | 380 s |
| `same-s` | Autoencoder | 266 M | n/a | CPU | n/a |
| `same-l` | Autoencoder | 1.7 B | n/a | GPU | n/a |

**ARC** checkpoints are post-trained for 8-step inference (`cfg_scale=1`). **RF** checkpoints are rectified-flow bases used as LoRA training starting points (`cfg_scale=7`, ~50 steps at inference). ARC and RF checkpoints each bundle the autoencoder. Standalone SAME checkpoints share weights with the bundled versions and reuse the cached full checkpoint when available.

---

## theDAW Feature Summary

### MAKE generation
- One form covers text-to-audio, audio-to-audio, inpainting, and continuation. The model selector adjusts steps and CFG for RF variants on its own, and you set duration, batch size, sampler steps, CFG scale, the seed with one-click reroll, and the initial noise level for variation passes.
- The **Chimera** stack accepts several source clips and blends them into one generation. It beat aligns every clip to a target tempo (auto or fixed), and the align mode sets how they line up: **Start**, **Downbeat**, or **Phrase Weave**. Phrase Weave interleaves the clips bar by bar up to a polyphony you choose, so separate ideas merge into one take.
- **Inpainting** runs on a WaveSurfer preview where you drag a region to mark the window for regeneration. Mask coordinates resolve against the visible clip region, so trimmed and split clips map correctly.
- The Advanced Generation Panel holds output settings for automatic playback and download, and Quick Actions route a finished render to the waveform editor, the init-audio slot, or the inpainting module.
- The Templates Panel stores and restores full parameter sets, and the Saved Prompts dropdown keeps a history of your prompts. The magic-prompt button fills an empty field with a starting prompt, and the sparkles icon sends your text to the assistant for prompt optimization.
- The Spectrogram Viewer renders Mel, STFT, Chromagram, and CQT views of a render.
- The job queue runs asynchronously. You submit, the client polls `/api/jobs/{id}` once a second until completion, and a binary abort stops a run mid-flight. Every finished render saves to the library with its full metadata.

### EDIT multi-track editor
- The timeline holds many tracks. Each clip points at a source audio Blob, and its waveform peaks compute through `AudioContext.decodeAudioData` (240 normalized bins) and cache per clip.
- **Move** drags clips along the timeline and between tracks, and **Cut** splits a clip at any point while keeping source alignment through `offsetIntoSource`. The snap grid offers Off, 1/4, 1/8, and 1/16 divisions against the editor BPM, and zoom spans 5 to 400 px/s with horizontal scroll that follows it.
- Each track carries an editable name, mute, exclusive solo, volume, pan, and removal. The **live mixer** applies these track faders, pan, mute, and solo during playback, so a balance change sounds the moment you make it.
- Each clip exposes left and right trim handles, where the left handle keeps source content aligned by moving `startSec` and `offsetIntoSource` together, plus fade-in and fade-out handles that set linear envelope durations.
- **Inpaint from editor** lets you draw a region on any clip and open the inpaint panel for prompt, steps, and seed. The visible region crops and travels to the backend, and the returned audio replaces the clip's source Blob or drops away.
- **Commit Edit** renders the audible tracks into one 44.1 kHz stereo WAV through `OfflineAudioContext`, applying fades, per-track volume, and stereo pan in the render. The result saves to the library and downloads, and the mixdown name field sets the filename with a fallback of `mixdown_<id>.wav`.
- The status bar shows live timecode, clip and track counts, and the selected clip's bounds. **Preview** plays the selected clip through the shared engine, and the Player Footer takes over transport after the first render.

### MIX studio effects
- A processing chain of twenty-four FFmpeg effects covers a mastering chain, compression, highpass and lowpass filters, volume, tempo, vocal processing, lo-fi vinyl, stereo widening, reverb and delay, a sub exciter, phase isolation, parametric mid EQ, loudness normalization to LUFS, pitch shift, echo, fade, declick, silence removal, denoise, and export to FLAC, MP3, AAC, and Opus.
- Four macro sliders (Drive, Width, Air, Punch) map onto the active effect's parameters.
- Process history keeps the last eight runs, and any prior output promotes back to the current source for another pass.

### DJ performance console
- Two decks run from a pro layout with jog wheels, a central mixer, scrolling waveform overviews, and a track browser. Each deck loads from the library, a saved set, or an online import.
- The engine handles beatmatch **sync** with octave-aware tempo matching and beat-phase alignment, a continuous sync-lock, **key-lock** that holds pitch while tempo moves, a 3-band EQ, a single-knob filter, and channel trim with auto-gain toward a target level.
- Performance controls cover four persistent hotcues, beat loops, momentary loop rolls, slip mode, and beat jumps, and quantize snaps them to the beat grid.
- The **FX rack** adds a flanger, a reverb built on a generated impulse response, and a resonant wah per deck, and a master limiter sits on the DJ bus.
- **Live stems** split a loaded track into separated parts you ride on per-stem faders while the deck plays in lock-step.
- **Cue output** pre-listens a deck through a headphone device chosen with `setSinkId`, independent of the crossfader.
- **Automix** sequences the active set across both decks on its own, beatmatching and crossfading each transition. A ten-pad **sampler bank** fires one-shots through the DJ master, and a **Next** staging lane holds the tracks you queue to play next.
- **Design Mode** turns the whole console into a layout you arrange by hand. You drag the borders to resize regions, drag panels to reorder them, and drag the mixer's own control groups into position. The arrangement persists, and a copy action exports it.

### VJ visual engine
- A 3D reactive visualizer renders a glowing spectrogram terrain with bloom, particles, fog, and shader effects, and several camera flight modes and color themes shape the look.
- It takes its signal from the session audio, a microphone, or MIDI, and it receives a set sent over from the DJ tab.
- The visualizer runs inside theDAW and pops out into its own floating window for a second screen.

### TRAIN LoRA
- Eight adapter types are available: `lora`, `dora-rows`, `dora-cols`, `bora`, `lora-xs`, `dora-rows-xs`, `dora-cols-xs`, and `bora-xs`.
- Layer filtering runs through `--include` and `--exclude` with bracket-range expansion such as `layers[0-11]`.
- Inference exposes runtime strength, per-LoRA interval gating that activates an adapter within a sigma range, and a per-LoRA layer filter. Adapters stack additively and each stays independently configurable.
- Pre-computed SVD bases (`--svd_bases_path`) speed startup for the `-XS` variants, and `--base_precision bf16` lowers VRAM use.
- Some training endpoints return HTTP 501 today, and the frontend reads that status and shows a specific message for it.

### LEARN genealogy graph
- The LEARN tab renders every track and the relationships between them as an interactive force-directed graph in 3D and 2D.
- Edges trace how a piece descended from its sources, so a remix, an inpaint, a stem split, and a chimera blend each show their parentage.
- You fly the camera through the graph, focus a node, and open any track straight from its node.

### Library
- The library lives on the backend. Audio files sit on disk, metadata sits in `data/library.db`, and the frontend talks to it over `/api/library/*`. The list loads as soon as the backend reports ready.
- Every render saves automatically with its prompt, model, duration, steps, CFG, seed, MIME type, and timestamp.
- List and grid views, full-text search across title, prompt, model, tags, and notes, a favorites filter, and sorting by newest, duration, or title organize the collection.
- Each row plays inline through the shared engine and offers download, delete, a favorite star, and a send-to-editor action. The details panel shows the full metadata table with audition, send-to-editor, and download.

### Bottom panel tools
- **Spectral analyzer** displays oscilloscope, spectrum, and radial modes, with live RMS and peak dB meters, a LIVE indicator above -60 dBFS, the context sample rate and FFT size, and a fullscreen toggle. It reads the shared analyser node, so every source reaches it.
- **Piano roll** edits MIDI-style notes on a chromatic keyboard and a quantized grid, plays through the shared engine, imports and exports MIDI, and renders its pattern into the editor as a clip that reopens for further editing.
- **Step sequencer** runs a 16-step drum machine at 40 to 240 BPM with five synthesized voices (kick, snare, hat, tone, noise), per-track voice selection and volume, random fill, clear, and a render-to-editor action.
- **Media bucket** holds dropped or uploaded audio for the session in WAV, MP3, FLAC, OGG, AAC, M4A, and Opus, and sends an item to the editor or the library.
- **SLIDE** presents a glass control surface of faders and knobs that drive parameters and sync with the VJ engine and the audio.
- **Details** shows the selected library entry's metadata and actions.

### MIDI controller mapping
- A controller recognition system identifies your hardware across three tiers: a library of roughly 110 device profiles, a scored auto-detect that matches an unknown rig to the closest profile, and a learn-by-capture mode that binds any control the moment you move it, even on a 92-control board.
- The DJ tab maps CC and note messages to deck, mixer, and hotcue actions through its own action-based map. You arm an action and move a control to bind it.
- A photo-driven layout inference that reads a controller's shape from an image is planned.

### Player footer
- The footer stays at the bottom across every tab. It shows the current title, a model or status chip, and total duration.
- Transport offers play and pause, skip to start, skip to end, and a loop toggle, and it drives the shared player or hands off to the active editor timeline.
- The progress bar seeks on click and reveals a scrubber on hover, and it stays in sync with the waveform editor while the editor is the active source. A volume slider and mute drive the shared master gain, and a download button retrieves the loaded entry.

### Processing log
- A ring buffer holds up to 500 entries and auto-scrolls to the newest. Sources span system, health, generate, training, studio, sequencer, and library, and each line carries an info, warn, error, or debug level with its own color.
- Download exports the buffer to a timestamped `.txt`, clear empties it, and the header bar collapses and expands the panel.

### Assistant
- A collapsible orb panel streams chat completions from any configured provider: Claude Code over the CLI, Google Gemini, Anthropic, OpenAI, xAI Grok, Groq, OpenRouter, Ollama, LM Studio, llama.cpp, and vLLM.
- Provider and model selection pulls live model lists from each provider, and a key pool holds several keys per provider for load distribution and failover, hashed for display.
- USER_GUIDE.md indexes at startup through ChromaDB and sentence-transformers, and the relevant sections feed the system prompt each turn. `/api/assistant/reindex` forces a rebuild. Responses stream over SSE from `POST /api/assistant/chat`, and audio and image attachments reach the providers that accept them as base64 blocks.

---

## Python API

### LoRA at inference

```python
pipe = StableAudioModel.from_pretrained("medium")
pipe.load_lora("style.safetensors", weight=0.8)
audio = pipe.generate(prompt="...", duration=30)
```

Multiple LoRAs stack additively; weights are adjustable at runtime via `set_lora_strength(model, 0.5, lora_index=0)`. See [docs/workflows/lora.md](docs/workflows/lora.md) for the full adapter-type and layer-filter reference.

### Advanced generation parameters

```python
audio = pipe.generate(
    prompt="...",
    duration=30,
    sampler_type="dpmpp_2m_sde",  # euler | rk4 | dpmpp_2m_sde | ping_pong
    apg_scale=1.0,                # Adaptive Projected Guidance
    cfg_interval=(0.0, 1.0),      # apply CFG only within this sigma range
    sigma_max=1.0,                # max noise level (partial trajectories)
)
```

---

## Documentation Index

| Document | Contents |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | The complete manual covering every feature, control, and endpoint, rendered in-app by the Docs button. |
| [docs/workflows/inference.md](docs/workflows/inference.md) | Inference-mode reference (upstream). |
| [docs/workflows/lora.md](docs/workflows/lora.md) | LoRA adapter types, training configuration, layer filtering, multi-LoRA inference. |
| [docs/workflows/autoencoder.md](docs/workflows/autoencoder.md) | Standalone SAME autoencoder usage, batch encoding, dataset pre-encoding. |
| [docs/guides/prompting.md](docs/guides/prompting.md) | Prompt structure, conditioning signals, style reference. |
| [docs/guides/model-overview.md](docs/guides/model-overview.md) | Architecture design and model comparison. |
| [docs/windows/setup-guide.md](docs/windows/setup-guide.md) | Full Windows installation walkthrough (CUDA, Flash Attention, soundfile). |
| [docs/windows/troubleshooting.md](docs/windows/troubleshooting.md) | Windows-specific issue resolution. |

---

## Troubleshooting

**Static glitch output (Medium model)**
Flash Attention is not correctly installed. Verify:
```bash
uv run python -c "import flash_attn; from flash_attn import flash_attn_func; print(flash_attn.__version__)"
```
Reinstall with a wheel matching your Python + torch + CUDA version combination from [kingbri1/flash-attention](https://github.com/kingbri1/flash-attention/releases).

**"API UNREACHABLE" banner in the UI**
The backend is not listening on port 8600. Test directly:
```bash
curl http://localhost:8600/api/health
```
On Windows, `.\start-dev.bat` kills stale processes automatically. Manually: `taskkill /F /IM uvicorn.exe`.

**Out-of-memory on Medium model**
The Medium pipeline requires approximately 8 GB VRAM. Workarounds: use `small`, reduce `duration`, or ensure no competing CUDA processes are active. The Small model runs on more modest GPUs.

**Library entries slow to load or failing to save**
The library is served by the backend from `data/library.db` and the audio files under `data/`. Confirm the backend is running on port 8600 (the list loads once it reports ready), and free disk space if writes begin to fail.

---

## License

Commercial use of these models is governed by the [Stability AI Community License](https://stability.ai/license).
