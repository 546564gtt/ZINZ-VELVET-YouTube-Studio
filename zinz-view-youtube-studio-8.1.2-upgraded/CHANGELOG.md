# Changelog

## 8.1.6

- Replace the six-tab popup with a compact, single-screen UI dashboard focused on YouTube appearance.
- Move detailed YouTube layout settings into an optional expandable section; retain the separate full-page Color Studio.
- Refine YouTube feed spacing, thumbnails, search focus, navigation highlights, and watch-page card styling.
- Make popup event wiring safe when optional controls are not present.


## 8.1.5

- Route ordinary brightness, contrast, and saturation through native video filters rather than forcing the custom WebGL renderer.
- Route selective color grading through the non-WebGL CPU color backend when pixel-level controls are active; reserve WebGL for the optional Material Depth path.
- Extend the CPU backend to evaluate all 50 fine-spectrum targets alongside the 24 named targets and dedicated skin/earth masks.
- Add a regression test covering all 50 fine-spectrum hue targets in CPU mode.

- Cache WebGL uniform values by location and skip repeat uploads when a value is unchanged.
- Reset the uniform cache whenever a renderer is initialized or torn down, and ignore optimized-out uniform locations safely.
- Add regression checks for uniform caching and the existing WebGL1/analysis-buffer hot-path optimizations.
- Browser runtime profiling remains required before claiming measured FPS or latency gains.

## 8.1.4

- Cache render parameters across frames in WebGL1 and Canvas 2D fallback paths.
- Reuse WebGL1 video texture storage and selectively upload color controls.
- Reuse scene-analysis staging buffers to reduce per-sample allocations.
