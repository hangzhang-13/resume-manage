export function normalizeResumeText(text: string): string {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r/g, "")
    .replace(/ /g, " ")
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        .replace(/\s*([:/：,，;；、()（）[\]【】])\s*/g, "$1")
        .replace(/(\d)\s+([年月日天次级岁人份页号%])/g, "$1$2")
        .replace(/([年月日天次级岁人份页号%])\s+(\d)/g, "$1$2")
        .replace(/([\p{Script=Han}⺀-⿟])\s+([A-Za-z0-9])/gu, "$1$2")
        .replace(/([A-Za-z0-9])\s+([\p{Script=Han}⺀-⿟])/gu, "$1$2")
        .replace(/([\p{Script=Han}⺀-⿟])\s+([\p{Script=Han}⺀-⿟])/gu, "$1$2")
        .trim()
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitByCommonDelimiters(text: string): string {
  return text
    .replace(/\s*(?:;|；|\|)\s*/g, "\n")
    .replace(/\s*[、]\s*(?=[\p{Script=Han}⺀-⿟A-Za-z]{2,}(?:公司|集团|大学|学院|科技|网络|网讯|有限|股份|实验室|中心|研究院))/gu, "\n");
}

export function normalizeWorkHistoryText(text: string): string {
  return splitByCommonDelimiters(normalizeResumeText(text))
    // 在完整时间段后、紧跟非空白非数字字符时拆行
    // 支持: 2020.12-至今、2020/01–2023.06、2020.12至今（无分隔符直接跟"至今"）
    .replace(/(\d{4}[.\/]\d{1,2}\s*[-–—~]?\s*(?:至今|\d{4}[.\/]\d{1,2}))(?=[^\s\d])/g, "$1\n")
    .replace(/(\d{4}年\d{1,2}月\s*[-–—~]?\s*(?:至今|\d{4}年\d{1,2}月))(?=[^\s\d])/g, "$1\n")
    .replace(/(\d{4}\s*[-–—~]?\s*(?:至今|\d{4}))(?=[^\s\d])/g, "$1\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function normalizeEducationText(text: string): string {
  return splitByCommonDelimiters(normalizeResumeText(text))
    // 学历层次后紧跟非换行字符时拆行（本科/硕士/博士/学士等之后换行）
    // 注意：先尝试匹配长词（硕士研究生），避免"硕士"误拆"硕士研究生"
    // 使用 (?=.|\n) 或直接在学历词后检查：如果后面有字符且不是标点/空白则换行
    .replace(/(博士后|博士|硕士研究生|硕士|本科|学士|大专|高中|中专)(?=[^\s\n,，;；、)）\]\n])/gu, (match, degree, offset, str) => {
      // 如果匹配到"硕士"但后面实际是"研究生"，说明原文是"硕士研究生"，不应拆分
      if (degree === "硕士" && str.slice(offset + 2).startsWith("研究生")) return match;
      // 如果匹配到"博士"但后面实际是"后"，说明原文是"博士后"，不应拆分
      if (degree === "博士" && str[offset + 2] === "后") return match;
      return degree + "\n";
    })
    // 在完整时间段后拆行
    .replace(/(\d{4}[.\/]\d{1,2}\s*[-–—~]?\s*(?:至今|\d{4}[.\/]\d{1,2}))(?=[^\s\d])/g, "$1\n")
    .replace(/(\d{4}年\d{1,2}月\s*[-–—~]?\s*(?:至今|\d{4}年\d{1,2}月))(?=[^\s\d])/g, "$1\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
