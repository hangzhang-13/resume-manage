export interface PdfTextItemLike {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

const SINGLE_CHARACTER_SURNAMES = new Set(
  Array.from(
    "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉龚程嵇邢滑裴陆荣翁荀羊甄曲封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲台从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公"
  ),
);

const COMPOUND_SURNAMES = [
  "欧阳", "太史", "端木", "上官", "司马", "东方", "独孤", "南宫", "万俟", "闻人",
  "夏侯", "诸葛", "尉迟", "公羊", "赫连", "澹台", "皇甫", "宗政", "濮阳", "公冶",
  "太叔", "申屠", "公孙", "慕容", "仲孙", "钟离", "长孙", "宇文", "司徒", "鲜于",
  "司空", "闾丘", "子车", "亓官", "司寇", "巫马", "公西", "颛孙", "壤驷", "公良",
  "漆雕", "乐正", "宰父", "谷梁", "拓跋", "夹谷", "轩辕", "令狐", "段干", "百里",
  "呼延", "东郭", "南门", "羊舌", "微生", "梁丘", "左丘", "东门", "西门", "第五",
];

const NON_NAME_HEADINGS = new Set([
  "个人简历", "求职简历", "应聘简历", "中文简历", "基本信息", "个人信息", "个人总结", "个人简介",
  "工作经历", "工作经验", "教育背景", "联系方式", "求职意向", "应聘岗位", "产品专家", "产品经理",
]);

export function normalizeChineseCandidateName(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/^姓名\s*[:：]?\s*/u, "")
    .replace(/[\s·•・]+/gu, "")
    .trim();
}

export function isLikelyChineseCandidateName(value: string): boolean {
  const name = normalizeChineseCandidateName(value);
  if (!/^[\p{Script=Han}]{2,4}$/u.test(name) || NON_NAME_HEADINGS.has(name)) return false;
  return COMPOUND_SURNAMES.some((surname) => name.startsWith(surname)) || SINGLE_CHARACTER_SURNAMES.has(name[0]);
}

export function inferCandidateNameFromFileName(fileName: string): string {
  const baseName = String(fileName || "").normalize("NFKC").replace(/\.[^.]+$/, "");
  const standardMatch = baseName.match(/(?:^|[-_])(?:C\d+[-_])?([\p{Script=Han}]{2,4})(?=[-_](?:原始)?简历)/u);
  if (standardMatch && isLikelyChineseCandidateName(standardMatch[1])) return standardMatch[1];

  const directMatch = baseName.match(/^([\p{Script=Han}]{2,4})(?:[-_\s]+(?:个人)?简历|[-_\s]+(?:AI|产品|应聘))/u);
  return directMatch && isLikelyChineseCandidateName(directMatch[1]) ? directMatch[1] : "";
}

export function inferCandidateNameFromPdfTitle(title: string): string {
  const normalizedTitle = String(title || "").normalize("NFKC").trim();
  const match = normalizedTitle.match(/^([\p{Script=Han}]{2,4})(?=\s*(?:[-_\s]+)?(?:个人)?简历)/u);
  return match && isLikelyChineseCandidateName(match[1]) ? match[1] : "";
}

function extractNameFromPdfItem(text: string): string {
  const normalized = String(text || "").normalize("NFKC").trim();
  const labelled = normalized.match(/^姓名\s*[:：]?\s*([\p{Script=Han}]{2,4})$/u);
  if (labelled && isLikelyChineseCandidateName(labelled[1])) return labelled[1];

  const standalone = normalized.match(/^([\p{Script=Han}]{2,4})(?:\s+[A-Za-z][A-Za-z .'-]{1,40})?$/u);
  return standalone && isLikelyChineseCandidateName(standalone[1]) ? standalone[1] : "";
}

export function inferCandidateNameFromPdfItems(
  items: PdfTextItemLike[],
  pageWidth: number,
  pageHeight: number,
): string {
  let bestName = "";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    const name = extractNameFromPdfItem(item.str);
    if (!name || item.transform.length < 6) continue;

    const x = Number(item.transform[4] || 0);
    const y = Number(item.transform[5] || 0);
    const fontSize = Math.max(
      Number(item.height || 0),
      Math.hypot(Number(item.transform[2] || 0), Number(item.transform[3] || 0)),
    );

    // 简历姓名通常位于第一页顶部。限制在上半页可以排除公司、学校等正文实体。
    if (pageHeight > 0 && y < pageHeight * 0.55) continue;
    const score = fontSize * 10 + (pageHeight > 0 ? (y / pageHeight) * 30 : 0) - (pageWidth > 0 ? (x / pageWidth) * 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  }

  return bestName;
}
