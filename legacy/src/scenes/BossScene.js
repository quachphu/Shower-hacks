/* global Phaser, CONFIG, TIERS */

class BossScene extends Phaser.Scene {
  constructor() {
    super('BossScene');
  }

  create() {
    this.makeTextures();

    this.bossHealth = CONFIG.boss.maxHealth;
    this.playerHealth = CONFIG.player.maxHealth;
    this.tierIndex = -1;
    this.dialAngle = 0;
    this.attackState = 'idle';
    this.attackTimer = 0;
    this.band = null;
    this.lastThrowAt = -9999;
    this.lastOuchAt = -9999;
    this.hue = 0;
    this.over = null;

    this.bg = this.add.graphics().setDepth(0);
    this.rgbGlow = this.add.rectangle(CONFIG.width / 2, CONFIG.height / 2, CONFIG.width, CONFIG.height, 0xffffff, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);
    this.bandGfx = this.add.graphics().setDepth(5);
    this.bossGfx = this.add.graphics().setDepth(12);

    this.steam = this.add.particles(0, 0, 'dot', {
      x: { min: CONFIG.arena.left, max: CONFIG.arena.right },
      y: CONFIG.height - 30,
      lifespan: 2600,
      speedY: { min: -72, max: -26 },
      speedX: { min: -18, max: 18 },
      scale: { start: 0.8, end: 2.8 },
      alpha: { start: 0.18, end: 0 },
      frequency: 120,
      quantity: 1,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(14);

    this.hitFx = this.add.particles(0, 0, 'dot', {
      speed: { min: 70, max: 240 },
      lifespan: 420,
      scale: { start: 0.65, end: 0 },
      alpha: { start: 0.95, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(15);

    this.player = this.physics.add.image(CONFIG.width / 2, CONFIG.height - 130, 'player').setDepth(10);
    this.player.setCircle(CONFIG.player.radius);
    this.soaps = this.physics.add.group();

    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE,R,UP,LEFT,DOWN,RIGHT');

    // Polling isDown alone drops clicks that begin and end inside a single frame.
    this.throwQueued = false;
    this.input.on('pointerdown', () => { this.throwQueued = true; });

    this.buildHud();
    this.applyTier(0);
  }

  makeTextures() {
    const g = this.make.graphics({ add: false });

    g.fillStyle(0xfffdf2, 1).fillRoundedRect(0, 0, 22, 15, 6);
    g.fillStyle(0xe6dcc2, 1).fillRoundedRect(3, 9, 16, 4, 2);
    g.generateTexture('soap', 22, 15);
    g.clear();

    g.fillStyle(0xffffff, 1).fillCircle(7, 7, 7);
    g.generateTexture('dot', 14, 14);
    g.clear();

    const r = CONFIG.player.radius;
    g.fillStyle(0x1c2233, 1).fillCircle(r + 1, r + 1, r);
    g.fillStyle(0xf0c9a0, 1).fillCircle(r + 1, r + 1, r - 3);
    g.fillStyle(0x3fb6f0, 1).fillRect(1, r - 1, r * 2, 7);
    g.generateTexture('player', r * 2 + 2, r * 2 + 2);
    g.destroy();
  }

  buildHud() {
    const s = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8f1ff' };

    this.bossBar = this.add.graphics().setDepth(20);
    this.add.text(CONFIG.width / 2, 24, 'THE TEMPERATURE KNOB', { ...s, fontSize: '17px' })
      .setOrigin(0.5).setDepth(20);

    this.tierText = this.add.text(20, CONFIG.height - 42, '', { ...s, fontSize: '14px' }).setDepth(20);
    this.tierSub = this.add.text(20, CONFIG.height - 25, '', { ...s, fontSize: '11px', color: '#9fb2c9' }).setDepth(20);
    this.hpBar = this.add.graphics().setDepth(20);

    this.tierBanner = this.add.text(CONFIG.width / 2, 300, '', { ...s, fontSize: '30px' })
      .setOrigin(0.5).setDepth(30).setAlpha(0);
  }

  applyTier(index) {
    if (index === this.tierIndex) return;
    const first = this.tierIndex === -1;
    this.tierIndex = index;
    const tier = TIERS[index];

    this.drawRoom(tier);
    this.tierText.setText(`SHOWER TIER ${index + 1}/${TIERS.length}: ${tier.name}`);
    this.tierSub.setText(tier.sub);
    this.steam.emitting = tier.steam;
    this.rgbGlow.setFillStyle(tier.accent, tier.rgb ? 0.14 : 0);

    if (first) return;

    this.cameras.main.flash(260, 255, 255, 255);
    this.tierBanner.setText(`UPGRADE!\n${tier.name}`).setAlpha(1).setScale(0.8);
    this.tweens.add({ targets: this.tierBanner, scale: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({ targets: this.tierBanner, alpha: 0, delay: 900, duration: 500 });
  }

  drawRoom(tier) {
    const g = this.bg;
    const { left, right, top, bottom } = CONFIG.arena;
    g.clear();

    g.fillStyle(tier.grout, 1).fillRect(0, 0, CONFIG.width, CONFIG.height);
    const size = 62;
    for (let y = 0; y < CONFIG.height; y += size) {
      for (let x = 0; x < CONFIG.width; x += size) {
        g.fillStyle(tier.tile, 1).fillRoundedRect(x + 3, y + 3, size - 6, size - 6, 4);
      }
    }

    // floor of the stall
    g.fillStyle(0x000000, 0.18).fillRect(left - 12, top - 12, right - left + 24, bottom - top + 24);
    g.lineStyle(3, tier.accent, 0.55).strokeRect(left - 12, top - 12, right - left + 24, bottom - top + 24);

    // shower heads along the ceiling — more of them every tier
    const n = tier.heads;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? CONFIG.width / 2 : Phaser.Math.Linear(120, CONFIG.width - 120, i / (n - 1));
      g.fillStyle(tier.accent, 0.95).fillRoundedRect(x - 13, 44, 26, 9, 4);
      g.fillStyle(tier.accent, 0.30).fillTriangle(x - 10, 53, x + 10, 53, x, 118);
    }

    // the drain (where a certain final boss lives)
    g.fillStyle(0x000000, 0.55).fillCircle(CONFIG.width / 2, bottom - 26, 26);
    g.lineStyle(3, tier.accent, 0.5).strokeCircle(CONFIG.width / 2, bottom - 26, 26);
  }

  update(time, delta) {
    if (this.over) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.restart();
      return;
    }

    this.movePlayer();
    this.tryThrow(time);
    this.cullSoap(time);
    this.hitBoss();
    this.runAttacks(time, delta);
    this.drawBoss(time);
    this.drawHud();

    if (TIERS[this.tierIndex].rgb) {
      this.hue = (this.hue + delta * 0.12) % 360;
      this.rgbGlow.setFillStyle(Phaser.Display.Color.HSVToRGB(this.hue / 360, 1, 1).color, 0.16);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.scene.restart();
  }

  movePlayer() {
    const k = this.keys;
    const vx = (k.A.isDown || k.LEFT.isDown ? -1 : 0) + (k.D.isDown || k.RIGHT.isDown ? 1 : 0);
    const vy = (k.W.isDown || k.UP.isDown ? -1 : 0) + (k.S.isDown || k.DOWN.isDown ? 1 : 0);
    const v = new Phaser.Math.Vector2(vx, vy).normalize().scale(CONFIG.player.speed);
    this.player.setVelocity(v.x, v.y);

    const { left, right, top, bottom } = CONFIG.arena;
    this.player.x = Phaser.Math.Clamp(this.player.x, left, right);
    this.player.y = Phaser.Math.Clamp(this.player.y, top, bottom);
  }

  tryThrow(time) {
    const wants = this.input.activePointer.isDown || this.keys.SPACE.isDown || this.throwQueued;
    this.throwQueued = false;
    if (!wants || time - this.lastThrowAt < CONFIG.soap.cooldownMs) return;
    this.lastThrowAt = time;

    const p = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, p.worldX, p.worldY);
    const soap = this.soaps.create(this.player.x, this.player.y, 'soap').setDepth(10);
    soap.born = time;
    soap.setVelocity(Math.cos(angle) * CONFIG.soap.speed, Math.sin(angle) * CONFIG.soap.speed);
    soap.setAngularVelocity(700);
  }

  cullSoap(time) {
    this.soaps.children.each((s) => {
      if (!s.active) return;
      const out = s.x < -40 || s.x > CONFIG.width + 40 || s.y < -40 || s.y > CONFIG.height + 40;
      if (out || time - s.born > CONFIG.soap.lifeMs) s.destroy();
    });
  }

  hitBoss() {
    const { x, y, radius } = CONFIG.boss;
    this.soaps.children.each((s) => {
      if (!s.active) return;
      if (Phaser.Math.Distance.Between(s.x, s.y, x, y) > radius + CONFIG.soap.radius) return;

      this.hitFx.explode(7, s.x, s.y);
      s.destroy();
      this.bossHealth = Math.max(0, this.bossHealth - CONFIG.soap.damage);
      this.cameras.main.shake(70, 0.003);

      const frac = this.bossHealth / CONFIG.boss.maxHealth;
      this.applyTier(Phaser.Math.Clamp(Math.floor((1 - frac) * TIERS.length), 0, TIERS.length - 1));
      if (this.bossHealth <= 0) this.finish(true);
    });
  }

  runAttacks(time, delta) {
    this.attackTimer += delta;
    const frac = this.bossHealth / CONFIG.boss.maxHealth;
    const interval = Phaser.Math.Linear(CONFIG.attack.minIntervalMs, CONFIG.attack.intervalMs, frac);

    if (this.attackState === 'idle' && this.attackTimer >= interval) {
      this.startTelegraph();
    } else if (this.attackState === 'telegraph' && this.attackTimer >= CONFIG.attack.telegraphMs) {
      this.attackState = 'active';
      this.attackTimer = 0;
      this.cameras.main.shake(180, 0.006);
    } else if (this.attackState === 'active' && this.attackTimer >= CONFIG.attack.activeMs) {
      this.attackState = 'idle';
      this.attackTimer = 0;
      this.band = null;
    }

    this.drawBand(time);

    if (this.attackState === 'active' && this.band &&
        Phaser.Geom.Rectangle.Contains(this.band.rect, this.player.x, this.player.y)) {
      this.playerHealth -= CONFIG.attack.damagePerSec * (delta / 1000);
      if (time - this.lastOuchAt > CONFIG.player.invulnMs) {
        this.lastOuchAt = time;
        this.cameras.main.shake(120, 0.004);
        this.player.setTintFill(this.band.kind === 'fire' ? 0xff5b3c : 0x63d7ff);
        this.time.delayedCall(140, () => this.player.clearTint());
      }
      if (this.playerHealth <= 0) this.finish(false);
    }
  }

  startTelegraph() {
    this.attackState = 'telegraph';
    this.attackTimer = 0;

    const { left, right, top, bottom } = CONFIG.arena;
    const t = CONFIG.attack.bandThickness;
    const vertical = Math.random() < 0.5;
    const kind = Math.random() < 0.5 ? 'fire' : 'ice';

    const rect = vertical
      ? new Phaser.Geom.Rectangle(Phaser.Math.Between(left, right - t), top, t, bottom - top)
      : new Phaser.Geom.Rectangle(left, Phaser.Math.Between(top, bottom - t), right - left, t);

    this.band = { rect, kind };
    this.tweens.add({
      targets: this,
      dialAngle: kind === 'fire' ? Phaser.Math.DegToRad(52) : Phaser.Math.DegToRad(-52),
      duration: CONFIG.attack.telegraphMs * 0.8,
      ease: 'Back.out',
    });
  }

  drawBand(time) {
    const g = this.bandGfx;
    g.clear();
    if (!this.band) return;

    const { rect, kind } = this.band;
    const color = kind === 'fire' ? 0xff4a24 : 0x35c6ff;

    if (this.attackState === 'telegraph') {
      const pulse = 0.12 + Math.abs(Math.sin(time / 90)) * 0.18;
      g.fillStyle(color, pulse).fillRectShape(rect);
      g.lineStyle(3, color, 0.9).strokeRectShape(rect);
    } else {
      g.fillStyle(color, 0.46).fillRectShape(rect);
      g.lineStyle(4, 0xffffff, 0.5).strokeRectShape(rect);
      for (let i = 0; i < 9; i++) {
        const t = ((time / 5 + i * 60) % (rect.width + rect.height));
        g.fillStyle(0xffffff, 0.16);
        if (rect.width > rect.height) g.fillRect(rect.x + t % rect.width, rect.y, 16, rect.height);
        else g.fillRect(rect.x, rect.y + t % rect.height, rect.width, 16);
      }
    }
  }

  drawBoss(time) {
    const g = this.bossGfx;
    const { x, y, radius } = CONFIG.boss;
    const heat = Phaser.Math.Clamp((this.dialAngle + 0.95) / 1.9, 0, 1);
    const cold = Phaser.Display.Color.ValueToColor(0x2f9bd6);
    const hot = Phaser.Display.Color.ValueToColor(0xff4a24);
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(cold, hot, 100, heat * 100);
    const color = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);

    g.clear();
    g.fillStyle(0x000000, 0.25).fillCircle(x, y + 6, radius + 8);
    g.fillStyle(color, 0.22).fillCircle(x, y, radius + 12 + Math.sin(time / 260) * 4);
    g.fillStyle(0xe9eef5, 1).fillCircle(x, y, radius);
    g.fillStyle(0x1a2030, 1).fillCircle(x, y, radius - 10);

    for (let i = 0; i <= 10; i++) {
      const a = Phaser.Math.DegToRad(-125 + i * 25);
      const inner = radius + 6;
      const outer = radius + 14;
      g.lineStyle(3, i < 4 ? 0x35c6ff : i > 6 ? 0xff4a24 : 0xbfd0e0, 0.85);
      g.beginPath();
      g.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
      g.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
      g.strokePath();
    }

    const a = this.dialAngle - Math.PI / 2;
    g.lineStyle(9, color, 1);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * (radius - 14), y + Math.sin(a) * (radius - 14));
    g.strokePath();
    g.fillStyle(color, 1).fillCircle(x, y, 9);
  }

  // Radius must be clamped to half the fill width, or Phaser's rounded-rect
  // path breaks and paints the full bar when the value is nearly empty.
  drawBar(g, x, y, w, h, frac, color) {
    const fw = Math.max(2, w * Phaser.Math.Clamp(frac, 0, 1));
    g.fillStyle(0x000000, 0.45).fillRoundedRect(x, y, w, h, h / 2);
    g.fillStyle(color, 1).fillRoundedRect(x, y, fw, h, Math.min(h / 2, fw / 2));
  }

  drawHud() {
    const w = CONFIG.width - 240;
    this.bossBar.clear();
    this.drawBar(this.bossBar, 120, 44, w, 14, this.bossHealth / CONFIG.boss.maxHealth, 0x6ef0a5);

    const pw = 210;
    const pf = this.playerHealth / CONFIG.player.maxHealth;
    this.hpBar.clear();
    this.drawBar(this.hpBar, CONFIG.width - pw - 20, CONFIG.height - 40, pw, 16, pf,
      pf > 0.35 ? 0x4dd2ff : 0xff5b3c);
  }

  finish(won) {
    if (this.over) return; // two soaps can land on the killing blow in the same frame
    this.over = won ? 'won' : 'lost';
    this.player.setVelocity(0, 0);
    this.bandGfx.clear();
    this.steam.emitting = won;

    const panel = this.add.rectangle(CONFIG.width / 2, CONFIG.height / 2, CONFIG.width, 200, 0x000000, 0.72)
      .setDepth(30);
    const title = won ? 'YOU MAY NOW SHOWER' : 'RINSE AND REPEAT';
    const sub = won
      ? 'The Temperature Knob has been defeated.\nThe Hair Clog stirs in the drain...'
      : 'The knob won. It always wins.';

    this.add.text(CONFIG.width / 2, CONFIG.height / 2 - 40, title, {
      fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '34px', color: won ? '#ffd76a' : '#ff8d6a',
    }).setOrigin(0.5).setDepth(31);

    this.add.text(CONFIG.width / 2, CONFIG.height / 2 + 24, `${sub}\n\npress R to fight again`, {
      fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '14px', color: '#dbe6f3', align: 'center',
    }).setOrigin(0.5).setDepth(31);

    panel.setScale(1, 0);
    this.tweens.add({ targets: panel, scaleY: 1, duration: 220 });
  }
}
