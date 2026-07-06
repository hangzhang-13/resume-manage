import { normalizeResumeText } from "@/lib/resume-text";

const COMPETITOR_CONFIG = [
  { label: "腾讯", logo: "/logos/tencent.svg", keywords: ["腾讯", "Tencent"], tone: "bg-sky-100 text-sky-700 border-sky-200" },
  { label: "阿里", logo: "/logos/alibaba.svg", keywords: ["阿里巴巴", "阿里", "Alibaba", "蚂蚁", "支付宝", "Ant", "高德"], tone: "bg-orange-100 text-orange-700 border-orange-200" },
  { label: "字节", logo: "/logos/bytedance.svg", keywords: ["字节跳动", "字节", "Bytedance", "ByteDance", "TikTok"], tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { label: "滴滴", logo: "/logos/didi.svg", keywords: ["滴滴", "DiDi", "Didi"], tone: "bg-amber-100 text-amber-700 border-amber-200" },
  { label: "快手", logo: "/logos/kuaishou.svg", keywords: ["快手", "Kuaishou"], tone: "bg-violet-100 text-violet-700 border-violet-200" },
  { label: "美团", logo: "/logos/meituan.svg", keywords: ["美团", "Meituan"], tone: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { label: "京东", logo: "/logos/jd.svg", keywords: ["京东", "JD"], tone: "bg-rose-100 text-rose-700 border-rose-200" },
  { label: "拼多多", logo: "/logos/pinduoduo.svg", keywords: ["拼多多", "PDD"], tone: "bg-pink-100 text-pink-700 border-pink-200" },
  { label: "小红书", logo: "/logos/xiaohongshu.svg", keywords: ["小红书", "Red", "RED"], tone: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" },
  { label: "网易", logo: "/logos/netease.svg", keywords: ["网易", "NetEase"], tone: "bg-cyan-100 text-cyan-700 border-cyan-200" },
] as const;

export interface CompetitorTag {
  label: string;
  tone: string;
  logo: string;
}

export function getCompetitorStyle(label: string) {
  return COMPETITOR_CONFIG.find((competitor) => competitor.label === label);
}

/**
 * 竞品标签提取 —— 严格匹配策略：
 *
 * 1. 只在公司名部分匹配（第一个"-"之前），排除职位和时间段的干扰
 * 2. 中文关键词：检查关键词前一个字 + 关键词首字是否构成已知城市名
 *    - "北京东润" → "北"+"京" = "北京"(城市) → "京东"是地名断词产物 → 排除
 *    - "南京东软" → "南"+"京" = "南京"(城市) → "京东"是地名断词产物 → 排除
 *    - "杭州阿里巴巴" → "州"+"阿" = "州阿"(不是城市) → "阿里"正常匹配 ✓
 *    - "深圳市腾讯" → "市"+"腾" = "市腾"(不是城市) → "腾讯"正常匹配 ✓
 * 3. 英文关键词：使用单词边界 \b 匹配，防止子串误匹配
 */

// 已知中国城市名（2字），用于排除地名切分误匹配
const KNOWN_CITIES = new Set([
  "北京", "南京", "东京", "上海", "天津", "重庆",
  "广州", "深圳", "杭州", "成都", "武汉", "西安",
  "苏州", "长沙", "郑州", "青岛", "大连", "厦门",
  "宁波", "无锡", "合肥", "济南", "福州", "昆明",
  "贵阳", "太原", "南昌", "长春", "沈阳", "兰州",
  "海口", "银川", "西宁", "拉萨", "南宁", "哈尔",
]);

function isCityBoundaryFalsePositive(text: string, keywordIdx: number, keyword: string): boolean {
  // 关键词在开头，不可能是地名切分
  if (keywordIdx === 0) return false;
  // 取前一个字 + 关键词第一个字，看是否恰好是已知城市名
  // 例如 text="北京东润", keyword="京东", idx=1:
  //   charBefore = "北", keyword[0] = "京" → "北京" 是城市 → 误匹配
  const candidate = text[keywordIdx - 1] + keyword[0];
  return KNOWN_CITIES.has(candidate);
}

export function extractCompetitorTags(workHistory?: string): CompetitorTag[] {
  if (!workHistory) return [];

  const lines = normalizeResumeText(workHistory)
    .split(/\n|\r\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tags: CompetitorTag[] = [];
  for (const line of lines) {
    // 提取公司名部分：取第一个 "-" 前的内容
    const dashIdx = line.indexOf("-");
    const companyPart = dashIdx > 0 ? line.slice(0, dashIdx) : line;

    for (const competitor of COMPETITOR_CONFIG) {
      if (tags.some((tag) => tag.label === competitor.label)) continue;
      const matched = competitor.keywords.some((keyword) => {
        // 英文关键词：用单词边界正则匹配
        if (/^[A-Za-z]/.test(keyword)) {
          return new RegExp(`\\b${keyword}\\b`, "i").test(companyPart);
        }
        // 中文关键词
        const idx = companyPart.indexOf(keyword);
        if (idx === -1) return false;
        // 检查是否因城市地名导致的误匹配
        if (isCityBoundaryFalsePositive(companyPart, idx, keyword)) return false;
        return true;
      });
      if (matched) {
        tags.push({ label: competitor.label, tone: competitor.tone, logo: competitor.logo });
      }
    }
  }

  return tags;
}
