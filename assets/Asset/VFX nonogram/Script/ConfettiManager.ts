import {
	_decorator,
	Color,
	Component,
	GradientRange,
	ParticleSystem,
} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ConfettiManager')
export class ConfettiManager extends Component {
	@property([ParticleSystem])
	confettiParticle: ParticleSystem[] = [];

	private _winComplete: (() => void) | null = null;
	private readonly _particleBaseSpeeds = new Map<ParticleSystem, number>();

	playWinThen(onComplete: () => void): void {
		this.playWin();
		this._winComplete = onComplete;
	}

	protected update(): void {
		if (!this._winComplete || this.confettiParticle.some(particle =>
			particle?.isValid && particle.enabledInHierarchy && particle.isPlaying)) return;
		const complete = this._winComplete;
		this._winComplete = null;
		complete();
	}

	protected onDisable(): void {
		this._winComplete = null;
	}

	playWinDelay(amount: string | number = 0) {
		console.log("PD", amount)
		amount = typeof amount === 'string' ? parseFloat(amount) : amount;
		this.scheduleOnce(() => this.playWin(), amount)
	}

	playWin() {
		// Nested prefab references may be empty after importing the scene.
		if (!this.confettiParticle.length || this.confettiParticle.some(particle => !particle?.isValid)) {
			this.confettiParticle = this.getComponentsInChildren(ParticleSystem);
		}
		this.confettiParticle.forEach((particle) => {
			if (!particle?.isValid || !particle.enabledInHierarchy) return;
			if (!this._particleBaseSpeeds.has(particle)) {
				this._particleBaseSpeeds.set(particle, particle.simulationSpeed);
			}
			particle.simulationSpeed = this._particleBaseSpeeds.get(particle) * 1.2;
			particle.stop();
			particle.play();
		});
	}

	playLose() {
		const vfxTop = this.confettiParticle[this.confettiParticle.length - 1];
		vfxTop.startColor.mode = GradientRange.Mode.Color;
		vfxTop.startColor.color = Color.RED;
		vfxTop.play();
	}
}
