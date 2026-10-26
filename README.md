#  坦克大战

这是使用 **XGo + SPX** 编写的 2D 网格坦克防守游戏，可以使用 XGo 直接运行，也可以导入 GoPlus XBuilder。

旧版 HTML、CSS、JavaScript 游戏及 GitHub Pages 工作流已经移除，本仓库只保留 SPX 项目源码和角色造型资源。

## 游戏规则

- 战场逻辑尺寸为 20×30 格，每格对应 12 个舞台坐标单位。
- 方向键控制玩家坦克，每次移动一格。
- 按 `X` 发射炮弹。
- 敌军从左上方生成，以基地为主要目标自动移动和攻击。
- 玩家需要拦截敌军并保护基地。
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
Player.spx        玩家：网格移动、普通炮弹和镭射炮
Base.spx          基地：位置、受击和失败提示
Enemy.spx         敌军：克隆、自动移动、基地优先策略和攻击
PlayerBullet.spx  玩家炮弹：移动、碰撞、消灭敌军和木箱
EnemyBullet.spx   敌军炮弹：移动、攻击玩家和基地
Item.spx          道具：随机类型、拾取效果和 10 秒生命周期
Steel.spx         不可摧毁障碍模板
Crate.spx         可摧毁木箱模板
assets/           舞台背景与角色造型 SVG
```

## 本地运行

安装 XGo 后，还需要安装与项目依赖一致的 SPX v3.3.0 图形运行环境：

```bash
git clone --branch v3.3.0 --depth 1 https://github.com/goplus/spx.git
cd spx
make setup
make doctor
export PATH="$(go env GOPATH)/bin:$PATH"
```

然后回到游戏项目，下载 Go 模块并通过 SPX 主机运行：

```bash
cd "/Users/pidan/Documents/New project/Hackathon-black-jack"
go mod download
spx run --path .
```

游戏代码位于根目录的 `.spx` 文件中，SPX 框架依赖声明在 `go.mod`，完整的项目配置和图片资源位于 `assets/`。`xgo` 负责编译源码，`spx` 负责启动图形运行时。首次运行会下载 `github.com/goplus/spx/v3` 及相关依赖。

## 导入 XBuilder

仓库根目录中的 `TANK-black-jack.xbp` 是可直接导入的 XBuilder 项目文件：

1. 打开现有的 `TANK-black-jack` 项目。
2. 鼠标移到左上角的文件图标。
3. 选择“导入项目文件...”，并确认覆盖当前项目内容。
4. 选择 `TANK-black-jack.xbp`，导入完成后点击运行。

导入前如需保留当前内容，请先在同一菜单中选择“导出项目文件”。

本地运行不需要 Node.js。只有修改源码或素材后需要重新生成 XBuilder 的 `.xbp` 文件时，才运行：

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


项目已同步xbuild：https://x.qiniu.com/project/wechat-0b3e86d46222d6e0/TANK-black-jack
