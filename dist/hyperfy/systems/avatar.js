import { Node } from '../core/nodes/Node.js';
import * as THREE from 'three';
// Native JavaScript replacement for lodash isString (remove if using Option 1)
const isString = (value) => typeof value === 'string';
const defaults = {
    src: null,
    emote: null,
    onLoad: null,
};
export class AgentAvatar extends Node {
    constructor(data = {}) {
        super(data);
        this._src = defaults.src;
        this._emote = defaults.emote;
        this._onLoad = defaults.onLoad;
        this.factory = null;
        this.hooks = null;
        this.instance = null;
        this.n = 0;
        this.needsRebuild = false;
        this.isLoading = false;
        this.name = 'avatar';
        this.src = data.src ?? defaults.src;
        this.emote = data.emote ?? defaults.emote;
        this.onLoad = data.onLoad ?? defaults.onLoad;
        this.factory = data.factory ?? null;
        this.hooks = data.hooks ?? null;
    }
    async mount() {
        this.needsRebuild = false;
        // Prevent concurrent loading
        if (this.isLoading)
            return;
        if (this._src) {
            const n = ++this.n;
            const ctx = this.ctx;
            if (!ctx?.world?.loader) {
                console.warn('[avatar] No loader available in world context');
                return;
            }
            try {
                this.isLoading = true;
                let avatar = ctx.world.loader.get('avatar', this._src);
                if (!avatar) {
                    avatar = await ctx.world.loader.load('avatar', this._src);
                }
                // Check if this mount operation is still valid
                if (this.n !== n)
                    return;
                this.factory = avatar?.factory ?? null;
                this.hooks = avatar?.hooks ?? null;
            }
            catch (error) {
                console.warn('[avatar] Failed to load avatar:', error);
                this.factory = null;
                this.hooks = null;
                return;
            }
            finally {
                this.isLoading = false;
            }
        }
        if (this.factory) {
            try {
                const matrixWorld = this.matrixWorld;
                this.instance = this.factory.create(matrixWorld, this.hooks, this);
                this.instance.setEmote(this._emote);
                const ctx = this.ctx;
                ctx?.world?.setHot?.(this.instance, true);
                this._onLoad?.();
            }
            catch (error) {
                console.warn('[avatar] Failed to create avatar instance:', error);
                this.instance = null;
            }
        }
    }
    commit(didMove) {
        if (this.needsRebuild) {
            this.unmount();
            this.mount();
        }
        if (didMove) {
            const matrixWorld = this.matrixWorld;
            this.instance?.move(matrixWorld);
        }
    }
    unmount() {
        this.n++;
        if (this.instance) {
            const ctx = this.ctx;
            ctx?.world?.setHot?.(this.instance, false);
            this.instance.destroy();
            this.instance = null;
        }
    }
    applyStats(stats) {
        this.factory?.applyStats?.(stats);
    }
    get src() {
        return this._src;
    }
    set src(value) {
        if (value !== null && !isString(value)) {
            throw new Error('[avatar] src not a string');
        }
        if (this._src === value)
            return;
        this._src = value;
        this.needsRebuild = true;
        this.setDirty();
    }
    get emote() {
        return this._emote;
    }
    set emote(value) {
        if (value !== null && !isString(value)) {
            // throw new Error('[avatar] emote not a string')
            return;
        }
        if (this._emote === value)
            return;
        this._emote = value;
        this.instance?.setEmote(value);
    }
    get onLoad() {
        return this._onLoad;
    }
    set onLoad(value) {
        this._onLoad = value;
    }
    getHeight() {
        return this.instance?.height ?? null;
    }
    getHeadToHeight() {
        return this.instance?.headToHeight ?? null;
    }
    getBoneTransform(_boneName) {
        const matrix = new THREE.Matrix4();
        const parent = this.parent;
        if (parent?.position) {
            matrix.makeTranslation(parent.position.x, parent.position.y, parent.position.z);
        }
        return matrix;
    }
    setEmote(url) {
        this.emote = url;
    }
    get height() {
        return this.getHeight();
    }
    copy(source, recursive) {
        super.copy(source, recursive);
        this._src = source._src;
        this._emote = source._emote;
        this._onLoad = source._onLoad;
        this.factory = source.factory;
        this.hooks = source.hooks;
        return this;
    }
    getProxy() {
        const extendedThis = this;
        let proxy = extendedThis.proxy;
        if (!proxy) {
            const self = this;
            const baseProxy = super.getProxy();
            proxy = {
                ...baseProxy,
                get src() {
                    return self.src;
                },
                set src(value) {
                    self.src = value;
                },
                get emote() {
                    return self.emote;
                },
                set emote(value) {
                    self.emote = value;
                },
                get onLoad() {
                    return self.onLoad;
                },
                set onLoad(value) {
                    self.onLoad = value;
                },
                getHeight() {
                    return self.getHeight();
                },
                getHeadToHeight() {
                    return self.getHeadToHeight();
                },
                getBoneTransform(boneName) {
                    return self.getBoneTransform(boneName);
                },
                setEmote(url) {
                    return self.setEmote(url);
                },
                get height() {
                    return self.height;
                },
            };
            extendedThis.proxy = proxy;
        }
        return proxy;
    }
}
//# sourceMappingURL=avatar.js.map