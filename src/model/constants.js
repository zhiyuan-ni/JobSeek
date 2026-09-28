// 看板列只表示大阶段；具体经过哪些轮次记在每条投递的 rounds 里
export const COLUMNS = [
  { id: 'todo', name: '待投递' },
  { id: 'applied', name: '已投递' },
  { id: 'test', name: '笔试/测评' },
  { id: 'interview', name: '面试中' },
  { id: 'offer', name: 'Offer' },
  { id: 'closed', name: '已结束' },
];

export const columnIndex = (id) => COLUMNS.findIndex((c) => c.id === id);

// 流程节点可以归属的列
export const ROUND_COLUMNS = COLUMNS.filter((c) => c.id !== 'todo' && c.id !== 'closed');

// column 为 null 的类型（自定义）由用户自己选归属列
export const ROUND_TYPES = [
  { id: 'apply', name: '网申', column: 'applied' },
  { id: 'assessment', name: '测评', column: 'test' },
  { id: 'written', name: '笔试', column: 'test' },
  { id: 'group', name: '群面', column: 'interview' },
  { id: 'tech', name: '业务/技术面', column: 'interview' },
  { id: 'cross', name: '交叉面/横向面', column: 'interview' },
  { id: 'manager', name: '主管面', column: 'interview' },
  { id: 'extra', name: '加面', column: 'interview' },
  { id: 'hr', name: 'HR面', column: 'interview' },
  { id: 'offer-talk', name: 'Offer沟通', column: 'offer' },
  { id: 'intent', name: '意向书', column: 'offer' },
  { id: 'sign', name: '签约', column: 'offer' },
  { id: 'custom', name: '自定义', column: null },
];

// 各列多少天没有进展算「没动静」；不在这里的列（待投递、Offer、已结束）不判断
export const STALE_DAYS = { applied: 14, test: 10, interview: 7 };

export const ROUND_STATUSES = [
  { id: 'pending', name: '待安排' },
  { id: 'scheduled', name: '已约' },
  { id: 'awaiting', name: '待结果' },
  { id: 'passed', name: '通过' },
  { id: 'failed', name: '未通过' },
  { id: 'cancelled', name: '取消' },
];

export const OUTCOMES = [
  { id: 'rejected', name: '挂了' },
  { id: 'declined', name: '拒Offer' },
  { id: 'withdrawn', name: '放弃' },
  { id: 'ghosted', name: '无回音' },
];

export const CATEGORIES = ['研发', '算法', '测试', '产品', '设计', '运营', '数据', '其他'];

export const CHANNELS = ['官网', '内推', '实习转正', '宣讲会', '双选会', '牛客', 'Boss直聘', '其他'];

export const PRIORITIES = [
  { id: 3, name: '高' },
  { id: 2, name: '中' },
  { id: 1, name: '低' },
];

export const WISHES = [
  { id: 1, name: '第一志愿' },
  { id: 2, name: '第二志愿' },
  { id: 3, name: '第三志愿' },
];

export const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? '';
