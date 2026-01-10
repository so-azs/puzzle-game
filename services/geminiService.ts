
import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, Difficulty } from "../types.ts";

// يتم جلب المفتاح تلقائياً من البيئة المحيطة
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchRiddles = async (difficulty: Difficulty): Promise<Riddle[]> => {
  const prompt = `أنت خبير لغوي عربي ومصمم ألغاز بارع. 
  قم بتوليد 5 ألغاز ذكية وشيقة باللغة العربية الفصحى بمستوى صعوبة (${difficulty}).
  ركز على التلاعب بالألفاظ، المعلومات الثقافية، أو الألغاز المنطقية.
  يجب أن تكون الخيارات الأربعة متقاربة لتزيد من حماس اللعبة.
  
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
      model: "gemini-3-pro-preview", // استخدام النموذج الاحترافي للألغاز المعقدة
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
        temperature: 0.8, // زيادة الإبداع في توليد الألغاز
      }
    });

    const text = response.text; // الوصول للنص كخاصية مباشرة
    if (!text) throw new Error("لم يتم استلام بيانات من الذكاء الاصطناعي");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    // قائمة ألغاز احتياطية في حال حدوث خطأ في الاتصال
    return [
      {
        question: "ما هو الشيء الذي له أسنان ولا يعض؟",
        options: ["المشط", "المنشار", "المقص", "الفم"],
        correctIndex: 0,
        explanation: "المشط له أسنان لتسريح الشعر لكنه لا يعض!"
      },
      {
        question: "ما هو الشيء الذي يكتب ولا يقرأ؟",
        options: ["القلم", "الكتاب", "الورقة", "الكمبيوتر"],
        correctIndex: 0,
        explanation: "القلم هو الذي يكتب الكلمات ولكنه لا يستطيع قراءتها."
      }
    ];
  }
};
