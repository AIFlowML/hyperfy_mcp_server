import { World } from './World.js'

import { Server } from './systems/Server.js'
import { ServerLiveKit } from './systems/ServerLiveKit.js'
import { ServerNetwork } from './systems/ServerNetwork.js'
import { ServerLoader } from './systems/ServerLoader.js'
import { ServerEnvironment } from './systems/ServerEnvironment.js'

export function createServerWorld() {
  const world = new World()
  world.register('server', Server)
  world.register('livekit', ServerLiveKit)
  world.register('network', ServerNetwork)
  world.register('loader', ServerLoader)
  world.register('environment', ServerEnvironment)
  return world
}
