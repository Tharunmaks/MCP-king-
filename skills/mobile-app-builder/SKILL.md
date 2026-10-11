---
name: mobile-app-builder
description: Use when building a mobile app or mobile-friendly web app (React Native, Expo, Flutter, SwiftUI, Kotlin/Compose, PWA).
---

# Mobile App Builder

- Follow platform conventions: iOS Human Interface Guidelines, Android Material 3. Bottom tab bar for 3-5 top-level sections.
- Tap targets >= 44pt (iOS) / 48dp (Android). Respect safe areas (notch, home indicator) and the keyboard.
- Support dark mode and dynamic/large text sizes from day one.
- Offline-friendly: cache last data, show clear offline states, retry with backoff.
- Lists: virtualised (FlatList / ListView.builder / LazyColumn), images sized and cached.
- Forms: correct keyboard types, autofill hints, inline validation.
- Test on a small phone (360x640) and a large one. Measure startup time.

Helpful MCP servers: `mobile-mcp` (drive iOS/Android simulators and real devices), `XcodeBuildMCP` (build/run iOS), Dart/Flutter MCP (`dart mcp-server`), Expo MCP.
