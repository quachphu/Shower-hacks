/* global Phaser, CONFIG, BossScene */

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.width,
  height: CONFIG.height,
  backgroundColor: '#0d1117',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BossScene],
});
