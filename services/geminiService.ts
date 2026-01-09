
import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, Difficulty } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchRiddles = async (difficulty: Difficulty): Promise<Riddle[]> => {
  const prompt = `أنت خبير في اللغة العربية والألغاز. قم بتوليد 5 ألغاز أو كلمات ناقصة باللغة العربية بمستوى صعوبة (${difficulty}). 
  يجب أن يكون اللغز ممتعاً ومفيداً.
  قم بتقديم النتيجة بصيغة JSON حصراً.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "نص اللغز أو الجملة الناقصة" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "أربعة خيارات للإجابة"
              },
              correctIndex: { type: Type.INTEGER, description: "مؤشر الإجابة الصحيحة (0-3)" },
              explanation: { type: Type.STRING, description: "شرح مبسط للإجابة الصحيحة" }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("لم يتم استلام بيانات من الذكاء الاصطناعي");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error fetching riddles:", error);
    // Fallback static riddles in case of API error
    return [
      {
        question: "ما هو الشيء الذي كلما زاد نقص؟",
        options: ["العمر", "المال", "الحفرة", "العلم"],
        correctIndex: 0,
        explanation: "العمر ينقص كلما زادت سنوات حياتنا."
      },
      {
        question: "شيء تملكه أنت ولكن يستخدمه الآخرون أكثر منك، فما هو؟",
        options: ["سيارتك", "اسمك", "هاتفك", "حذاؤك"],
        correctIndex: 1,
        explanation: "الناس ينادونك باسمك أكثر مما تنادي به نفسك."
      }
    ];
  }
};
