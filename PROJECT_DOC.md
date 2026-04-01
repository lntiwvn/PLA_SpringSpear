# Base Project - Project Documentation

## Tổng quan

Game playable ad dạng HTML5 được xây dựng trên **Cocos Creator 3.8.7**, sử dụng TypeScript. 

- **Platform**: Web Mobile (HTML5)
- **Resolution**: 1080x1920 (portrait)
- **Engine**: Cocos Creator 3.8.7
- **Animation**: Spine 4.2

---

## Cấu trúc dự án

```
SpringSpearPLA/
├── assets/
│   ├── Src/                    # Game logic scripts (5 files)
│   ├── Asset/                  # Art & animation assets
│   ├── Scene/
│   │   └── MainScene.scene     # Scene chính duy nhất
│   ├── constant/
│   │   └── constant.ts         # Store links, audio/effect name constants
│   ├── EventTracking/          # Google Analytics tracking
│   │   ├── EventMap.ts         # Event enum
│   │   ├── TrackingWrapper.ts  # GA wrapper
│   │   └── global.d.ts         # Global type definitions
│   ├── resources/
│   │   └── audio/sound/        # Audio files (bgm, sfx)
│   └── PLAGameFoundation/      # Framework core (không sửa)
│       ├── assetsManager/      # Async asset loader
│       ├── gameControl/
│       │   ├── core/           # Abstract collision checker, touch listener
│       │   └── utilities/
│       │       ├── framework/  # AudioManager, EffectManager, PoolManager, ResourceUtil
│       │       ├── handler/    # Platform detection, game end handler
│       │       └── super_html/ # HTML5 playable integration
│       └── ui/                 # UI system (BaseView, BaseScreen, BasePopup, UIManager)
├── build-templates/
│   └── web-mobile/             # HTML template, GA tracking scripts
├── settings/v2/packages/       # Engine & project config
└── profiles/v2/                # Editor profiles
```

---
## SpringSpearPLA

## Game Scripts (assets/Src/)

### 1. GameBoard.ts
Quản lý vùng chơi (board) - hình chữ nhật dựa trên UITransform.

**Properties tính toán:**
- `minX`, `maxX`, `minY`, `maxY` - biên board
- `width`, `height` - kích thước

**Methods:**
- `containsPoint(pos)` - kiểm tra điểm nằm trong board
- `clampPoint(pos)` - giới hạn điểm trong board
- `raycastToEdge(origin, direction)` - tìm giao điểm ray với cạnh board

### 2. Spear.ts
Điều khiển giáo: ghim, ngắm, bắn, bay, va chạm.

**States:** `IDLE` → `CHARGING` → `FLYING` → `IDLE`

**Inspector Properties:**
| Property | Type | Default | Mô tả |
|---|---|---|---|
| spearLength | number | 200 | Chiều dài giáo (pixel) |
| flySpeed | number | 1500 | Tốc độ bay (pixel/s) |
| minAngleFromEdge | number | 25 | Góc tối thiểu so với cạnh board (độ) |
| chargePreviewTime | number | 0.2 | Thời gian preview compress (giây) |

**Spine Animations:**
- `IDle2` - trạng thái ghim trên cạnh (IDLE)
- `IDle` - trạng thái đang ngắm (CHARGING, hold)
- `Compress` - nén lò xo trước khi bắn (release)

**Cơ chế hoạt động:**
- Anchor ở tail (bottom) của sprite → `node.position` = vị trí đầu ghim (pinned end)
- Đầu tự do (free end) = pinned + localUp * spearLength
- Khi bay chạm cạnh board: flip 180°, đầu tự do thành đầu ghim mới
- Hướng bắn được clamp để góc so với cạnh >= minAngleFromEdge

**Flow input:**
1. `startCharge(touchPos)` - TOUCH_START: chuyển CHARGING, play anim `IDle`, bắt đầu xoay
2. `aimAt(touchPos)` - TOUCH_MOVE: xoay giáo theo ngón tay (kim đồng hồ, neo tại pinned point)
3. `release()` - TOUCH_END: play anim `Compress` full → bắn theo hướng đang chỉ

**Va chạm:**
- `checkCollisionWithCircle(center, radius)` - kiểm tra line segment (giáo) với circle (enemy)
- Dùng khoảng cách point-to-segment, không dùng physics engine

### 3. CollisionZone.ts
Component gắn vào node rỗng làm collision marker. Cho phép kéo thả node trong Editor để kiểm soát vùng va chạm trực quan.

**Inspector Properties:**
| Property | Type | Default | Mô tả |
|---|---|---|---|
| radius | number | 30 | Bán kính vùng va chạm |

**Methods:**
- `getBoardPos2D()` - tính vị trí board-space (parent.pos + local.pos)

### 4. Enemy.ts
Điều khiển enemy: bob lên xuống, rơi khi mất balloon, chẻ đôi khi bị bắn.

**Inspector Properties:**
| Property | Type | Default | Mô tả |
|---|---|---|---|
| enemyVisualNode | Node | null | Node chứa visual enemy (character spine) |
| balloonNode | Node | null | Node chứa balloon |
| bodyZone | CollisionZone | null | Vùng va chạm body |
| balloonZone | CollisionZone | null | Vùng va chạm balloon |
| splitLeftNode | Node | null | Nửa trái khi chẻ (mặc định ẩn) |
| splitRightNode | Node | null | Nửa phải khi chẻ (mặc định ẩn) |
| bobAmplitude | number | 50 | Biên độ bob lên xuống (pixel) |
| bobSpeed | number | 3 | Tốc độ bob (rad/s) |
| fallGravity | number | 1500 | Gia tốc rơi (pixel/s²) |
| splitSpeedX | number | 300 | Tốc độ văng ngang 2 mảnh (pixel/s) |
| splitSpeedY | number | 400 | Tốc độ bay lên 2 mảnh (pixel/s) |

**Cấu trúc node trong Editor:**
```
Enemy (node cha, bob lên xuống)
├── EnemyVisual (character spine animation)
├── Balloon (sprite bóng bay)
├── BodyZone (node rỗng + CollisionZone)
├── BalloonZone (node rỗng + CollisionZone)
├── SplitLeft (nửa trái, mặc định inactive)
└── SplitRight (nửa phải, mặc định inactive)
```

**Các trạng thái:**
- **Bobbing** - bay lên xuống theo sin wave quanh `_baseY`
- **Falling** - balloon bị phá → rơi xuống, chạm đáy board (`minY`) thì dừng, vẫn sống
- **Split** - body bị bắn → ẩn visual/balloon/zones, 2 mảnh reparent sang board node, văng parabol 2 bên, chạm đáy dừng

**Hit behaviors:**
- `hitBalloon()` - balloon biến mất, balloonZone tắt, dừng bob, bắt đầu rơi. Enemy chạm đáy board vẫn sống (có thể bị bắn tiếp).
- `hitBody()` - isDead = true, ẩn tất cả visual/zones, reparent 2 mảnh split sang board node tại vị trí enemy hiện tại, 2 mảnh bay parabol rồi rơi xuống đáy board dừng lại.

### 5. GameControl.ts
Orchestrator: khởi tạo game, xử lý input, check collision mỗi frame.

**Inspector Properties:**
| Property | Type | Mô tả |
|---|---|---|
| gameBoard | GameBoard | Reference đến board |
| spear | Spear | Reference đến spear |
| enemies | Enemy[] | Danh sách enemies |

**Khởi tạo (start):**
1. Init spear với board
2. Init tất cả enemies với board
3. Ghim spear ở giữa cạnh dưới board, hướng lên
4. Đăng ký TOUCH_START, TOUCH_MOVE, TOUCH_END, TOUCH_CANCEL

**Input handling:**
- TOUCH_START → `spear.startCharge(touchLocal)` (nếu IDLE)
- TOUCH_MOVE → `spear.aimAt(touchLocal)` (nếu CHARGING)
- TOUCH_END / CANCEL → `spear.release()` (nếu CHARGING)

**Collision check (update, mỗi frame khi spear FLYING):**
1. Duyệt từng enemy chưa chết
2. Check bodyZone trước → `enemy.hitBody()`
3. Check balloonZone (nếu active) → `enemy.hitBalloon()`

---

## Scene Setup (MainScene)

### Node hierarchy
```
Canvas
└── Wall (GameBoard - UITransform 940x1670)
    ├── Background (sprite)
    ├── Spear (Spear component)
    │   └── Spear_New (Spine Skeleton - "IDle2")
    ├── Enemy (Enemy component)
    │   ├── Character (Spine Skeleton - "idle_fly")
    │   ├── Balloon (sprite)
    │   ├── BodyZone (CollisionZone)
    │   ├── BalloonZone (CollisionZone)
    │   ├── SplitLeft (inactive)
    │   └── SplitRight (inactive)
    └── GameControl (GameControl component)
```

---

## PLAGameFoundation Framework (không sửa)

Framework base cho playable ads, cung cấp:

| Module | Mô tả |
|---|---|
| **GameManager** | Singleton quản lý AudioManager, EffectManager, persist nodes |
| **AudioManager** | Play/stop music & SFX, volume control |
| **EffectManager** | Play particle/animation effects với recycling |
| **PoolManager** | Object pooling |
| **ResourceUtil** | Resource loading utilities |
| **UIManager** | Quản lý Screen/Popup views (show/hide, lazy load, cache) |
| **BaseView/BaseScreen/BasePopup** | Abstract base classes cho UI |
| **RootUICanvas** | Root canvas với 3 layer: screen, popup, hidden |
| **AssetsManager** | Async prefab loader |
| **ColliderChecker** | Abstract 2D collision handler (Box2D) |
| **TouchListener** | Abstract touch input handler |
| **DetectPlatform** | iOS/Android detection |
| **GameEndHandler** | Game end → redirect to store |
| **SuperHTML** | HTML5 playable ad integration |

---

## Event Tracking

Google Analytics integration cho playable ad metrics.

**GA ID:** G-NY24GPNB62

**Events (EventMap.ts):**
| Event | Mô tả |
|---|---|
| INFO | Game loaded |
| STARTING | Game started |
| IMPRESSION | Ad impression |
| ERROR | Error occurred |
| ENGAGEMENT | User interaction |
| CTA | Call to action clicked |
| PLACE_ITEM | Item placed |
| NEXT_LEVEL | Level completed |

---

## Build & Deploy

- **Build template**: `build-templates/web-mobile/`
- **HTML entry**: `index.ejs` → injects tracking scripts + canvas
- **Tracking**: `tracking.js` + `gtag_fix_G-NY24GPNB62.js`
- **Output**: Single HTML5 playable ad file
- **Texture compression**: PNG quality 10

---

## Constants (constant.ts)

```typescript
STORE_LINK.ANDROID_LINK = 'https://play.google.com/store/apps/details?id=com.spear.throwing.aim.hit'
STORE_LINK.IOS_LINK = 'https://apps.apple.com/'
```
