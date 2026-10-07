import { _decorator, Color, Component, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';

var ccclass = _decorator.ccclass;
var property = _decorator.property;

interface ImpactParticle {
    sprite: Sprite;
    transform: UITransform;
    color: Color;
    age: number;
    life: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    smoke: boolean;
    frameRange: number;
}

/** Sprite nodes and atlas frames are authored in WallImpactSmoke.prefab, never created in gameplay. */
@ccclass('WallImpactSmoke')
export class WallImpactSmoke extends Component {
    @property([SpriteFrame])
    public smokeFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public debrisFrames: SpriteFrame[] = [];

    @property([Sprite])
    public smokeParticles: Sprite[] = [];

    @property([Sprite])
    public debrisParticles: Sprite[] = [];

    @property({ min: 0, max: 5, step: 1 })
    public smokeCount = 5;

    @property({ min: 0, max: 5, step: 1 })
    public debrisCount = 5;

    @property({ min: 0 })
    public debrisSizeMin = 14;

    @property({ min: 0 })
    public debrisSizeMax = 21;

    @property({ min: 0.01, tooltip: 'Smoke lifetime in seconds.' })
    public smokeLifeMin = 0.5;

    @property({ min: 0.01 })
    public smokeLifeMax = 0.8;

    @property({ min: 0, tooltip: 'Final smoke diameter in board pixels.' })
    public smokeSize = 170;

    @property({ min: 0, tooltip: 'Smoke speed in board pixels per second.' })
    public smokeSpeed = 100;

    @property({ min: 0 })
    public smokeRadius = 40;

    @property(Color)
    public smokeColor = new Color(182, 189, 195, 110);

    @property({ min: 0, tooltip: 'Particle speed multiplier.' })
    public speedScale = 1;

    private _particles: ImpactParticle[] = [];
    private _normal: Vec2 = new Vec2(1, 0);

    public play(inwardNormal: Vec2): void {
        if (this._particles.length === 0) {
            this.cacheParticles(this.smokeParticles, true);
            this.cacheParticles(this.debrisParticles, false);
        }
        this._normal.set(inwardNormal.x, inwardNormal.y).normalize();
        if (this._normal.lengthSqr() < 0.001) this._normal.set(1, 0);
        var smokeIndex = 0;
        var debrisIndex = 0;
        for (var i = 0; i < this._particles.length; i++) {
            var particle = this._particles[i];
            var smoke = particle.smoke;
            var index = smoke ? smokeIndex++ : debrisIndex++;
            var count = smoke ? this.smokeCount : this.debrisCount;
            var frames = smoke ? this.smokeFrames : this.debrisFrames;
            particle.sprite.node.active = index < count && frames.length > 0;
            if (!particle.sprite.node.active) continue;
            particle.age = 0;
            particle.life = smoke ? Math.max(0.01, this.random(this.smokeLifeMin, this.smokeLifeMax)) : this.random(1, 2);
            particle.size = smoke ? this.smokeSize : this.random(this.debrisSizeMin, this.debrisSizeMax);
            particle.frameRange = smoke ? this.smokeFrames.length : this.random(4, 8);
            var spread = this.random(-Math.PI / 3, Math.PI / 3);
            var dx = this._normal.x * Math.cos(spread) - this._normal.y * Math.sin(spread);
            var dy = this._normal.x * Math.sin(spread) + this._normal.y * Math.cos(spread);
            var speed = (smoke ? this.smokeSpeed : this.random(500, 1000)) * this.speedScale;
            var offset = smoke ? this.random(-this.smokeRadius, this.smokeRadius) : this.random(-1, 1);
            particle.x = this._normal.x * 4 - this._normal.y * offset;
            particle.y = this._normal.y * 4 + this._normal.x * offset;
            particle.vx = dx * speed;
            particle.vy = dy * speed;
            particle.sprite.node.angle = this.random(0, 360);
            this.renderParticle(particle);
        }
    }

    private cacheParticles(sprites: Sprite[], smoke: boolean): void {
        for (var i = 0; i < sprites.length; i++) {
            var sprite = sprites[i];
            if (!sprite) continue;
            this._particles.push({ sprite: sprite, transform: sprite.getComponent(UITransform),
                color: new Color(), age: 0, life: 1, x: 0, y: 0, vx: 0, vy: 0,
                size: 1, smoke: smoke, frameRange: 1 });
        }
    }

    protected update(dt: number): void {
        var alive = false;
        for (var i = 0; i < this._particles.length; i++) {
            var particle = this._particles[i];
            if (!particle.sprite.node.active) continue;
            particle.age += dt;
            if (particle.age >= particle.life) {
                particle.sprite.node.active = false;
                continue;
            }
            alive = true;
            var remaining = dt;
            while (remaining > 0) {
                var step = Math.min(remaining, 1 / 60);
                particle.vy += (particle.smoke ? 196 : -1372) * this.speedScale * step;
                var speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
                var limit = 100 * this.speedScale;
                if (speed > limit) {
                    var dampen = particle.smoke ? 0.09 : 0.15;
                    var reduced = limit + (speed - limit) * Math.pow(1 - dampen, step * 60);
                    particle.vx *= reduced / speed;
                    particle.vy *= reduced / speed;
                }
                particle.x += particle.vx * step;
                particle.y += particle.vy * step;
                remaining -= step;
            }
            this.renderParticle(particle);
        }
        if (!alive) this.node.active = false;
    }

    private renderParticle(particle: ImpactParticle): void {
        var t = Math.min(1, particle.age / particle.life);
        var frames = particle.smoke ? this.smokeFrames : this.debrisFrames;
        particle.sprite.spriteFrame = frames[Math.min(frames.length - 1, Math.floor(t * particle.frameRange))];
        // The original Unity prefab uses Hermite curves for particle size.
        var growth = particle.smoke
            ? (2 * t * t * t - 3 * t * t + 1) * 0.31067657
                + (t * t * t - 2 * t * t + t) * 2 + (-2 * t * t * t + 3 * t * t)
            : 1 - t * t;
        var size = Math.max(0, particle.size * growth);
        particle.transform.setContentSize(size, size);
        particle.sprite.node.setPosition(particle.x, particle.y, 0);
        if (particle.smoke) {
            particle.color.set(this.smokeColor.r, this.smokeColor.g, this.smokeColor.b,
                Math.round(this.smokeColor.a * (1 - t)));
        } else {
            particle.color.set(255, 255, 255, 255);
        }
        particle.sprite.color = particle.color;
    }

    private random(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}
