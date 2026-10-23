# ZINZ / VELVET 8.1.6 — YouTube + YouTube Music

## What's new in 8.1.0

- **Dedicated full-page Color Studio:** the native color pickers no longer live in the browser-action popup. The editor opens in a normal extension tab, so picking a color won't close the small popup or interrupt editing.
- **Two separate color menus:** one for YouTube and one for YouTube Music. YouTube includes the VELVET base palette plus independent page, title, general text, metadata, comment, link, accent, and progress colors. Music has its own background, surface, panel, text, track title, metadata, link, accent, progress, and lyrics colors.
- **Named color palettes:** save any combination of YouTube and Music colors under a name, apply it later, and export/import it as a small JSON file without overwriting effects or layout settings.
- **Complete setup profiles:** named profiles and JSON import/export include active effects and values, effect presets, targeted spectrum adjustments, Material Depth preset/settings, renderer and adaptive-lighting settings, Auto Color, YouTube layout settings, YouTube Music layout settings, and saved color palettes.
- **Preset and reset controls:** built-in color looks include VELVET, OLED Black, Ocean Glow, Warm Ember, Forest Glass, and Paper Light. The original base-theme choices remain available.
- **Single-screen popup:** the tab strip and effect/renderer tabs have been removed. The compact dashboard focuses on appearance, accent colors, and quick access to YouTube customization. Detailed YouTube layout controls are tucked into an optional expandable section; the full-page Color Studio remains available.
- **Automatic saving:** valid hex edits and color picker changes save immediately to extension storage and update matching open YouTube/YouTube Music tabs via their storage listeners.

## Install / update

1. Download and extract this ZIP.
2. In Zen, open the extensions manager and reload the unpacked extension folder containing `manifest.json`. If updating an existing unpacked install, use the same folder or replace it with this extracted version.
3. Open the ZINZ / VELVET popup. Use **Open YouTube Color Studio** or **Open Music Color Studio** to open the full editor. The editor is also configured as the extension's options page.
4. Refresh existing YouTube and YouTube Music tabs once after updating.

## Sharing settings

- Choose a name under **Complete setup profiles** and press **Save setup**. Use **Export current** or **Export selected** to create a shareable `*.json` file.
- On another installation, open Color Studio and use **Import setup**. Import applies the complete configuration, including video effects and presets.
- To share colors only, save a named entry under **Named color palettes** and use **Export palette**. Importing a color palette updates color fields but leaves effects and layout settings unchanged.

## Compatibility

Color editing and profile files are handled by this extension's page, not by the browser popup. Some visibility/layout selectors depend on YouTube's current DOM and experiments. DRM-protected video may prevent pixel-based enhancement, independent of profile saving.


## Developer checks

- Run the dependency-free scene-analysis regression tests with `node tests/analysis.test.js`.
- Validate JavaScript syntax with `node --check` for each `.js` file.
- Validate `manifest.json` as JSON before loading the unpacked extension.

The scene-analysis pipeline now skips malformed or incomplete frame readbacks rather than allowing invalid dimensions or short buffers to inject non-finite values into temporal scene state. Valid frames continue processing normally.

## What's improved in 8.1.2

- **Safer scene analysis:** malformed frames containing non-finite channel values are rejected atomically.
- **Resolution-change handling:** motion history is reset when frame dimensions change, preventing invalid comparisons between different-sized thumbnails.
- **Regression coverage:** tests now cover malformed frame rejection, recovery, and resized frames.
- **Engineering handoff:** `ENGINEERING-HANDOFF.md` records implemented changes, checks, limitations, and the next focused upgrade steps.


## What's new in 8.1.5

- Route ordinary brightness, contrast, and saturation through native video filters instead of requiring the custom WebGL renderer.
- Use the CPU color backend for selective-color controls, including all 50 fine-spectrum targets plus skin and earth masks.
- Prefilter pixels far from active hue bands before precise OKLab grading to reduce unnecessary per-pixel work.
- Reserve WebGL for optional Material Depth rendering when enabled; color controls alone no longer force it back on.
- Performance and visual quality still need a live Zen/YouTube benchmark; the 60 FPS target is not claimed as guaranteed.

- Cache unchanged WebGL uniform values per linked program, skipping redundant JavaScript-to-driver uniform updates while preserving per-program state.
- Retain the 8.1.4 hot-path improvements: reusable WebGL1 texture storage and selective-color control buffers, cached frame parameters, and reusable scene-analysis staging buffers.
- Add a dependency-free performance regression test for the render-path optimizations.
- Browser GPU/CPU performance still needs measurement in Zen; no FPS gain is claimed without a live benchmark.


## What's new in 8.1.6

- Replace the multi-tab popup with a single-screen appearance dashboard and expandable advanced layout controls.
- Keep the existing YouTube Color Studio and underlying video-enhancement modules available without putting their controls in the popup.
- Refine YouTube spacing, thumbnail framing, search focus, navigation highlights, and watch-page surfaces for a more cohesive VELVET look.
- Make popup control wiring tolerate removed optional controls so the simplified interface does not throw missing-element errors.
