# Panzer：SPX 坦克守城

这是使用 **XGo + SPX** 编写的 2D 网格坦克防守游戏源码，面向 GoPlus XBuilder。


## 游戏规则

- 战场逻辑尺寸为 20×30 格，每格对应 12 个舞台坐标单位。
- 方向键控制可移动的玩家坦克，坦克移动方向就是攻击方向。
- 按 `X` 发射当前武器，默认机炮也会按冷却自动开火。
- 独立基地保留为被保护目标，玩家坦克负责拦截敌军。
- 敌军按固定车道组成车队，首辆坦克被击毁后，后方第一辆坦克自动补位成为首车。
- 当前路线采用直线路径和转向追踪，不使用 S 型路线。
- 地图中的钢制和木箱障碍都可以被玩家炮弹摧毁，敌方坦克和敌方炮弹不能摧毁障碍。
- 敌我炮弹相撞时会互相抵消。
- 每 30 秒随机投放保护罩、镭射炮或地雷。
- 道具 10 秒未拾取会自动消失，最后 3 秒会闪烁。
- 保护罩可以抵挡 3 次攻击。
- 镭射炮会消灭射线方向上的所有敌军。
- 踩中地雷损失 1 点生命值。
- 基地或玩家生命归零后游戏结束，点击舞台或按 `Enter` 重新开始。

## 源码结构

```text
main.spx          舞台：全局状态、地图、计分、波次、生成和重开
Player.spx        玩家：网格移动、方向和自动攻击
Base.spx          基地：位置、受击和失败提示
Enemy.spx         敌军：车队槽位、首车补位、基地追踪和攻击
PlayerBullet.spx  玩家炮弹：移动、碰撞、消灭敌军和木箱
EnemyBullet.spx   敌军炮弹：移动、攻击玩家和基地
Item.spx          道具：随机类型、拾取效果和 10 秒生命周期
Steel.spx         可被玩家炮弹摧毁的钢制障碍模板
Crate.spx         可摧毁木箱模板
assets/           舞台背景与角色造型 SVG
```

## 直接导入 XBuilder

仓库根目录中的 `TANK-black-jack.xbp` 是可直接导入的 XBuilder 项目文件：

1. 打开现有的 `TANK-black-jack` 项目。
2. 鼠标移到左上角的文件图标。
3. 选择“导入项目文件...”，并确认覆盖当前项目内容。
4. 选择 `TANK-black-jack.xbp`，导入完成后点击运行。

导入前如需保留当前内容，请先在同一菜单中选择“导出项目文件”。

修改源码或素材后，可在仓库目录运行以下命令重新生成项目包：

```bash
node scripts/build-xbp.mjs
```

方向、射击节奏和背景配置可通过以下命令检查：

```bash
node scripts/verify-game.mjs
```

## 手工创建项目

1. 新建一个 SPX 游戏项目。
2. 将舞台背景设为 `assets/backdrop.svg`。
3. 把 `main.spx` 内容放入舞台代码。
4. 创建下表中的 Sprite，名称必须完全一致。
5. 上传对应 SVG 作为造型，再把同名 `.spx` 文件内容放入角色代码。

| Sprite 名称 | 代码文件 | 造型文件 | 初始状态 |
| --- | --- | --- | --- |
| `Player` | `Player.spx` | `assets/player.svg` | 显示 |
| `Base` | `Base.spx` | `assets/base.svg` | 显示 |
| `Enemy` | `Enemy.spx` | `assets/enemy.svg` | 隐藏，作为克隆模板 |
| `PlayerBullet` | `PlayerBullet.spx` | `assets/player-bullet.svg` | 隐藏，作为克隆模板 |
| `EnemyBullet` | `EnemyBullet.spx` | `assets/enemy-bullet.svg` | 隐藏，作为克隆模板 |
| `Steel` | `Steel.spx` | `assets/steel.svg` | 隐藏，作为克隆模板 |
| `Crate` | `Crate.spx` | `assets/crate.svg` | 隐藏，作为克隆模板 |
| `Item` | `Item.spx` | 下面三个造型 | 隐藏，作为克隆模板 |

`Item` 必须包含三个造型，并使用以下名称：

```text
shield -> assets/item-shield.svg
laser  -> assets/item-laser.svg
mine   -> assets/item-mine.svg
```

## 建议的监视器

可以在 XBuilder 中为以下舞台变量添加监视器：

```text
score
wave
playerHP
baseHP
shieldHits
laserCharges
enemyCount
```

## 实现说明

- 全局状态和生成入口位于 `main.spx`，所有 Sprite 可以直接访问舞台字段和函数。
- 敌军、炮弹、障碍和道具使用 `clone` 创建。
- 重开时使用 `broadcastAndWait "reset-game"` 清理全部克隆，再重建地图。
- 炮弹通过 `onTouchStart` 处理碰撞；敌我炮弹接触时双方同时销毁。
- 敌军本地规则负责高频移动，不依赖远程 AI 请求，确保操作响应稳定。
