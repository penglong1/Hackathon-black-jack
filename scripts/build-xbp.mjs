#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(scriptDir, '..')
const outputPath = resolve(projectDir, 'TANK-black-jack.xbp')
const stagingDir = mkdtempSync(join(tmpdir(), 'tank-black-jack-xbp-'))

const sprites = [
  {
    name: 'Player',
    id: 'tank-player',
    x: -6,
    y: -150,
    size: 0.25,
    visible: true,
    costumes: [{ name: 'player', source: 'player.svg', target: 'player.svg', width: 48, height: 48 }]
  },
  {
    name: 'Base',
    id: 'tank-base',
    x: 6,
    y: -174,
    size: 0.25,
    visible: true,
    costumes: [{ name: 'base', source: 'base.svg', target: 'base.svg', width: 48, height: 48 }]
  },
  {
    name: 'Enemy',
    id: 'tank-enemy',
    size: 0.25,
    costumes: [{ name: 'enemy', source: 'enemy.svg', target: 'enemy.svg', width: 48, height: 48 }]
  },
  {
    name: 'PlayerBullet',
    id: 'tank-player-bullet',
    size: 0.45,
    costumes: [
      {
        name: 'player-bullet',
        source: 'player-bullet.svg',
        target: 'player-bullet.svg',
        width: 16,
        height: 16
      }
    ]
  },
  {
    name: 'EnemyBullet',
    id: 'tank-enemy-bullet',
    size: 0.45,
    costumes: [
      {
        name: 'enemy-bullet',
        source: 'enemy-bullet.svg',
        target: 'enemy-bullet.svg',
        width: 16,
        height: 16
      }
    ]
  },
  {
    name: 'Steel',
    id: 'tank-steel',
    size: 0.25,
    costumes: [{ name: 'steel', source: 'steel.svg', target: 'steel.svg', width: 48, height: 48 }]
  },
  {
    name: 'Crate',
    id: 'tank-crate',
    size: 0.25,
    costumes: [{ name: 'crate', source: 'crate.svg', target: 'crate.svg', width: 48, height: 48 }]
  },
  {
    name: 'Item',
    id: 'tank-item',
    size: 0.25,
    costumes: [
      { name: 'shield', source: 'item-shield.svg', target: 'shield.svg', width: 48, height: 48 },
      { name: 'laser', source: 'item-laser.svg', target: 'laser.svg', width: 48, height: 48 },
      { name: 'mine', source: 'item-mine.svg', target: 'mine.svg', width: 48, height: 48 }
    ]
  }
]

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function copyRequired(source, target) {
  if (!existsSync(source)) throw new Error(`Missing source file: ${source}`)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target)
}

try {
  writeJson(join(stagingDir, 'builder-meta.json'), {
    type: 'game',
    displayName: 'TANK-black-jack',
    description: '20x30 网格坦克基地防守游戏',
    instructions: '方向键移动，X 键攻击；保护基地并拦截来袭敌军。'
  })

  copyRequired(join(projectDir, 'main.spx'), join(stagingDir, 'main.spx'))
  copyRequired(join(projectDir, 'assets', 'backdrop.svg'), join(stagingDir, 'assets', 'backdrop.svg'))

  const spriteNames = sprites.map((sprite) => sprite.name)
  writeJson(join(stagingDir, 'assets', 'index.json'), {
    backdrops: [
      {
        x: 240,
        y: 180,
        bitmapResolution: 1,
        name: 'battlefield',
        path: 'backdrop.svg',
        builder_id: 'tank-backdrop',
        imageWidth: 480,
        imageHeight: 360
      }
    ],
    backdropIndex: 0,
    map: { width: 480, height: 360, mode: 'fillRatio' },
    physics: false,
    layerSortMode: '',
    autoSetCollisionLayer: true,
    stretchMode: true,
    audioAttenuation: 0,
    audioMaxDistance: 768,
    run: { width: 480, height: 360 },
    camera: { on: '' },
    zorder: spriteNames,
    builder_spriteOrder: sprites.map((sprite) => sprite.id),
    builder_soundOrder: [],
    maxFPS: 60
  })

  for (const sprite of sprites) {
    copyRequired(join(projectDir, `${sprite.name}.spx`), join(stagingDir, `${sprite.name}.spx`))
    const spriteAssetDir = join(stagingDir, 'assets', 'sprites', sprite.name)
    const costumes = sprite.costumes.map((costume, index) => {
      copyRequired(
        join(projectDir, 'assets', costume.source),
        join(spriteAssetDir, costume.target)
      )
      return {
        x: costume.width / 2,
        y: costume.height / 2,
        faceRight: 0,
        bitmapResolution: 1,
        name: costume.name,
        path: costume.target,
        builder_id: `${sprite.id}-costume-${index + 1}`,
        imageWidth: costume.width,
        imageHeight: costume.height
      }
    })

    writeJson(join(spriteAssetDir, 'index.json'), {
      heading: 0,
      x: sprite.x ?? 0,
      y: sprite.y ?? 0,
      size: sprite.size,
      rotationStyle: 'normal',
      physicsMode: 'no',
      costumeIndex: 0,
      visible: sprite.visible ?? false,
      isDraggable: false,
      collisionPivot: { x: 0, y: 0 },
      collisionShapeType: 'none',
      collisionShapeParams: [],
      costumes,
      fAnimations: {},
      animBindings: {},
      builder_id: sprite.id
    })
  }

  if (existsSync(outputPath)) rmSync(outputPath)
  execFileSync('zip', ['-qr', outputPath, '.'], { cwd: stagingDir })
  console.log(`Built ${basename(outputPath)}`)
} finally {
  rmSync(stagingDir, { recursive: true, force: true })
}
