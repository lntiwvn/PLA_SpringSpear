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
	@property(ParticleSystem)
	confettiParticle: ParticleSystem[] = [];

	playWinDelay(amount: string | number = 0) {
		console.log("PD", amount)
		amount = typeof amount === 'string' ? parseFloat(amount) : amount;
		this.scheduleOnce(() => this.playWin(), amount)
	}

	playWin() {
		this.confettiParticle.forEach((particle) => {
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
