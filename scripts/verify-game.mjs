#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectDir = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(projectDir, path), 'utf8')

const directions = [
  { name: 'up', heading: 0, deltaCol: 0, deltaRow: -1 },
  { name: 'right', heading: 90, deltaCol: 1, deltaRow: 0 },
  { name: 'down', heading: 180, deltaCol: 0, deltaRow: 1 },
  { name: 'left', heading: -90, deltaCol: -1, deltaRow: 0 }
]

for (const direction of directions) {
  // SPX renders costumes at heading + faceRight - 90. Directional art is drawn facing up.
  const renderRotation = (direction.heading + 90 - 90 + 360) % 360
  const movementRotation = (direction.heading + 360) % 360
  assert.equal(renderRotation, movementRotation, `${direction.name}: costume and movement direction differ`)
  assert.equal(Math.abs(direction.deltaCol) + Math.abs(direction.deltaRow), 1)
}

const buildScript = read('scripts/build-xbp.mjs')
for (const sprite of ['Player', 'Enemy', 'PlayerBullet', 'EnemyBullet']) {
  const block = buildScript.slice(buildScript.indexOf(`name: '${sprite}'`))
  assert.match(block.slice(0, 500), /faceRight: 90/)
}

assert.match(read('Player.spx'), /const attackCooldown = 0\.4/)
assert.match(read('Player.spx'), /timer-lastAttackAt < attackCooldown/)
assert.match(read('PlayerBullet.spx'), /wait 0\.13/)
assert.match(read('EnemyBullet.spx'), /wait 0\.17/)
assert.doesNotMatch(read('assets/backdrop.svg'), /id="grid"|patternUnits=/)
assert.ok(existsSync(resolve(projectDir, 'assets/index.json')))
const projectConfig = JSON.parse(read('assets/index.json'))
assert.deepEqual(projectConfig.zorder, [
  'Player',
  'Base',
  'Enemy',
  'PlayerBullet',
  'EnemyBullet',
  'Steel',
  'Crate',
  'Item'
])
for (const sprite of projectConfig.zorder) {
  const configPath = `assets/sprites/${sprite}/index.json`
  assert.ok(existsSync(resolve(projectDir, configPath)), `missing ${configPath}`)
  const config = JSON.parse(read(configPath))
  for (const costume of config.costumes) {
    assert.ok(
      existsSync(resolve(projectDir, 'assets/sprites', sprite, costume.path)),
      `missing costume ${sprite}/${costume.path}`
    )
  }
}
assert.match(read('main.spx'), /if !gameRunning \{\n\t\treturn\n\t\}\n\tif enemyCount/)
assert.match(read('main.spx'), /for itemCellBlocked\(itemSpawnCol, itemSpawnRow\)/)
for (const source of ['PlayerBullet.spx', 'EnemyBullet.spx', 'Item.spx']) {
  assert.match(read(source), /onMsg "game-over"/)
}

console.log('Direction, attack pacing, and backdrop checks passed')
