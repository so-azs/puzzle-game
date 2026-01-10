
import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, Difficulty } from "../types.ts";
import { CONFIG } from "../lib/config.ts";

// تهيئة الخدمة فقط إذا كان المفتاح موجوداً
const getAiClient = () => {
  if (!CONFIG.GEMINI_API_KEY) return null;
  return new GoogleGenAI({ apiKey: CONFIG.GEMINI_API_KEY });
};

export const fetchRiddles = async (difficulty: Difficulty): Promise<Riddle[]> => {
  const ai = getAiClient();
  
  if (!ai) {
    throw new Error("Gemini API Key is missing. Please check your environment variables.");
  }

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
    if (!text) throw new Error("No data received from Gemini");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    // ألغاز احتياطية لضمان استمرارية اللعب في حال حدوث خطأ تقني
    return [
      {
        question: "ما هو الشيء الذي يحوي مدناً بلا بيوت، وجبالاً بلا أشجار، وبحاراً بلا سمك؟",
        options: ["الخريطة", "الكتاب", "الحلم", "السراب"],
        correctIndex: 0,
        explanation: "الخريطة تمثل كل هذه التضاريس ولكنها مجرد رسم!"
      }
    ];
  }
};
