// README 截图用的演示数据：日期都相对于 now 生成，保证「近 7 天」「没动静」等提醒有内容可看
import { newApplication, newRound, templateRound, uid } from '../src/model/application.js';
import { normalizeDb } from '../src/model/db.js';

export function createDemo(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const dateOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shift = (days, h = 10, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const day = (days) => dateOf(shift(days));
  const at = (days, h, m = 0) => `${day(days)}T${pad(h)}:${pad(m)}`;
  const ago = (days) => shift(-days).toISOString();
  // 今天稍晚的一场：3 小时后取整点（太晚的话会落到明天，也没关系）
  const later = new Date(now.getTime() + 3 * 3_600_000);
  const laterToday = `${dateOf(later)}T${pad(later.getHours())}:00`;

  const r = (type, name, status, scheduledAt = '', note = '') => newRound(type, { name, status, scheduledAt, note });
  const pdfs = [];

  const resume = (name, note, fileName, daysAgo, pages) => {
    const id = uid();
    const content = samplePdf(pages);
    pdfs.push({ kind: 'resumes', id, content });
    return { id, name, note, fileName, size: content.length, createdAt: ago(daysAgo) };
  };
  const backendV3 = resume('后端 v3 · 加了字节实习', '项目经历换成实习里的网关重构；技能栏去掉了 PHP', '张三-后端-v3.pdf', 12, [
    'Zhang San - Backend Engineer Resume v3',
    'Sample document for JobSeek screenshots',
  ]);
  const backendV2 = resume('后端 v2', '提前批用的版本', '张三-后端-v2.pdf', 40, ['Zhang San - Backend Engineer Resume v2']);
  const algoV1 = resume('算法 v1 · 推荐方向', '突出推荐比赛和论文', '张三-算法-v1.pdf', 20, ['Zhang San - Recommendation Algorithm Resume v1']);

  const app = ({ lastActivity, ...fields }) =>
    newApplication({
      category: '研发',
      channel: '官网',
      createdAt: ago(35),
      updatedAt: ago(lastActivity ?? 1),
      lastActivityAt: lastActivity == null ? '' : ago(lastActivity),
      ...fields,
    });
  const withJd = (application, title) => {
    const content = samplePdf([title, 'Job description - sample document']);
    pdfs.push({ kind: 'jds', id: application.id, content });
    application.jdFile = { name: `${application.company}-${application.position}-JD.pdf`, size: content.length, uploadedAt: ago(20) };
    return application;
  };
  const techFlow = () => [r('apply', '网申', 'pending'), r('written', '笔试', 'pending'), r('tech', '一面', 'pending'), r('tech', '二面', 'pending'), r('hr', 'HR面', 'pending')];

  const bytedance = withJd(
    app({
      company: '字节跳动',
      position: '后端开发工程师',
      priority: 3,
      wish: 1,
      cities: ['北京'],
      channel: '内推',
      referralCode: 'DSKR2Q7M',
      resumeId: backendV3.id,
      appliedAt: day(-21),
      phase: 'interview',
      lastActivity: 1,
      notes: '抖音电商基础架构；HR 说横向面过了基本就稳了',
      rounds: [
        r('apply', '网申', 'passed'),
        r('written', '笔试', 'passed', at(-15, 19), '4 道编程，AC 3.5'),
        r('tech', '一面', 'passed', at(-8, 14), 'Redis 持久化、手写 LRU，面试官很耐心'),
        r('tech', '二面', 'passed', at(-4, 16), '项目深挖 + 系统设计：短链服务'),
        r('cross', '横向面', 'scheduled', at(1, 10, 30), '另一个部门的负责人来面'),
        r('hr', 'HR面', 'pending'),
      ],
    }),
    'ByteDance - Backend Engineer (Campus)',
  );

  const applications = [
    // 待投递
    app({ company: '美团', position: '后端开发', priority: 3, cities: ['北京'], deadline: day(1), rounds: techFlow() }),
    app({ company: '拼多多', position: '服务端研发', cities: ['上海'], deadline: day(5), rounds: [r('apply', '网申', 'pending')] }),
    app({ company: '网易游戏', position: '游戏服务端开发', cities: ['杭州', '广州'], deadline: day(12), rounds: [r('apply', '网申', 'pending')] }),
    app({ company: 'Shopee', position: '后端开发', priority: 1, cities: ['深圳'], deadline: day(-2), rounds: [r('apply', '网申', 'pending')] }),
    // 已投递
    withJd(
      app({
        company: '阿里巴巴',
        position: 'Java 研发工程师',
        priority: 3,
        wish: 1,
        cities: ['杭州'],
        channel: '内推',
        resumeId: backendV3.id,
        appliedAt: day(-17),
        phase: 'applied',
        rounds: [r('apply', '网申', 'awaiting'), r('assessment', '测评', 'pending'), r('tech', '一面', 'pending'), r('tech', '二面', 'pending'), r('hr', 'HR面', 'pending')],
      }),
      'Alibaba - Java Engineer (Campus)',
    ),
    app({ company: '百度', position: '后端研发工程师', cities: ['北京'], resumeId: backendV3.id, appliedAt: day(-6), phase: 'applied', rounds: [r('apply', '网申', 'awaiting'), r('written', '笔试', 'pending'), r('tech', '一面', 'pending')] }),
    app({ company: '京东', position: '后端开发', cities: ['北京'], resumeId: backendV3.id, appliedAt: day(-3), phase: 'applied', rounds: [r('apply', '网申', 'awaiting'), r('written', '笔试', 'pending')] }),
    // 笔试/测评
    app({
      company: '华为',
      position: '软件开发工程师',
      cities: ['深圳', '东莞'],
      resumeId: backendV2.id,
      appliedAt: day(-14),
      phase: 'test',
      lastActivity: 2,
      rounds: [r('apply', '网申', 'passed'), r('assessment', '性格测评', 'passed'), r('written', '机考', 'scheduled', at(1, 19))],
    }),
    app({ company: '米哈游', position: '服务端开发', priority: 3, cities: ['上海'], resumeId: backendV3.id, appliedAt: day(-9), phase: 'test', lastActivity: 3, rounds: [r('apply', '网申', 'passed'), r('written', '笔试', 'scheduled', laterToday)] }),
    app({ company: '快手', position: '后端开发工程师', cities: ['北京'], resumeId: backendV3.id, appliedAt: day(-20), phase: 'test', lastActivity: 11, rounds: [r('apply', '网申', 'passed'), r('written', '笔试', 'awaiting', at(-11, 19)), r('tech', '一面', 'pending')] }),
    // 面试中
    bytedance,
    app({
      company: '小红书',
      position: '推荐算法工程师',
      category: '算法',
      priority: 3,
      cities: ['上海'],
      resumeId: algoV1.id,
      appliedAt: day(-25),
      phase: 'interview',
      lastActivity: 8,
      rounds: [r('apply', '网申', 'passed'), r('written', '笔试', 'passed', at(-18, 19)), r('tech', '一面', 'passed', at(-9, 11)), r('tech', '二面', 'pending')],
    }),
    app({ company: '腾讯', position: '后台开发', priority: 3, cities: ['深圳'], resumeId: backendV3.id, appliedAt: day(-12), phase: 'interview', lastActivity: 1, rounds: [r('apply', '网申', 'passed'), r('tech', '一面', 'scheduled', at(2, 16)), r('tech', '二面', 'pending'), r('hr', 'HR面', 'pending')] }),
    app({ company: '蚂蚁集团', position: 'Java 开发', cities: ['杭州'], resumeId: backendV2.id, appliedAt: day(-16), phase: 'interview', lastActivity: 5, rounds: [r('apply', '网申', 'passed'), r('tech', '一面', 'passed', at(-7, 10)), r('tech', '二面', 'scheduled', at(-1, 15))] }),
    // Offer
    app({
      company: '招商银行',
      position: '金融科技岗',
      cities: ['深圳'],
      resumeId: backendV2.id,
      appliedAt: day(-30),
      phase: 'offer',
      lastActivity: 2,
      rounds: [r('apply', '网申', 'passed'), r('written', '笔试', 'passed', at(-24, 14)), r('tech', '一面', 'passed', at(-16, 9)), r('hr', 'HR面', 'passed', at(-9, 15)), r('intent', '意向书', 'awaiting')],
    }),
    // 已结束
    app({ company: '携程', position: '后端开发', cities: ['上海'], resumeId: backendV2.id, appliedAt: day(-22), phase: 'closed', outcome: 'rejected', closedFrom: 'interview', lastActivity: 6, rounds: [r('apply', '网申', 'passed'), r('written', '笔试', 'passed'), r('tech', '一面', 'failed', at(-6, 11))] }),
    app({ company: '滴滴', position: '后端开发', cities: ['北京'], resumeId: backendV2.id, appliedAt: day(-35), phase: 'closed', outcome: 'ghosted', closedFrom: 'applied', lastActivity: 4, rounds: [r('apply', '网申', 'awaiting')] }),
  ];

  const { db } = normalizeDb({ applications, resumes: [backendV3, backendV2, algoV1] });
  db.templates.push({
    id: uid(),
    name: '外企流程',
    rounds: [templateRound('apply'), { type: 'custom', name: 'Online Assessment', column: 'test' }, { ...templateRound('tech'), name: 'Technical Interview' }, { ...templateRound('manager'), name: 'Final Round' }],
  });
  return { db: { rev: 1, ...db }, pdfs, ids: { bytedance: bytedance.id } };
}

// 生成一个最小但合法的单页 PDF（只用 ASCII 文本）。
// 在对象和 xref 之间用注释把体积垫到接近真实简历，免得简历库里显示「600 B」；
// 不能垫在 %%EOF 后面，阅读器是从文件末尾找 startxref 的
function samplePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = lines.map((line, i) => `BT /F1 ${i === 0 ? 18 : 11} Tf 56 ${780 - i * 28} Td (${esc(line)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const offset = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  out += `%${'-'.repeat(80)}\n`.repeat(1500 + lines.join('').length * 20);
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
