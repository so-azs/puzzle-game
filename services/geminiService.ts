
import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, Difficulty } from "../types.ts";
import { CONFIG } from "../lib/config.ts";

// استخدام المفتاح من الملف المركزي الموحد
const ai = new GoogleGenAI({ apiKey: CONFIG.GEMINI_API_KEY });

export const fetchRiddles = async (difficulty: Difficulty): Promise<Riddle[]> => {
  const prompt = `أنت خبير لغوي عربي ومصمم ألغاز بارع. 
  قم بتوليد 5 ألغاز ذكية وشيقة باللغة العربية الفصحى بمستوى صعوبة (${difficulty}).
  قم بتقديم النتيجة بصيغة JSON حصراً بالهيكل التالي:
  [
    {
      "question": "نص اللغز هنا؟",
      "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
      "correctIndex": 0,
      "explanation": "شرح مبسط وجميل للإجابة الصحيحة"
    }
  ]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }
              },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        },
        temperature: 0.8,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No data");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return [
      {
        question: "ما هو الشيء الذي تراه في الليل ثلاث مرات وفي النهار مرة واحدة؟",
        options: ["حرف اللام", "القمر", "النجوم", "الظلام"],
        correctIndex: 0,
        explanation: "حرف اللام موجود في كلمة 'الليل' مرتين وفي كلمة 'ليلة' مرة، ولا يوجد في 'نهار'."
      }
    ];
  }
};
