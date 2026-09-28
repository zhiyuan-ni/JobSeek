import { templateRound } from './application.js';

const template = (name, rounds) => ({
  name,
  rounds: rounds.map(([type, roundName]) => ({ ...templateRound(type), name: roundName })),
});

// 首次启动时写入 db，之后可以在「流程模板」页随意修改
export const BUILTIN_TEMPLATES = [
  template('技术岗通用', [
    ['apply', '网申'],
    ['written', '笔试'],
    ['tech', '一面'],
    ['tech', '二面'],
    ['hr', 'HR面'],
  ]),
  template('测评 + 群面', [
    ['apply', '网申'],
    ['assessment', '测评'],
    ['group', '群面'],
    ['tech', '业务面'],
    ['hr', 'HR面'],
  ]),
  template('只有面试', [
    ['apply', '网申'],
    ['tech', '一面'],
    ['tech', '二面'],
    ['tech', '三面'],
    ['hr', 'HR面'],
  ]),
];
