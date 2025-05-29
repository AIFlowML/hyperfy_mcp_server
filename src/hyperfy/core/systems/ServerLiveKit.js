import { AccessToken, TrackSource } from 'livekit-server-sdk'

import { System } from './System.js'
import { uuid } from '../utils.js'

export class ServerLiveKit extends System {
  constructor(world) {
    super(world)
    this.roomId = uuid()
    this.wsUrl = process.env.LIVEKIT_WS_URL
    this.apiKey = process.env.LIVEKIT_API_KEY
    this.apiSecret = process.env.LIVEKIT_API_SECRET
    this.enabled = this.wsUrl && this.apiKey && this.apiSecret
  }

  async getPlayerOpts(playerId) {
    if (!this.enabled) return null
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: playerId,
    })
    const videoGrant = {
      room: this.roomId,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
      canUpdateOwnMetadata: true,
    }
    at.addGrant(videoGrant)
    const token = await at.toJwt()
    return {
      wsUrl: this.wsUrl,
      token,
    }
  }
}
