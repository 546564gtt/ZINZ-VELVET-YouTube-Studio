# ZINZ / VELVET 8.1.2 — YouTube + YouTube Music

## What's new in 8.1.0

- **Dedicated full-page Color Studio:** the native color pickers no longer live in the browser-action popup. The editor opens in a normal extension tab, so picking a color won't close the small popup or interrupt editing.
- **Two separate color menus:** one for YouTube and one for YouTube Music. YouTube includes the VELVET base palette plus independent page, title, general text, metadata, comment, link, accent, and progress colors. Music has its own background, surface, panel, text, track title, metadata, link, accent, progress, and lyrics colors.
- **Named color palettes:** save any combination of YouTube and Music colors under a name, apply it later, and export/import it as a small JSON file without overwriting effects or layout settings.
- **Complete setup profiles:** named profiles and JSON import/export include active effects and values, effect presets, targeted spectrum adjustments, Material Depth preset/settings, renderer and adaptive-lighting settings, Auto Color, YouTube layout settings, YouTube Music layout settings, and saved color palettes.
- **Preset and reset controls:** built-in color looks include VELVET, OLED Black, Ocean Glow, Warm Ember, Forest Glass, and Paper Light. The original base-theme choices remain available.
- **Everyday controls stay in the small popup:** effect sliders, renderer controls, Material Depth, visibility, scrolling, layout, Music behavior, and other non-color settings are still in the browser-action popup.
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
