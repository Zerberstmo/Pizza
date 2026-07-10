# ADR-0001 — Mobile-App via Capacitor

- **Status:** akzeptiert
- **Datum:** 2026-07-09

## Problem

Die Bestell-App soll später als native iOS-/Android-App (QR-Scan, Push, Store-Auslieferung)
verfügbar sein, ohne die React-Codebasis zu duplizieren.

## Mögliche Lösungen

1. Capacitor (Web-Code in nativen Wrapper, Plugin-Bridge)
2. React Native (separate Codebasis)
3. Reine PWA (kein Store, eingeschränkte native APIs)

## Entscheidung

Capacitor (Teil-C).

## Begründung

Die bestehende Vite/React-App wird 1:1 weiterverwendet; native Fähigkeiten (Kamera/QR, Push,
Icons/Splash) kommen über Capacitor-Plugins. Kein Rewrite, ein Code für Web + Mobile.

## Vor- und Nachteile

- ➕ Wiederverwendung der kompletten Web-Codebasis
- ➕ Store-Fähigkeit + native Plugins
- ➖ Zusätzliche Build-/Signing-Kette (Xcode/Android Studio)

## Auswirkungen

Teil-C: Capacitor-Integration, QR/Push, Icons/Splash, Store-Setup. Frontend bleibt unverändert.

## Alternativen

React Native verworfen (Rewrite). Reine PWA verworfen (keine Store-Distribution, schwächere native APIs).
