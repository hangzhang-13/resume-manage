import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OcrResult {
  words_result: Array<{ words: string }>;
  error_code: number;
  error_msg: string;
}

interface ResumeData {
  interview_date: string;
  department: string;
  name: string;
  status: string;
  nature: string;
  position: string;
  age_experience: string;
  job_level: string;
  work_history: string;
  education: string;
  interview_comment: string;
}

interface ResumeRecord extends ResumeData {
  id: string;
  resume_file_url: string;
  resume_file_name: string;
}

function normalizeResumeText(text: string): string {
  return String(text || "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitByCommonDelimiters(text: string): string {
  return text
    .replace(/\s*(?:;|；|\|)\s*/g, "\n")
    .replace(/\s*[、]\s*(?=[\p{Script=Han}\u2E80-\u2FDFA-Za-z]{2,}(?:公司|集团|大学|学院|科技|网络|网讯|有限|股份|实验室|中心|研究院))/gu, "\n");
}

function normalizeWorkHistoryText(text: string): string {
  return splitByCommonDelimiters(normalizeResumeText(text))
    .replace(/(\d{4}[\./]\d{1,2}\s*[-–—~]?\s*(?:至今|\d{4}[\./]\d{1,2}))(?=[^\s\d])/g, "$1\n")
    .replace(/(\d{4}年\d{1,2}月\s*[-–—~]?\s*(?:至今|\d{4}年\d{1,2}月))(?=[^\s\d])/g, "$1\n")
    .replace(/(\d{4}\s*[-–—~]?\s*(?:至今|\d{4}))(?=[^\s\d])/g, "$1\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeEducationText(text: string): string {
  return splitByCommonDelimiters(normalizeResumeText(text))
    // 学历层次后紧跟非换行字符时拆行（本科/硕士/博士/学士等之后换行）
    .replace(/(博士后|博士|硕士研究生|硕士|本科|学士|大专|高中|中专)(?=[^\s\n,，;；、)）\]\n])/gu, "$1\n")
    .replace(/(\d{4}[\.\/]\d{1,2}\s*[-–—~至到]\s*(?:至今|\d{4}[\.\/]\d{1,2}))(?=\S)/g, "$1\n")
    .replace(/(\d{4}年\d{1,2}月\s*[-–—~至到]\s*(?:至今|\d{4}年\d{1,2}月))(?=\S)/g, "$1\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}


serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let fileUrl: string | undefined;
  let fileName: string;
  let text: string | undefined;
  let force: boolean;
  let preview: boolean;
  let duplicateData: ResumeData | undefined;

  try {
    const body = await req.json();
    fileUrl = body.file_url;
    fileName = body.file_name || "resume";
    text = body.text;
    force = body.force === true;
    preview = body.preview === true;
    duplicateData = body.duplicate_data;
    if (!fileUrl && !text) throw new Error("Missing file_url or text");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let resumeData: ResumeData;

    if (duplicateData) {
      // 用户确认重复后，直接使用之前提取的数据保存
      resumeData = duplicateData;
    } else {
      let extractText = "";

      if (text && text.trim().length > 0) {
        extractText = cleanText(text);
      } else if (fileUrl) {
        const fileData = await downloadResumeFile(supabase, fileUrl);
        const contentType = fileData.contentType;
        const isImage = contentType.startsWith("image/");

        if (isImage) {
          const arrayBuffer = await fileData.blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          const imageBase64 = btoa(binary);

          const ocrResult = await callOcr(apiKey, imageBase64);
          if (ocrResult.error_code !== 0) {
            throw new Error(`OCR error: ${ocrResult.error_msg}`);
          }
          extractText = cleanText(ocrResult.words_result?.map((w) => w.words).join("\n") || "");
        } else {
          extractText = `[文件: ${fileName}]`;
        }
      }

      if (!extractText || extractText.trim().length === 0) {
        throw new Error("无法从文件中提取文字内容");
      }

      resumeData = await extractResumeInfo(apiKey, extractText);
    }

    if (preview) {
      return new Response(JSON.stringify({ success: true, preview: true, data: resumeData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 检查是否重复（如果不是 force 模式）
    if (!force && resumeData.name && resumeData.name !== "提取失败" && resumeData.name !== "未知") {
      const { data: existing, error: checkError } = await supabase
        .from("resumes")
        .select("*")
        .ilike("name", resumeData.name)
        .limit(1);

      if (checkError) throw new Error(`Database check error: ${checkError.message}`);

      if (existing && existing.length > 0) {
        const mergedResume = mergeResumeData(existing[0] as ResumeRecord, resumeData, fileUrl, fileName);
        const { data: mergedData, error: mergeError } = await supabase
          .from("resumes")
          .update(mergedResume)
          .eq("id", existing[0].id)
          .select()
          .single();

        if (mergeError) throw new Error(`Database merge error: ${mergeError.message}`);

        return new Response(JSON.stringify({
          success: true,
          duplicate: true,
          merged: true,
          name: resumeData.name,
          mergedIntoId: existing[0].id,
          data: mergedData,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 格式化面试日期为 YYYY-MM-DD
    resumeData.interview_date = normalizeDate(resumeData.interview_date);

    // 保存到数据库
    const { data, error } = await supabase
      .from("resumes")
      .insert({
        ...resumeData,
        resume_file_url: fileUrl || "",
        resume_file_name: fileName,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function downloadResumeFile(
  supabase: ReturnType<typeof createClient>,
  fileReference: string,
): Promise<{ blob: Blob; contentType: string }> {
  if (/^https?:\/\//i.test(fileReference)) {
    const fileResponse = await fetch(fileReference);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status}`);
    }
    return {
      blob: await fileResponse.blob(),
      contentType: fileResponse.headers.get("content-type") || "",
    };
  }

  const { data, error } = await supabase.storage
    .from("resumes")
    .download(fileReference);

  if (error || !data) {
    throw new Error(`Failed to download file: ${error?.message || "not found"}`);
  }

  return {
    blob: data,
    contentType: data.type || "",
  };
}

async function callOcr(apiKey: string, imageBase64: string): Promise<OcrResult> {
  const params = new URLSearchParams({ image: imageBase64, language_type: "CHN_ENG" });
  const response = await fetch(
    "https://app-cjf7826emyv5-api-eLMlJ2jB44g9-gateway.appmiaoda.com/rest/2.0/ocr/v1/accurate_basic",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: params.toString(),
    }
  );
  return await response.json();
}

// 清除文本中的噪声空格，避免姓名、公司名、年限等字段被拆开。
function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*([:/：,，;；、()（）[\]【】])\s*/g, "$1")
    .replace(/(\d)\s+([年月日天次级岁人份页号%])/g, "$1$2")
    .replace(/([年月日天次级岁人份页号%])\s+(\d)/g, "$1$2")
    .replace(/([\u4e00-\u9fa5])\s+([A-Za-z0-9])/g, "$1$2")
    .replace(/([A-Za-z0-9])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countFilledFields(data: ResumeData | ResumeRecord): number {
  return Object.entries(data).reduce((total, [key, value]) => {
    if (key === "id" || key === "resume_file_url" || key === "resume_file_name") return total;
    return typeof value === "string" && value.trim() ? total + 1 : total;
  }, 0);
}

function chooseBetterText(currentValue: string, incomingValue: string): string {
  const currentText = cleanText(currentValue || "");
  const incomingText = cleanText(incomingValue || "");
  if (!currentText) return incomingText;
  if (!incomingText) return currentText;
  return incomingText.length > currentText.length ? incomingText : currentText;
}

function mergeResumeData(
  existing: ResumeRecord,
  incoming: ResumeData,
  fileUrl?: string,
  fileName?: string,
): Partial<ResumeRecord> {
  const merged: Partial<ResumeRecord> = {};
  const mergedFields: Array<keyof ResumeData> = [
    "interview_date",
    "department",
    "name",
    "status",
    "nature",
    "position",
    "age_experience",
    "job_level",
    "work_history",
    "education",
    "interview_comment",
  ];

  const existingScore = countFilledFields(existing);
  const incomingScore = countFilledFields(incoming);

  for (const field of mergedFields) {
    const existingValue = existing[field] || "";
    const incomingValue = incoming[field] || "";
    if (incomingScore > existingScore) {
      merged[field] = chooseBetterText(incomingValue, existingValue);
    } else {
      merged[field] = chooseBetterText(existingValue, incomingValue);
    }
  }

  merged.resume_file_url = fileUrl || existing.resume_file_url;
  merged.resume_file_name = fileName || existing.resume_file_name;
  return merged;
}

function extractPositionFromWorkHistory(workHistory: string): string {
  const firstLine = workHistory.split(/\\n|\n|\r\n/)[0]?.trim();
  if (!firstLine) return "";
  const parts = firstLine.split("-");
  if (parts.length >= 2) {
    return parts[1]?.trim() || "";
  }
  return "";
}

function inferNature(workHistory: string): string {
  // 性质推断规则：
  // - 最近一份履历在百度 → 内转
  // - 曾经在百度工作过，但最近不在百度 → 回流
  // - 从未在百度工作过 → 社招
  if (!workHistory) return "社招";
  const lines = workHistory.split(/\\n|\n|\r\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "社招";

  const companyNames = lines.map((line) => {
    const parts = line.split("-");
    return parts[0]?.trim() || "";
  });

  const firstCompany = companyNames[0];
  const hasBaiduEver = companyNames.some((c) => c.includes("百度"));
  const isBaiduNow = firstCompany.includes("百度");

  if (isBaiduNow) return "内转";
  if (hasBaiduEver) return "回流";
  return "社招";
}

async function extractResumeInfo(apiKey: string, ocrText: string): Promise<ResumeData> {
  const prompt = `你是一个简历信息提取助手。请从以下简历文本中提取关键信息，并严格按照 JSON 格式返回。

格式要求：
- work_history: 工作履历，按倒序排列（最近的工作经历放在第一位），只提取 "公司名称-职位-时间段"，每条履历占一行，多条履历用换行符\\n分隔。绝对不要包含学校/教育经历、工作职责、项目描述、解释性文字或括号注释。如果只有一份工作经历就只输出一条。例如：
  字节跳动-前端专家-2023.07-至今\\n阿里巴巴-高级前端工程师-2020.03-2023.06
- education: 学历，只提取 "学校名称-学历层次"，每条学历占一行，多条学历用换行符\\n分隔。不要包含专业信息。例如：
  北京大学-硕士\\n北京大学-本科

重要规则：
- work_history 和 education 是完全独立的字段，学校信息只能出现在 education 中，绝对不能出现在 work_history 中
- 所有字段只输出提取到的原始信息，不要添加任何解释、注释或括号说明
- 如果某个字段提取不到内容，返回空字符串，不要编造或补充

需要提取的字段：
- interview_date: 面试时间（如果文本中没有，返回空字符串）
- department: 用人部门（如果文本中没有，返回空字符串）
- name: 姓名（必须提取）
- status: 状态（如：待面试、已面试等，如果没有返回空字符串）
- nature: 性质（按以下规则自动判断：最近一份履历在百度写"内转"，曾经在百度但最近不在写"回流"，从未在百度写"社招"）
- position: 职位/应聘岗位（如果没有明确写出，可以从工作履历中最近一份工作的职位推断）
- age_experience: 年龄/工作经验（如："28岁/5年"）
- job_level: 职级（如果没有返回空字符串）
- work_history: 工作履历（严格按倒序"公司-职位-时间"格式，每条一行，多行用\\n分隔，不包含学校信息）
- education: 学历（严格按"学校-学历"格式，每条一行，多行用\\n分隔）
- interview_comment: 面评（如果没有返回空字符串）

简历文本：
${ocrText}

请只返回 JSON 对象，不要包含其他内容。`;

  const response = await fetch(
    "https://app-cjf7826emyv5-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder("utf8");
  let fullContent = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") break;
      try {
        const chunk = JSON.parse(raw);
        fullContent += chunk.choices?.[0]?.delta?.content ?? "";
      } catch {
        // 跳过
      }
    }
  }

  // 解析 JSON
  let result: ResumeData;
  try {
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      result = {
        interview_date: parsed.interview_date || "",
        department: parsed.department || "",
        name: parsed.name || "未知",
        status: parsed.status || "",
        nature: parsed.nature || "",
        position: parsed.position || "",
        age_experience: parsed.age_experience || "",
        job_level: parsed.job_level || "",
        work_history: normalizeWorkHistoryText(parsed.work_history || ""),
        education: normalizeEducationText(parsed.education || ""),
        interview_comment: parsed.interview_comment || "",
      };
    } else {
      throw new Error("No JSON found");
    }
  } catch {
    result = {
      interview_date: "", department: "", name: "提取失败", status: "", nature: "",
      position: "", age_experience: "", job_level: "", work_history: "",
      education: "", interview_comment: "",
    };
  }

  // 对所有中文字段进行空格清理（跳过已专门格式化的 work_history 和 education）
  const skipCleanTextFields: Set<keyof ResumeData> = new Set(["work_history", "education"]);
  (Object.keys(result) as Array<keyof ResumeData>).forEach((key) => {
    if (typeof result[key] === "string" && !skipCleanTextFields.has(key)) {
      result[key] = cleanText(result[key]);
    }
  });

  // 如果 position 为空但 work_history 有内容，从最近履历自动提取职位
  if (!result.position && result.work_history) {
    const inferredPosition = extractPositionFromWorkHistory(result.work_history);
    if (inferredPosition) {
      result.position = inferredPosition;
    }
  }

  // 自动推断 nature（性质）
  if (!result.nature && result.work_history) {
    result.nature = inferNature(result.work_history);
  } else if (!result.nature) {
    result.nature = "社招";
  }

  return result;
}

// 将各种日期格式统一为 YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return "";
  let d = dateStr.trim();
  // 去掉时间部分（如 14:30、上午、下午等）
  d = d.replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM|上午|下午))?/i, "");
  // 匹配中文格式：2025年1月15日
  const cnMatch = d.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?/);
  if (cnMatch) {
    const [, y, m, day] = cnMatch;
    return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // 匹配 ISO 格式：2025-01-15 或 2025/1/15 或 2025.1.15
  const isoMatch = d.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, day] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return d;
}
