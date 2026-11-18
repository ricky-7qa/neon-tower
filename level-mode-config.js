/* Neon Tower — Level Mode campaign configuration.
 * This file is the single source of truth for the first 30 challenge levels.
 * Gameplay integration is intentionally handled separately from Infinite Mode.
 */
(function () {
  'use strict';

  const levels = [
    { id:1, objectives:[{type:'wave',target:5}], reward:100 },
    { id:2, objectives:[{type:'kills',target:40}], reward:125 },
    { id:3, objectives:[{type:'survive',target:240}], reward:150 },
    { id:4, objectives:[{type:'wave',target:8},{type:'kills',target:60}], reward:200 },
    { id:5, objectives:[{type:'bosses',target:1}], reward:250, banner:'blue' },
    { id:6, objectives:[{type:'wave',target:10}], reward:275 },
    { id:7, objectives:[{type:'kills',target:100},{type:'survive',target:300}], reward:300 },
    { id:8, objectives:[{type:'bosses',target:2}], reward:350 },
    { id:9, objectives:[{type:'wave',target:12},{type:'kills',target:120}], reward:400 },
    { id:10, objectives:[{type:'wave',target:15},{type:'bosses',target:2}], reward:500, banner:'bronze', title:'survivor' },
    { id:11, objectives:[{type:'kills',target:180}], reward:550 },
    { id:12, objectives:[{type:'survive',target:480},{type:'kills',target:150}], reward:600 },
    { id:13, objectives:[{type:'wave',target:18},{type:'bosses',target:3}], reward:650 },
    { id:14, objectives:[{type:'kills',target:250},{type:'survive',target:600}], reward:700 },
    { id:15, objectives:[{type:'wave',target:22},{type:'kills',target:250},{type:'bosses',target:3}], reward:850, banner:'purple', title:'veteran' },
    { id:16, objectives:[{type:'bosses',target:4}], reward:900 },
    { id:17, objectives:[{type:'wave',target:25},{type:'survive',target:720}], reward:1000 },
    { id:18, objectives:[{type:'kills',target:400},{type:'bosses',target:4}], reward:1100 },
    { id:19, objectives:[{type:'wave',target:30},{type:'kills',target:350}], reward:1200 },
    { id:20, objectives:[{type:'wave',target:30},{type:'bosses',target:5},{type:'survive',target:900}], reward:1500, banner:'silver', title:'elite' },
    { id:21, objectives:[{type:'kills',target:500},{type:'survive',target:900}], reward:1600 },
    { id:22, objectives:[{type:'wave',target:35},{type:'bosses',target:5}], reward:1700 },
    { id:23, objectives:[{type:'kills',target:650},{type:'bosses',target:6}], reward:1800 },
    { id:24, objectives:[{type:'wave',target:40},{type:'survive',target:1080}], reward:2000 },
    { id:25, objectives:[{type:'wave',target:40},{type:'kills',target:700},{type:'bosses',target:6}], reward:2250, banner:'red', title:'master' },
    { id:26, objectives:[{type:'kills',target:850},{type:'survive',target:1200}], reward:2400 },
    { id:27, objectives:[{type:'wave',target:45},{type:'bosses',target:7}], reward:2600 },
    { id:28, objectives:[{type:'kills',target:1000},{type:'bosses',target:8},{type:'survive',target:1320}], reward:2800 },
    { id:29, objectives:[{type:'wave',target:50},{type:'kills',target:1000}], reward:3000 },
    { id:30, objectives:[{type:'wave',target:60},{type:'kills',target:1200},{type:'bosses',target:10},{type:'survive',target:1500}], reward:5000, banner:'legendary-gold', title:'neon-legend' }
  ];

  const config = {
    version: 1,
    maxLevel: 30,
    levels,
    cosmetics: {
      banners: [
        { id:'blue', unlockLevel:5, name:'Blue Banner' },
        { id:'bronze', unlockLevel:10, name:'Bronze Banner' },
        { id:'purple', unlockLevel:15, name:'Purple Banner' },
        { id:'silver', unlockLevel:20, name:'Silver Banner' },
        { id:'red', unlockLevel:25, name:'Red Banner' },
        { id:'legendary-gold', unlockLevel:30, name:'Legendary Gold Banner' }
      ],
      titles: [
        { id:'survivor', unlockLevel:10, name:'Survivor' },
        { id:'veteran', unlockLevel:15, name:'Veteran' },
        { id:'elite', unlockLevel:20, name:'Elite' },
        { id:'master', unlockLevel:25, name:'Master' },
        { id:'neon-legend', unlockLevel:30, name:'Neon Legend' }
      ]
    },
    difficulty: {
      independentFromInfinite: true,
      enemyCount: { earlyBase:8, earlyPerWave:0.9, middleBase:26, middlePerWave:0.5, lateBase:41, latePerWave:0.25 },
      healthGrowthPerWave:1.045,
      damageBase:2.4,
      damageGrowthPerWave:1.025,
      speedBase:62,
      speedGrowthPerWave:0.65,
      bossEveryWaves:5
    }
  };

  window.NEON_LEVEL_MODE_CONFIG = Object.freeze(config);
})();
