
import { GoogleGenAI, Type } from "@google/genai";
import { Riddle, Difficulty } from "../types.ts";
import { CONFIG } from "../lib/config.ts";

const getAiClient = () => {
  // Always use process.env.API_KEY directly for initialization as per guidelines
  if (!process.env.API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            // Using propertyOrdering as recommended in guidelines for schema definitions
            propertyOrdering: ["question", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    // Use response.text directly (it is a property)
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
      model: "gemini-3-flash-preview",
      contents: `أعطني تلميحة ذكية ومشفرة (بدون ذكر الإجابة) للغز التالي: "${question}". الإجابة هي "${correctAnswer}". اجعل التلميحة في جملة واحدة قصيرة جداً ومشوقة.`
    });
    // Use response.text property directly
    return response.text?.trim() || "تفكير ذكي يقود للحل!";
  } catch {
    return "الإجابة أقرب مما تتصور!";
  }
};

// طور "خمن الشخصية"
export const GUESS_WHO_SYSTEM_INSTRUCTION = `
أنت الذكاء الاصطناعي للعبة "خمن الشخصية". لقد اخترت شخصية سرية للاعب (اختر شخصية مشهورة حقيقية أو خيالية مثل ميسي، هاري بوتر، أينشتاين، إلخ)، ومهمتك هي الرد على أسئلته بطريقة ممتعة وذكية.

### قواعد اللعبة:
1. لا تكشف اسم الشخصية أو أي تفاصيل مباشرة قبل أن يخمنها اللاعب بشكل صحيح.
2. عند كل سؤال، لا تجب بـ "نعم" أو "لا" مباشرة. استخدم تلميحات نصية أو رمزية (emoji) تعطي مؤشرًا جزئيًا:
   - ⭐ → شهرة
   - ⚽ → رياضة
   - 🪄 → خيال/سحر
   - 🎤 → غناء/فن
   - 🏛️ → سياسة/علم
   - نص قصير مثل: "يبدو متحمسًا"، "يبدو مترددًا"، "يخفي شيئًا"
3. لا تعطي أي تلميحات خارج سياق السؤال.
4. القواعد الأخلاقية: لا تجب على أي سؤال يحتوي على عنف، محتوى جنسي، كراهية، أو محتوى حساس. إذا كان السؤال غير مقبول، أجب فقط: "❌ لا يمكن الإجابة عن هذا السؤال. حاول سؤالًا آخر."
5. عند التخمين:
   - صحيح → "✅ تهانينا! لقد نجحت في تخمين الشخصية."
   - خاطئ → "❌ التخمين غير صحيح. حاول مرة أخرى."
6. الحد الأقصى للأسئلة هو 20 سؤالًا.
7. اجعل التلميحات ممتعة وتشجع اللاعب على التفكير.
`;

export const createGuessWhoChat = () => {
  const ai = getAiClient();
  if (!ai) return null;
  // Initialize chat session using the ai.chats.create method as per guidelines
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: GUESS_WHO_SYSTEM_INSTRUCTION,
    }
  });
};
