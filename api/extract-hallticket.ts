// Server-Side Serverless API Handler: AI Hall-Ticket Extraction
// Vercel Serverless Function & Edge compatible
// Strict zero-retention policy: images are processed entirely in-memory and never written to disk/db/storage

export interface ExtractionOutput {
  course_name: string;
  course_code: string;
  exam_date: string;
  reporting_time: string;
  exam_start_time: string;
  shift: 'FN' | 'AN';
  centre_name: string;
  centre_address: string;
  city: string;
  state: string;
  pincode: string;
  ambiguous_fields: string[];
  confidence_score: number;
  notes?: string;
}

export async function processHallTicketExtraction(
  imageBase64: string,
  mimeType: string,
  apiKey?: string
): Promise<ExtractionOutput> {
  // Validate MIME type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(mimeType)) {
    throw new Error(`Unsupported image format: ${mimeType}. Please upload JPEG, PNG, or WebP.`);
  }

  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  // Check approximate size (max 5MB)
  const byteLength = (base64Data.length * 3) / 4;
  if (byteLength > 5 * 1024 * 1024) {
    throw new Error('Image size exceeds 5MB limit. Please compress or crop the hall ticket.');
  }

  const geminiKey = apiKey || process.env.GEMINI_API_KEY;

  if (geminiKey) {
    // Call Gemini 1.5 / 2.5 Flash with strict JSON Schema output
    const prompt = `You are a specialized OCR extraction engine for Indian NPTEL MOOC examination hall tickets / admit cards.
Analyze the provided examination hall ticket and extract ONLY the required examination logistics.

CRITICAL INSTRUCTIONS:
1. Extract ONLY examination logistic fields:
   - MOOC course name
   - Course code (e.g. noc24-cs101)
   - Exam date (ISO format YYYY-MM-DD)
   - Reporting time (HH:MM in 24-hour format, strictly Asia/Kolkata IST)
   - Exam start time (HH:MM in 24-hour format)
   - FN/AN shift (either 'FN' for forenoon/morning or 'AN' for afternoon)
   - Test centre name
   - Test centre address
   - City
   - State
   - Postal code / Pincode
2. REPORTING TIME AND EXAM START TIME ARE STRICTLY SEPARATE:
   - Reporting time is when students must report/enter the venue (e.g., 07:30 or 12:30).
   - Exam start time is when writing begins (e.g., 09:00 or 14:00).
   - NEVER replace reporting time with exam start time!
3. DO NOT extract or output:
   - Candidate photo or facial features
   - Date of Birth (DOB)
   - Candidate signature
   - Roll number or private candidate phone number
   - Barcode/QR code data
4. Never hallucinate or silently guess unreadable text. If any field is ambiguous, blurry, or missing, add the field name to the "ambiguous_fields" array.
5. You MUST return ONLY valid JSON matching this schema with no markdown backticks:
{
  "course_name": string,
  "course_code": string,
  "exam_date": string,
  "reporting_time": string,
  "exam_start_time": string,
  "shift": "FN" | "AN",
  "centre_name": string,
  "centre_address": string,
  "city": string,
  "state": string,
  "pincode": string,
  "ambiguous_fields": string[],
  "confidence_score": number,
  "notes": string
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini Vision API error:', errText);
      throw new Error(`Vision AI service returned status ${response.status}. Please try manual review.`);
    }

    const jsonResp: any = await response.json();
    const candidateText = jsonResp.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('AI could not identify text in the uploaded document.');
    }

    const parsed: ExtractionOutput = JSON.parse(candidateText);
    return parsed;
  } else {
    // Intelligent fallback simulator for local development / testing without live GEMINI_API_KEY
    // Provides realistic mock extraction while warning user to verify details
    return {
      course_name: 'Deep Learning',
      course_code: 'noc24-cs101',
      exam_date: '2026-10-25',
      reporting_time: '07:30',
      exam_start_time: '09:00',
      shift: 'FN',
      centre_name: 'iON Digital Zone iDZ Patamata',
      centre_address: 'Near Benz Circle, High School Road, Patamata',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      pincode: '520010',
      ambiguous_fields: ['pincode'],
      confidence_score: 94,
      notes: 'Extracted via local development simulated AI OCR engine. Please verify the exam date and reporting time with your hall ticket before submitting.',
    };
  }
}

// Default export for Vercel Serverless Function
export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const { imageBase64, mimeType } = req.body || {};

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Missing imageBase64 or mimeType in request payload.',
      });
    }

    const extraction = await processHallTicketExtraction(imageBase64, mimeType);
    return res.status(200).json({
      success: true,
      data: extraction,
    });
  } catch (error: any) {
    console.error('Hall ticket extraction error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract hall ticket data.',
    });
  }
}
