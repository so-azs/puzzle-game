
import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, Difficulty } from "../types.ts";
import { CONFIG } from "../lib/config.ts";

const getAiClient = () => {
  if (!CONFIG.GEMINI_API_KEY) return null;
  return new GoogleGenAI({ apiKey: CONFIG.GEMINI_API_KEY });
};

export const fetchRiddles = async (difficulty: Difficulty): Promise<Riddle[]> => {
  const ai = getAiClient();
  if (!ai) throw new Error("API Key missing");

  const prompt = `أنت مصمم ألعاب ذكاء محترف. ولد 5 ألغاز عربية بمستوى ${difficulty}.
  اجعل الأسئلة قصيرة ومثيرة.
  التنسيق: JSON.
  الحقول: question, options (4), correctIndex, explanation.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [{
      question: "ما هو الشيء الذي تذبحه وتبكي عليه؟",
      options: ["البصل", "الثوم", "البطيخ", "الليمون"],
      correctIndex: 0,
      explanation: "البصل يفرز غازات تسبب الدموع عند قطعه!"
    }];
  }
};

export const getAIHint = async (question: string, correctAnswer: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "حاول التفكير بعمق!";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
      contents: `أعطني تلميحة ذكية ومشفرة (بدون ذكر الإجابة) للغز التالي: "${question}". الإجابة هي "${correctAnswer}". اجعل التلميحة في جملة واحدة قصيرة جداً ومشوقة.`
    });
    return response.text?.trim() || "تفكير ذكي يقود للحل!";
  } catch {
    return "الإجابة أقرب مما تتصور!";
  }
};
