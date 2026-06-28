# Marathon Analysis Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current SuperMap WMS map MVP into a competition-ready route decision cockpit by adding service-point overlays, layer controls, route analysis explanations, and richer export content.

**Architecture:** Keep the existing React + SuperMap iServer WMS frontend. Add small typed domain modules for support points and analysis, then pass those results into map layers and side panels. No backend is added in this phase.

**Tech Stack:** React, TypeScript, Vite, Vitest, Leaflet, SuperMap iServer WMS.

---

## Tasks

- [x] Add failing tests for support point loading and route analysis summaries.
- [x] Add typed support point data helpers backed by the published Wuhan marathon GeoJSON dataset.
- [x] Add route analysis helpers that convert scores and support-point coverage into judge-friendly explanations.
- [x] Add a Leaflet support-point layer with stable styles and readable labels.
- [x] Extend the map engine and React map wrapper to render support points and toggle route/support layers.
- [x] Add a layer control panel and route analysis panel to the right sidebar.
- [x] Upgrade the export panel so the copied report includes SuperMap service evidence, support coverage, and recommendation reasoning.
- [x] Verify with tests, production build, iServer WMS checks, and a browser screenshot.

## Notes

- The published service remains `map-wuhan-marathon`; the frontend should keep using the real WMS service rather than falling back to a static drawing.
- Keep all new logic local and testable. The iServer spatial analysis API can be a later enhancement after this interface is stable.
