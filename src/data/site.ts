export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};

export type LinkItem = {
  label: string;
  href: string;
  description: string;
  tag: string;
  accent: string;
  external?: boolean;
};

export type Section = {
  kicker: string;
  title: string;
  description: string;
  items: LinkItem[];
};

export type Contact = {
  label: string;
  value: string;
  href: string;
  external?: boolean;
};

export type Project = {
  name: string;
  summary: string;
  stack: string[];
  href: string;
  featured?: boolean;
};

export type AboutSection = {
  title: string;
  content: string[];
  links?: NavItem[];
};

export type TimelineItem = {
  period: string;
  title: string;
  description: string;
};

export const profile = {
  name: '洛柠 Naloveyuki',
  tagline: '写文档、写代码，也认真经营表达和兴趣的人。',
  summary:
    '你好，我是洛柠 Naloveyuki。一名仍在学习中的创作者，喜欢把复杂的内容整理清楚，也喜欢把项目、文字和兴趣做得更完整。',
  description: 'Naloveyuki 的个人主页，面向访客介绍本人、项目、文章入口与联系方式。',
  status: 'INFP / 高中生 / 文档爱好者',
  mood: '正在学习编程、写作与内容整理，希望把想法和作品讲清楚。',
  github: {
    href: 'https://github.com/Nanaloveyuki',
  },
  blog: {
    href: 'https://naloveyuki.top',
    repo: 'https://github.com/Nanaloveyuki/blog.me',
  },
} as const;

export const navLinks: NavItem[] = [
  { label: '首页', href: '/' },
  { label: '关于我', href: '/about' },
  { label: '项目', href: '/projects' },
  { label: '博客', href: '/blog' },
];

export const socialLinks: NavItem[] = [
  { label: 'GitHub', href: profile.github.href, external: true },
  { label: 'Blog Repo', href: profile.blog.repo, external: true },
  { label: 'Email', href: 'mailto:naloveyuki09@outlook.com' },
];

export const quickFacts = [
  { label: '昵称', value: '洛柠 Naloveyuki' },
  { label: '关注方向', value: '文档写作、编程语言、计算机知识整理' },
  { label: '擅长内容', value: 'Markdown / Word / 内容整理' },
  { label: '日常兴趣', value: 'Minecraft、折腾工具、把想法做成页面' },
] as const;

export const skills = ['Markdown', 'Word', 'Rust', 'Python', 'Golang', 'C#', 'MoonBit'] as const;

export const featuredLinks: LinkItem[] = [
  {
    label: 'GitHub 主页',
    href: profile.github.href,
    description: '公开项目、提交记录和正在进行的折腾都从这里展开。',
    tag: 'Profile',
    accent: '#ff8a5b',
    external: true,
  },
  {
    label: '独立博客',
    href: '/blog',
    description: '文章、随笔和更完整的表达，统一从这里进入。',
    tag: 'Blog',
    accent: '#4d8ef7',
  },
  {
    label: 'Liteyuki Studio',
    href: 'https://github.com/LiteyukiStudio',
    description: '我持续关注和参与的公开组织之一。',
    tag: 'Org',
    accent: '#4bb7a8',
    external: true,
  },
  {
    label: 'Sea Lantern Studio',
    href: 'https://github.com/SeaLantern-Studio',
    description: '另一个长期关注的组织，也能看到我参与过的项目。',
    tag: 'Org',
    accent: '#ff4f88',
    external: true,
  },
];

export const sections: Section[] = [
  {
    kicker: 'Profile',
    title: '继续了解我',
    description: '如果你想更系统地认识我，可以从这几个入口继续往下看。',
    items: [
      {
        label: '关于我',
        href: '/about',
        description: '集中查看我的基本信息、擅长方向和成长轨迹。',
        tag: 'Profile',
        accent: '#ff8a5b',
      },
      {
        label: '项目展示',
        href: '/projects',
        description: '浏览我公开展示的项目和正在关注的工作方向。',
        tag: 'Work',
        accent: '#4d8ef7',
      },
      {
        label: '博客入口',
        href: '/blog',
        description: '阅读文章、随笔和更偏个人表达的内容。',
        tag: 'Entry',
        accent: '#4bb7a8',
      },
    ],
  },
  {
    kicker: 'Traits',
    title: '我在做的事',
    description: '这里不是完整简历，而是我当前比较稳定的兴趣和投入方向。',
    items: [
      {
        label: '写文档和整理内容',
        href: '/about',
        description: '我喜欢把复杂事情讲明白，也愿意把细节整理到可读。',
        tag: 'Writing',
        accent: '#4bb7a8',
      },
      {
        label: '继续学编程语言',
        href: '/projects',
        description: '我会持续把学习中的理解和产出沉淀到项目里。',
        tag: 'Coding',
        accent: '#4d8ef7',
      },
      {
        label: '保持表达和作品输出',
        href: '/blog',
        description: '除了代码，我也在意文字、页面和更完整的个人表达。',
        tag: 'Output',
        accent: '#ff8a5b',
      },
    ],
  },
];

export const projects: Project[] = [
  {
    name: 'SeaLantern',
    summary:
      '基于 Vue + Rust + Tauri2 的 Minecraft 开服器管理工具，提供一站式服务器管理体验，支持多平台部署和插件生态。',
    stack: ['Vue', 'Rust', 'Tauri2', 'Minecraft'],
    href: 'https://github.com/SeaLantern-Studio/SeaLantern',
    featured: true,
  },
  {
    name: 'Liteyuki Studio Open Source LICENSE',
    summary: 'Liteyuki Studio 的开源协议仓库，用来整理和维护团队项目使用的许可文本。',
    stack: ['LICENSE', 'GitHub', 'Writing'],
    href: 'https://github.com/LiteyukiStudio/OpenSourceLICENSE',
    featured: true,
  },
];

export const aboutSections: AboutSection[] = [
  {
    title: '基本信息',
    content: [
      '昵称：洛柠 Naloveyuki',
      '身份：INFP、高中生、文档爱好者。',
      '关注：写文档、学习各种编程语言和计算机知识。',
      '擅长：把零散内容整理成更容易理解的结构。',
      '兴趣：除了写东西，也会和朋友一起玩 MC、折腾新工具。',
    ],
  },
  {
    title: '所在组织',
    content: ['常驻和关注中的公开组织入口。'],
    links: [
      { label: 'Liteyuki Studio', href: 'https://github.com/LiteyukiStudio', external: true },
      {
        label: 'Sea Lantern Studio',
        href: 'https://github.com/SeaLantern-Studio',
        external: true,
      },
      { label: 'SacredFeathers', href: 'https://github.com/SacredFeathers', external: true },
    ],
  },
  {
    title: '我擅长的事',
    content: [
      '如果内容需要被整理清楚、写得易读，我通常愿意花时间把它做好。',
      '我喜欢把复杂事情拆开，让信息结构更清晰，方便别人理解。',
      '我也会把学习中的想法继续沉淀成项目、页面和文章。',
    ],
  },
];

export const timeline: TimelineItem[] = [
  {
    period: 'Now',
    title: '持续整理个人表达',
    description: '把个人介绍、项目和文章入口分别整理清楚，让访客更容易快速了解我。',
  },
  {
    period: '最近',
    title: '继续学习各种编程语言',
    description: '一边学习，一边把理解慢慢沉淀成项目和可展示的内容。',
  },
  {
    period: '一直以来',
    title: '坚持写文档和表达',
    description: '比起堆砌标签，我更在意把真正理解的内容讲清楚、写明白。',
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
    label: 'GitHub',
    value: 'Nanaloveyuki',
    href: profile.github.href,
    external: true,
  },
  {
    label: 'QQ',
    value: '3541766758',
    href: 'https://qm.qq.com/q/C5eZkXtSpk',
    external: true,
  },
] as const;

export const notes = [
  '喜欢把信息整理得清晰、可读。',
  '持续学习编程语言，也持续输出文字和页面。',
  '项目、文章和联系方式都保留了清晰入口。',
  '如果你想进一步了解我，可以继续往下看。',
] as const;
