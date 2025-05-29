import { Node } from '../core/nodes/Node.js'
import * as THREE from 'three'
import type { AvatarFactory, AvatarInstance } from '../../types/index.js'

// Native JavaScript replacement for lodash isString (remove if using Option 1)
const isString = (value: unknown): value is string => typeof value === 'string';

// Extended interface for AgentAvatar that includes Node properties
interface ExtendedNode extends Node {
  name: string;
  ctx: {
    world: {
      stage: {
        dirtyNodes: Set<Node>;
      };
      loader: {
        get(type: string, url: string): LoadedAvatar | undefined;
        load(type: string, url: string): Promise<LoadedAvatar | undefined>;
      };
      setHot?: (instance: unknown, value: boolean) => void;
    };
  } | null;
  matrixWorld: THREE.Matrix4;
  setDirty(): void;
  parent: Node & { position?: THREE.Vector3 } | null;
  proxy: AvatarProxy | undefined;
}

// Type for loaded avatar data
interface LoadedAvatar {
  factory?: AvatarFactory;
  hooks?: unknown;
}

// Type for the avatar proxy object
interface AvatarProxy {
  [key: string]: unknown;
  src: string | null;
  emote: string | null;
  onLoad: (() => void) | null;
  getHeight(): number | null;
  getHeadToHeight(): number | null;
  getBoneTransform(boneName: string): THREE.Matrix4;
  setEmote(url: string | null): void;
  height: number | null;
}

const defaults = {
  src: null as string | null,
  emote: null as string | null,
  onLoad: null as (() => void) | null,
}

export class AgentAvatar extends Node {
  private _src: string | null = defaults.src
  private _emote: string | null = defaults.emote
  private _onLoad: (() => void) | null = defaults.onLoad

  public factory: AvatarFactory | null = null
  public hooks: unknown = null
  public instance: AvatarInstance | null = null
  private n = 0
  private needsRebuild = false
  private isLoading = false

  constructor(data: Partial<{
    id: string
    src: string
    emote: string
    onLoad: () => void
    factory: AvatarFactory
    hooks: unknown
  }> = {}) {
    super(data)
    // Type assertion to access name property from Node
    ;(this as unknown as ExtendedNode).name = 'avatar'
  
    this.src = data.src ?? defaults.src
    this.emote = data.emote ?? defaults.emote
    this.onLoad = data.onLoad ?? defaults.onLoad
    this.factory = data.factory ?? null
    this.hooks = data.hooks ?? null
  }

  async mount() {
    this.needsRebuild = false
    
    // Prevent concurrent loading
    if (this.isLoading) return
    
    if (this._src) {
      const n = ++this.n
      const ctx = (this as unknown as ExtendedNode).ctx
      
      if (!ctx?.world?.loader) {
        console.warn('[avatar] No loader available in world context')
        return
      }
      
      try {
        this.isLoading = true
        let avatar = ctx.world.loader.get('avatar', this._src)
        
        if (!avatar) {
          avatar = await ctx.world.loader.load('avatar', this._src)
        }
        
        // Check if this mount operation is still valid
        if (this.n !== n) return
        
        this.factory = avatar?.factory ?? null
        this.hooks = avatar?.hooks ?? null
      } catch (error) {
        console.warn('[avatar] Failed to load avatar:', error)
        this.factory = null
        this.hooks = null
        return
      } finally {
        this.isLoading = false
      }
    }
    
    if (this.factory) {
      try {
        const matrixWorld = (this as unknown as ExtendedNode).matrixWorld
        this.instance = this.factory.create(matrixWorld, this.hooks, this)
        this.instance.setEmote(this._emote)
        const ctx = (this as unknown as ExtendedNode).ctx
        ctx?.world?.setHot?.(this.instance, true)
        this._onLoad?.()
      } catch (error) {
        console.warn('[avatar] Failed to create avatar instance:', error)
        this.instance = null
      }
    }
  }

  commit(didMove: boolean) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
    }
    if (didMove) {
      const matrixWorld = (this as unknown as ExtendedNode).matrixWorld
      this.instance?.move(matrixWorld)
    }
  }

  unmount() {
    this.n++
    if (this.instance) {
      const ctx = (this as unknown as ExtendedNode).ctx
      ctx?.world?.setHot?.(this.instance, false)
      this.instance.destroy()
      this.instance = null
    }
  }

  applyStats(stats: unknown) {
    this.factory?.applyStats?.(stats)
  }

  get src(): string | null {
    return this._src
  }

  set src(value: string | null) {
    if (value !== null && !isString(value)) {
      throw new Error('[avatar] src not a string')
    }
    if (this._src === value) return
    this._src = value
    this.needsRebuild = true
    // Type assertion for setDirty method from Node
    ;(this as unknown as ExtendedNode).setDirty()
  }

  get emote(): string | null {
    return this._emote
  }

  set emote(value: string | null) {
    if (value !== null && !isString(value)) {
      // throw new Error('[avatar] emote not a string')
      return;
    }
    if (this._emote === value) return
    this._emote = value
    this.instance?.setEmote(value)
  }

  get onLoad(): (() => void) | null {
    return this._onLoad
  }

  set onLoad(value: (() => void) | null) {
    this._onLoad = value
  }

  getHeight(): number | null {
    return this.instance?.height ?? null
  }

  getHeadToHeight(): number | null {
    return this.instance?.headToHeight ?? null
  }

  getBoneTransform(_boneName: string): THREE.Matrix4 {
    const matrix = new THREE.Matrix4()
    const parent = (this as unknown as ExtendedNode).parent
    if (parent?.position) {
      matrix.makeTranslation(
        parent.position.x,
        parent.position.y,
        parent.position.z
      )
    }
    return matrix
  }

  setEmote(url: string | null) {
    this.emote = url
  }

  get height(): number | null {
    return this.getHeight()
  }

  copy(source: AgentAvatar, recursive: boolean): this {
    super.copy(source, recursive)
    this._src = source._src
    this._emote = source._emote
    this._onLoad = source._onLoad
    this.factory = source.factory
    this.hooks = source.hooks
    return this
  }

  getProxy(): AvatarProxy {
    const extendedThis = this as unknown as ExtendedNode
    let proxy = extendedThis.proxy
    if (!proxy) {
      const self = this
      const baseProxy = super.getProxy() as Record<string, unknown>
  
      proxy = {
        ...baseProxy,
  
        get src() {
          return self.src
        },
        set src(value: string | null) {
          self.src = value
        },
  
        get emote() {
          return self.emote
        },
        set emote(value: string | null) {
          self.emote = value
        },
  
        get onLoad() {
          return self.onLoad
        },
        set onLoad(value: (() => void) | null) {
          self.onLoad = value
        },
  
        getHeight() {
          return self.getHeight()
        },
  
        getHeadToHeight() {
          return self.getHeadToHeight()
        },

        getBoneTransform(boneName: string) {
          return self.getBoneTransform(boneName)
        },

        setEmote(url: string | null) {
          return self.setEmote(url)
        },

        get height() {
          return self.height
        },
      }
      
      extendedThis.proxy = proxy
    }
  
    return proxy
  }
  
}