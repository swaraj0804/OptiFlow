import { GoogleGenAI } from "@google/genai";

export async function analyzeTraffic(trafficData: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following real-time traffic data and provide optimization insights. 
      Identify potential bottlenecks and predict congestion trends. 
      Keep the response concise (max 3 bullet points).
      Data: ${trafficData}`,
      config: {
        systemInstruction: "You are a traffic engineering AI. Provide technical, data-driven optimization strategies.",
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini AI Analysis failed:", error);
    return "AI insights currently unavailable. Check system connectivity.";
  }
}
