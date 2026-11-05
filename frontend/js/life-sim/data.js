/* Portable simulation parameters. All amounts/probabilities are fictional game balancing. */
(function (root) {
  'use strict';
  const data = {
    version: 1,
    countries: [
      { id: 'cn', currency: 'CNY', wage: 6000, regions: ['changsha', 'shaoyang'], names: ['林知远', '陈安宁', '周念', '许晨', '沈禾', '刘星', '宋明', '张宁', '吴桐', '陆晓', '方云', '赵然'], surnames: ['林', '陈', '周', '许'] },
      { id: 'jp', currency: 'JPY', wage: 280000, regions: ['osaka', 'nagano'], names: ['Haru Sato', 'Aoi Tanaka', 'Ren Ito', 'Yuki Mori', 'Nao Kato', 'Sora Abe', 'Mei Aoki', 'Rui Ono', 'Kai Wada', 'Rin Ueda', 'Jun Hara', 'Ema Ota'], surnames: ['Sato', 'Tanaka', 'Ito', 'Mori'] },
      { id: 'br', currency: 'BRL', wage: 3500, regions: ['saopaulo', 'recife'], names: ['Alex Silva', 'Luca Santos', 'Marina Costa', 'Rafa Lima', 'Dani Souza', 'João Alves', 'Bia Rocha', 'Ivo Melo', 'Lia Nunes', 'Caio Dias', 'Lara Reis', 'Leo Cruz'], surnames: ['Silva', 'Santos', 'Costa', 'Lima'] }
    ],
    regions: { changsha: { cost: 1, opportunity: 1.1 }, shaoyang: { cost: .68, opportunity: .78 }, osaka: { cost: 1, opportunity: 1.05 }, nagano: { cost: .8, opportunity: .85 }, saopaulo: { cost: 1, opportunity: 1.1 }, recife: { cost: .72, opportunity: .82 } },
    milestones: { 0: 'birth', 3: 'childhood', 6: 'school', 12: 'schoolpath', 15: 'exam', 18: 'education', 22: 'career', 25: 'love', 29: 'family', 35: 'home', 45: 'crossroads', 60: 'retire', 70: 'legacy', 80: 'oldage' },
    events: {
      birth: ['family', 'curiosity'], childhood: ['play', 'learn'], school: ['study', 'social'], schoolpath: ['study', 'play'], exam: ['study', 'rest'], education: ['university', 'vocational', 'work'], career: ['work', 'training', 'rest'], love: ['partner', 'social', 'rest'], family: ['child', 'family', 'work'], home: ['house', 'save', 'family'], crossroads: ['training', 'work', 'rest'], retire: ['retire', 'work'], legacy: ['family', 'social'], oldage: ['care', 'family'],
      reemployment: ['work','social','rest'], bereavement: ['family', 'rest', 'social'], unemployment: ['work', 'training', 'rest'], jobhunt: ['work', 'training', 'save'], seriousIllness: ['care', 'rest'], accident: ['care', 'rest'],
      discovery: ['learn', 'play'], friendship: ['social', 'study'], outing: ['play', 'save'], schoolstress: ['rest', 'study'], hobby: ['learn', 'social'], job: ['work', 'training', 'rest'], pressure: ['rest', 'work'], invitation: ['social', 'save'], familycall: ['family', 'work'], opportunity: ['training', 'work'], setback: ['save', 'social'], illness: ['care', 'rest'], move: ['move', 'stay'], affection: ['partner', 'social'], parenting: ['family', 'work'], repair: ['repair', 'save'], reunion: ['family', 'social'], quiet: ['rest', 'learn'], memory: ['social', 'family']
    },
    actions: {
      family: { happiness: 4, bond: 7, cost: .025 }, curiosity: { skill: 3, happiness: 2 }, play: { happiness: 6, health: 2, cost: .02 }, learn: { skill: 5, happiness: 2, cost: .03 }, study: { skill: 7, happiness: -2 }, social: { happiness: 5, bond: 5, cost: .04 }, rest: { health: 5, happiness: 4 }, university: { skill: 15, cost: 5 }, vocational: { skill: 9, cost: 1 }, work: { skill: 2, happiness: -2, health: -1 }, training: { skill: 8, cost: .4 }, partner: { happiness: 8 }, child: { happiness: 8, cost: .4 }, house: { happiness: 5, cost: 30 }, save: { happiness: -1 }, retire: { happiness: 5 }, care: { health: 14, cost: .4 }, move: { happiness: -2, cost: 1.5 }, stay: { happiness: 2 }, repair: { happiness: 2, cost: .2 }
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.LifeSimData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
