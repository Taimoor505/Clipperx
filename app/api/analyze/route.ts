import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_CLIP_DETECTION_PROMPT } from '@/lib/python-script';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY is not configured in environment secrets. Please verify your API key in Settings > Secrets.',
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      videoTitle = 'Long-Form Founder & Engineering Podcast',
      videoDurationSeconds = 2400,
      youtubeUrl = '',
      transcriptContext = '',
      frames = [],
    } = body;

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (Array.isArray(frames) && frames.length > 0) {
      for (const frame of frames.slice(0, 6)) {
        if (frame.data && frame.mimeType) {
          parts.push({
            inlineData: {
              mimeType: frame.mimeType,
              data: frame.data,
            },
          });
        }
      }
    }

    const contextualPrompt = `${GEMINI_CLIP_DETECTION_PROMPT}

SOURCE VIDEO METADATA:
- Title / File: ${videoTitle}
- Total Duration: ${videoDurationSeconds} seconds (${Math.floor(videoDurationSeconds / 60)}m ${Math.round(videoDurationSeconds % 60)}s)
${youtubeUrl ? `- YouTube URL: ${youtubeUrl}` : ''}
${transcriptContext ? `- Audio/Transcript Context:\n${transcriptContext}` : ''}

IMPORTANT TIMING & KARAOKE CONSTRAINT:
- Ensure all "start_time" and "end_time" values fall within the source duration (00:00:00.000 to ${formatTimestamp(videoDurationSeconds)}).
- For every item in "transcript_lines", include a "words" array with word-by-word timing offsets ("word", "start_time", "end_time" in seconds from the start of the clip) so the ASS Karaoke engine can highlight each spoken word.`;

    parts.push({ text: contextualPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction:
          'You are an expert AI Short-Form Video Editor. Analyze multimodal video frames and audio transcripts to detect high-retention 30-60 second vertical clip segments with strong 0-5s hooks, sentence cut boundaries, and word-level karaoke timing.',
        temperature: 0.25,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description:
            'List of 3 to 6 high-engagement standalone short-form video clip candidates with word-level timing.',
          items: {
            type: Type.OBJECT,
            properties: {
              clip_id: {
                type: Type.INTEGER,
                description: 'Sequential clip identifier starting at 1.',
              },
              title: {
                type: Type.STRING,
                description: 'Catchy, high-curiosity hook title.',
              },
              start_time: {
                type: Type.STRING,
                description: 'Start timestamp in HH:MM:SS.mmm format.',
              },
              end_time: {
                type: Type.STRING,
                description: 'End timestamp in HH:MM:SS.mmm format.',
              },
              duration_seconds: {
                type: Type.NUMBER,
                description: 'Duration in seconds (between 30 and 60 seconds).',
              },
              virality_score: {
                type: Type.INTEGER,
                description: 'Virality score between 0 and 100.',
              },
              hook_transcript: {
                type: Type.STRING,
                description: 'Exact first 5 seconds of spoken hook text.',
              },
              reasoning: {
                type: Type.STRING,
                description:
                  'Editorial explanation of why this moment has strong standalone retention.',
              },
              transcript_lines: {
                type: Type.ARRAY,
                description:
                  'Synchronized caption phrases across the clip for ASS Karaoke subtitle burn-in.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    start_offset: {
                      type: Type.NUMBER,
                      description: 'Seconds from start of clip.',
                    },
                    end_offset: {
                      type: Type.NUMBER,
                      description: 'Seconds from start of clip.',
                    },
                    text: {
                      type: Type.STRING,
                      description: 'Short high-impact caption phrase (4-7 words).',
                    },
                    words: {
                      type: Type.ARRAY,
                      description:
                        'Word-level timing offsets for ASS Karaoke active highlighting.',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          word: { type: Type.STRING },
                          start_time: { type: Type.NUMBER },
                          end_time: { type: Type.NUMBER },
                        },
                        required: ['word', 'start_time', 'end_time'],
                      },
                    },
                  },
                  required: ['start_offset', 'end_offset', 'text'],
                },
              },
            },
            required: [
              'clip_id',
              'title',
              'start_time',
              'end_time',
              'duration_seconds',
              'virality_score',
              'hook_transcript',
              'reasoning',
              'transcript_lines',
            ],
          },
        },
      },
    });

    const rawText = response.text?.trim() || '[]';
    const clips = JSON.parse(rawText);

    return NextResponse.json({ clips });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unexpected error during Gemini multimodal video analysis.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function formatTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hrs = Math.floor(safe / 3600);
  const rem = safe % 3600;
  const mins = Math.floor(rem / 60);
  const secs = rem % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}
