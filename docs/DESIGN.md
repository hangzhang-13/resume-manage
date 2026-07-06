# 面试简历管理系统设计文档

## Vibe
- 科技感十足的人力资源管理系统，采用赛博科技风格，以蓝紫渐变色为主色调，结合毛玻璃（glassmorphism）效果，营造现代、智能、前卫的视觉感受

## Color
- Primary: #6366f1 (靛蓝色，核心科技色)
- On Primary: #ffffff
- Accent: #8b5cf6 (紫罗兰色，交互强调)
- On Accent: #ffffff
- Background: #f0f4ff (浅蓝紫背景)
- Foreground: #0f172a (深灰黑)
- Muted: rgba(255,255,255,0.6) (毛玻璃半透明)
- Border: rgba(99,102,241,0.2) (紫蓝半透明边框)
- Surface: rgba(255,255,255,0.15) (毛玻璃表面)
- Gradient Start: #6366f1 (靛蓝)
- Gradient End: #8b5cf6 (紫罗兰)
- Gradient Accent: #06b6d4 (青色点缀)

## Typography
- Heading: Inter (family: 'Inter', weight: 600, url: https://fonts.googleapis.com/css2?family=Inter:wght@600&display=swap)
- Body: Inter (family: 'Inter', weight: 400, url: https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap)

## Visual Language
- 核心视觉签名：带有毛玻璃效果的侧边栏 + 渐变背景的内容区，整体呈蓝紫科技色调
- 材质与深度：卡片使用 backdrop-blur 毛玻璃效果 + 半透明白色背景 + 发光边框
- 容器与按钮：圆角卡片容器（radius 12px+），主按钮使用渐变背景，次按钮使用毛玻璃 outline 样式
- 布局节奏：侧边栏半透明深色 + 内容区渐变背景，表格行使用科技风格分隔线
- 装饰元素：角落微光粒子效果、顶部渐变横幅

## Animation
- 入场：内容区淡入上浮效果（fade-in-up），卡片交错入场
- 交互：按钮 hover 时发光效果，表格行 hover 时蓝色微光
- 滚动/过渡：上传进度条平滑流动动画，毛玻璃 shimmer 微动

## Forbidden
- 禁止使用纯色扁平色块（必须使用渐变或毛玻璃）
- 禁止使用默认灰色表格（必须使用科技感边框和发光效果）
- 禁止使用传统实心按钮（必须使用毛玻璃或渐变按钮）

## Additional Notes
- 所有用户可见文案使用中文
- 表格支持横向滚动以适应多列数据
- 上传区域使用毛玻璃拖拽样式设计
- 整体页面使用蓝紫渐变背景底色