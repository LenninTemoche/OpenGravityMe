// Interfaz para resultado de transcripción
export interface TranscriptResult {
  videoId: string;
  transcript: string;
  duration?: string;
  language?: string;
}

// Función para extraer ID de YouTube de una URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // ID directo (11 caracteres)
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Obtiene información de un video de YouTube
 * NOTA: YouTube bloquea las peticiones de transcripción desde servidores.
 * Esta función devuelve información básica del video.
 */
export async function getYouTubeTranscript(url: string): Promise<TranscriptResult> {
  try {
    const videoId = extractVideoId(url);

    if (!videoId) {
      throw new Error('URL de YouTube no válida.');
    }

    console.log(`🎬 YouTube info: Video ID "${videoId}"`);

    // Obtener información básica del video desde la página HTML
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: No se pudo acceder al video`);
    }

    const html = await response.text();

    // Extraer título del video
    const titleMatch = html.match(/<title>([^<]+) - YouTube<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Video de YouTube';

    // Verificar si hay captionTracks disponibles
    const captionTracksMatch = html.match(/"captionTracks":(\[[^\]]*\])/s);
    const hasTranscript = !!captionTracksMatch;

    console.log(`📋 Transcripción disponible: ${hasTranscript}`);

    if (!hasTranscript) {
      return {
        videoId,
        transcript: `[Información del video]\n\nTítulo: ${title}\n\nURL: https://www.youtube.com/watch?v=${videoId}\n\n⚠️ Este video no tiene transcripción disponible. YouTube requiere un navegador web completo para obtener las transcripciones.`,
        duration: undefined,
        language: 'es',
      };
    }

    // Hay transcripción disponible pero YouTube bloquea el acceso desde servidor
    // Devolvemos información útil para que el LLM pueda responder
    const captionTracks = JSON.parse(captionTracksMatch[1]);
    const languages = captionTracks.map((t: any) => t.languageCode || t.name?.simpleText || 'unknown').join(', ');

    return {
      videoId,
      transcript: `[Video de YouTube detectado con transcripción]\n\nTítulo: ${title}\nURL: https://www.youtube.com/watch?v=${videoId}\nIdiomas de transcripción disponibles: ${languages}\n\n⚠️ YouTube bloquea el acceso a transcripciones desde servidores. El usuario puede ver el video directamente en YouTube.`,
      duration: undefined,
      language: 'es',
    };

  } catch (error: any) {
    console.error('❌ Error obteniendo info de YouTube:', error.message);

    return {
      videoId: extractVideoId(url) || 'unknown',
      transcript: `⚠️ No se pudo obtener información del video de YouTube.\n\nError: ${error.message}\n\nEl usuario puede ver el video directamente en YouTube.`,
      duration: undefined,
      error: error.message,
    } as any;
  }
}

/**
 * Valida una URL de YouTube
 */
export function validateYouTubeUrl(url: string): { valid: boolean; videoId?: string } {
  const videoId = extractVideoId(url);
  return {
    valid: !!videoId,
    videoId: videoId || undefined
  };
}
