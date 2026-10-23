# Changelog

## 8.1.5

- Cache WebGL uniform values by location and skip repeat uploads when a value is unchanged.
- Reset the uniform cache whenever a renderer is initialized or torn down, and ignore optimized-out uniform locations safely.
- Add regression checks for uniform caching and the existing WebGL1/analysis-buffer hot-path optimizations.
- Browser runtime profiling remains required before claiming measured FPS or latency gains.

## 8.1.4

- Cache render parameters across frames in WebGL1 and Canvas 2D fallback paths.
- Reuse WebGL1 video texture storage and selectively upload color controls.
- Reuse scene-analysis staging buffers to reduce per-sample allocations.
