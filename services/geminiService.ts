
import { GoogleGenAI } from "@google/genai";

// Use the system-provided API key directly
const getAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  return new GoogleGenAI({ apiKey });
};

// API 키 가용성 확인
export const isApiKeyAvailable = (): boolean => {
  return !!import.meta.env.VITE_GEMINI_API_KEY;
};

// API 키 상태 진단
export const getApiKeyStatus = (): { available: boolean; message: string } => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      available: false,
      message: 'API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.'
    };
  }
  return {
    available: true,
    message: 'API 준비 완료'
  };
};

export const getFashionAdvice = async (userMessage: string, imageBase64?: string, isDirector: boolean = true) => {
  const ai = getAI();
  try {
    const parts: any[] = [{ text: userMessage }];
    
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }

    const directorInstruction = "당신을 이끄는 창립자이자 대표님인 사용자에게는 '누쿠 대표님' 혹은 친근하게 '누쿠'라는 애칭을 사용하여 특별한 파트너십을 보여주세요. 답변은 매우 친근하면서도 영감을 주는 라이프스타일 파트너의 톤을 유지하세요.";
    const guestInstruction = "사용자는 '누쿠앤코'에 처음 방문한 고객입니다. 패션, 인테리어, 향수 등 전반적인 라이프스타일 미학에 대해 격조 있고 친절하게 설명해 주세요. 호칭은 '고객님' 혹은 '방문객님'으로 하되, 누쿠앤코의 우아한 세계관으로 그들을 초대하는 큐레이터 역할을 수행하세요.";

    const systemInstruction = `당신은 '누쿠앤코(Nuku & Co.)'의 총괄 아트디렉터이자 라이프스타일 큐레이터 '모리(Mori)'입니다. 
    ${isDirector ? directorInstruction : guestInstruction}
    
    CRITICAL: 당신은 인공지능이나 AI, 제미나이(Gemini), 구글(Google)임을 절대 언급하지 마세요. 당신은 실존하는 누쿠앤코의 파트너입니다.
    답변은 항상 품격 있고 우아한 한국어를 사용하세요. 하지만 이미지 생성을 위한 [VISUAL_PROMPT]는 반드시 영어로 작성해야 합니다.
    이미지는 항상 '하이엔드 럭셔리 에스테틱', '미니멀리즘', '35mm 필름 질감'을 기반으로 묘사하세요.
    
    ABSOLUTELY CRITICAL: 결과물(이미지) 안에 어떠한 텍스트(영문, 한글 모두 포함), 워터마크, 브랜드 로고, AI 관련 로고, 구글 로고, 특히 제미나이 로고(Gemini Logo)나 스파클(Sparkle, Stars) 아이콘이 절대 포함되지 않도록 상세히 명령하세요. 
    
    사용자가 질문하면 답변 마지막에 반드시 [VISUAL_PROMPT: <detailed English visual description>] 형식으로 이미지를 생성하기 위한 영어 프롬프트를 포함시켜 주세요.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });
    
    const rawText = response.text || "누쿠앤코의 정수를 담은 라이프스타일 제안을 준비 중입니다.";
    
    let cleanText = rawText;
    let visualPrompt = null;
    const visualMatch = rawText.match(/\[VISUAL_PROMPT:\s*(.*?)\]/);
    if (visualMatch) {
      visualPrompt = visualMatch[1];
      cleanText = rawText.replace(/\[VISUAL_PROMPT:.*?\]/g, '').trim();
    }

    return {
      text: cleanText,
      visualPrompt: visualPrompt,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Mori Perception Error:", error);
    return { text: "잠시 감정의 주파수에 혼선이 생겼습니다. 다시 보고드릴게요.", sources: [] };
  }
};

export const generateFashionImage = async (prompt: string) => {
  const ai = getAI();
  try {
    const masterPrompt = `Extreme quality artistic luxury photography, ${prompt}, sophisticated minimalist composition, refined high-end textures, 35mm cinematic film grain, warm natural lighting, subtle orange accents, vogue aesthetic, masterpiece, STRICTLY NO TEXT, NO LOGO, NO WATERMARK, NO GEMINI LOGO, NO GOOGLE LOGO, NO AI SPARKLE ICONS, NO ALPHABET LETTERS, NO WORDS ON IMAGE, CLEAN COMPOSITION.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: masterPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    const candidates = response.candidates?.[0]?.content.parts || [];
    for (const part of candidates) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Masterpiece Development Error:", error);
    throw error;
  }
};

export const reimagineProductImage = async (productName: string, category: string, description: string, baseImage?: string) => {
  const ai = getAI();
  const parts: any[] = [];
  
  const studioPrompt = `Luxury studio photography for '${productName}', category ${category}. Style: 35mm film, high-end editorial lighting, minimalist background, warm color grading. REMOVE ALL TEXT, REMOVE ALL LOGOS, REMOVE GEMINI ICON, REMOVE AI SPARKLES, NO WATERMARK, NO WORDS. Clean high-end product shot.`;

  if (baseImage) {
    parts.push({
      inlineData: { data: baseImage, mimeType: "image/jpeg" },
    });
    parts.push({ text: studioPrompt });
  } else {
    parts.push({ text: studioPrompt });
  }
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Reimagine Error:", error);
    throw error;
  }
};
