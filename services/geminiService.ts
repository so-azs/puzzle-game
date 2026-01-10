import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, Difficulty } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchRiddles = async (difficulty: Difficulty): Promise<Riddle[]> => {
  const prompt = `أنت خبير في اللغة العربية والألغاز. قم بتوليد 5 ألغاز أو كلمات ناقصة باللغة العربية بمستوى صعوبة (${difficulty}). 
  يجب أن يكون اللغز ممتعاً ومفيداً.
  قم بتقديم النتيجة بصيغة JSON حصراً بالهيكل التالي: array of objects {question, options, correctIndex, explanation}.`;

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
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return [
      {
        question: "ما هو الشيء الذي كلما زاد نقص؟",
        options: ["العمر", "المال", "الحفرة", "العلم"],
        correctIndex: 0,
        explanation: "العمر ينقص كلما زادت سنوات حياتنا."
      }
    ];
  }
};