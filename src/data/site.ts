type LinkItem = {
  label: string;
  href: string;
  description: string;
  tag: string;
  accent: string;
  external?: boolean;
};

type Section = {
  kicker: string;
  title: string;
  description: string;
  items: LinkItem[];
};

type Contact = {
  label: string;
  value: string;
  href: string;
  external?: boolean;
};

export const profile = {
  name: '洛柠 Naloveyuki',
  tagline: '文档、代码和一些认真收纳起来的小爱好。',
  summary:
    '这里是给 GitHub Pages 准备的个人导航页，用来集中放项目入口、组织链接、联系信息，以及我现在最常用的技术栈。',
  description: 'Naloveyuki 的个人导航页，聚合 GitHub、组织、联系方式和常用项目入口。',
  status: 'INFP / 高中生 / 文档爱好者',
  mood: '阴晴不定，但通常会认真把事情做完。',
  github: {
    href: 'https://github.com/Nanaloveyuki',
  },
} as const;

export const quickFacts = [
  { label: '昵称', value: '洛柠 Naloveyuki' },
  { label: '爱好', value: '写文档、学语言、折腾计算机知识' },
  { label: '特长', value: 'Markdown / Word / 内容整理' },
  { label: '游戏', value: '和朋友一起玩 MC' },
] as const;

export const skills = ['Markdown', 'Word', 'Rust', 'Python', 'Golang', 'C#', 'MoonBit'] as const;

export const featuredLinks: LinkItem[] = [
  {
    label: 'GitHub 主页',
    href: 'https://github.com/Nanaloveyuki',
    description: '项目、提交记录和公开折腾都从这里进。',
    tag: 'Profile',
    accent: '#ff8a5b',
    external: true,
  },
  {
    label: 'Liteyuki Studio',
    href: 'https://github.com/LiteyukiStudio',
    description: '长期关注和参与的组织入口之一。',
    tag: 'Org',
    accent: '#4bb7a8',
    external: true,
  },
  {
    label: 'Sea Lantern Studio',
    href: 'https://github.com/SeaLantern-Studio',
    description: '另一个常驻组织，适合放近期项目导航。',
    tag: 'Org',
    accent: '#4d8ef7',
    external: true,
  },
  {
    label: 'SacredFeathers',
    href: 'https://github.com/SacredFeathers',
    description: '组织和协作入口，保留在首页便于快速跳转。',
    tag: 'Org',
    accent: '#ff4f88',
    external: true,
  },
];

export const sections: Section[] = [
  {
    kicker: 'Projects',
    title: '我常做的事',
    description: '把技能和兴趣转成可浏览、可维护的内容入口。',
    items: [
      {
        label: '文档整理',
        href: '#',
        description: '适合后续接入作品集、写作样例或知识库索引。',
        tag: 'Docs',
        accent: '#ff8a5b',
      },
      {
        label: '编程学习',
        href: '#',
        description: '可以继续扩展成语言分类、练习记录和实验项目入口。',
        tag: 'Code',
        accent: '#4d8ef7',
      },
      {
        label: '可爱小项目',
        href: '#',
        description: '适合挂 bot、图案设计或其他偏个人向内容。',
        tag: 'Fun',
        accent: '#ff4f88',
      },
    ],
  },
  {
    kicker: 'Workflow',
    title: '当前工具链',
    description: '页面本身是静态站，但工程约束要尽量完整。',
    items: [
      {
        label: 'Astro',
        href: 'https://astro.build/',
        description: '负责静态生成和轻量模板层。',
        tag: 'SSG',
        accent: '#4bb7a8',
        external: true,
      },
      {
        label: 'GitHub Actions',
        href: 'https://docs.github.com/actions',
        description: '统一承担校验和 Pages 部署。',
        tag: 'CI',
        accent: '#4d8ef7',
        external: true,
      },
      {
        label: 'Knip / Dependabot',
        href: 'https://knip.dev/',
        description: '分别负责未使用依赖和依赖版本更新提醒。',
        tag: 'Deps',
        accent: '#ff8a5b',
        external: true,
      },
    ],
  },
];

export const contacts: Contact[] = [
  {
    label: 'Outlook',
    value: 'naloveyuki09@outlook.com',
    href: 'mailto:naloveyuki09@outlook.com',
  },
  {
    label: 'QQ 邮箱',
    value: '3541766758@qq.com',
    href: 'mailto:3541766758@qq.com',
  },
  {
    label: 'QQ',
    value: '3541766758',
    href: 'https://qm.qq.com/',
    external: true,
  },
] as const;
