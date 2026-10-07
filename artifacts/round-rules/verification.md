# Round rules verification

The HUD and lose popup are serialized scene nodes in `assets/Scene/Update.scene`. UI assets are in `assets/Asset/GameplayUI`.

- Each level allows five player throw gestures. x10 clones share the same gesture.
- Loss is evaluated after every spear from throw five finishes. Victory/store CTA takes precedence on the final throw.
- Level one requires both green enemies to die before level two activates.
- Level two starts with five fresh throws and invokes the existing AdsComp game_end/download adapter at three distinct kills.
- Retry restores the failed level with fresh enemies, spear pose, cloner usage and throw count.

Validation: TypeScript source check and temporary regression harness pass. Manual preview verified five-shot loss, first-level Retry, first-level victory, level-two reset and exactly one game_end/download call at 3/3. Final layout and full-screen scrim are also checked in preview.

Local preview has no advertising platform SDK, so store routing is verified through the existing adapter calls. The configured Google Play URL remains the existing game URL.
