// Interfaz para resultados de búsqueda
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Función para limpiar HTML y normalizar texto
function cleanSnippet(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, ' ') // Elimina etiquetas HTML
    .replace(/&nbsp;/g, ' ') // Entidades HTML
    .replace(/\s+/g, ' ') // Normaliza espacios
    .trim();
}

/**
 * Búsqueda web en tiempo real usando DuckDuckGo Lite (gratis, sin API key)
 * @param query - Término de búsqueda
 * @param limit - Número máximo de resultados (default: 5)
 * @returns Array de resultados con título, URL y snippet
 */
export async function webSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
  try {
    console.log(`Web search: "${query}" (limit: ${limit})`);

    // DuckDuckGo Lite HTML search
    const encodedQuery = encodeURIComponent(query);
    const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const results: SearchResult[] = [];

    // Parsear resultados HTML de DuckDuckGo Lite
    // Los resultados están en <tr class="result">
    const resultRegex = /<tr class="result">([\s\S]*?)<\/tr>/gi;
    let match;
    let count = 0;

    while ((match = resultRegex.exec(html)) !== null && count < limit) {
      const resultBlock = match[1];

      // Extraer título y URL
      const titleMatch = /<a class="result-link" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(resultBlock);
      const snippetMatch = /<a class="result-snippet"[^>]*>([\s\S]*?)<\/a>/.exec(resultBlock);

      if (titleMatch && titleMatch[1] && titleMatch[2]) {
        results.push({
          title: cleanSnippet(titleMatch[2]),
          url: decodeURIComponent(titleMatch[1]),
          snippet: snippetMatch ? cleanSnippet(snippetMatch[1]) : '',
        });
        count++;
      }
    }

    // Si no hay resultados con la clase "result", intentar con la estructura alternativa
    if (results.length === 0) {
      // Buscar enlaces en la estructura alternativa
      const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      const lines = html.split('\n').filter(line => line.includes('result-link') || line.includes('result__a'));

      for (const line of lines) {
        if (count >= limit) break;
        const linkMatch = linkRegex.exec(line);
        if (linkMatch && linkMatch[1] && !linkMatch[1].includes('duckduckgo.com')) {
          results.push({
            title: cleanSnippet(linkMatch[2]),
            url: decodeURIComponent(linkMatch[1]),
            snippet: '',
          });
          count++;
        }
      }
    }

    return results.length > 0 ? results : [{
      title: 'Búsqueda completada',
      url: url,
      snippet: `No se encontraron resultados formateados para "${query}". Visita el enlace para ver resultados directos.`,
    }];
  } catch (error: any) {
    console.error('Error en búsqueda web:', error.message);
    return {
      error: `No se pudo realizar la búsqueda: ${error.message || 'Error desconocido'}`
    } as any;
  }
}

/**
 * Búsqueda de noticias recientes usando DuckDuckGo Lite
 * @param query - Término de búsqueda
 * @param limit - Número máximo de resultados
 */
export async function newsSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
  try {
    console.log(`News search: "${query}" (limit: ${limit})`);

    // DuckDuckGo Lite news search (añadir "news" al query)
    const encodedQuery = encodeURIComponent(`news ${query}`);
    const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const results: SearchResult[] = [];

    // Parsear resultados (misma lógica que webSearch)
    const resultRegex = /<tr class="result">([\s\S]*?)<\/tr>/gi;
    let match;
    let count = 0;

    while ((match = resultRegex.exec(html)) !== null && count < limit) {
      const resultBlock = match[1];

      const titleMatch = /<a class="result-link" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(resultBlock);
      const snippetMatch = /<a class="result-snippet"[^>]*>([\s\S]*?)<\/a>/.exec(resultBlock);

      if (titleMatch && titleMatch[1] && titleMatch[2]) {
        results.push({
          title: cleanSnippet(titleMatch[2]),
          url: decodeURIComponent(titleMatch[1]),
          snippet: snippetMatch ? cleanSnippet(snippetMatch[1]) : '',
        });
        count++;
      }
    }

    return results.length > 0 ? results : [{
      title: 'Búsqueda de noticias completada',
      url: url,
      snippet: `No se encontraron noticias para "${query}".`,
    }];
  } catch (error: any) {
    console.error('Error en búsqueda de noticias:', error.message);
    return {
      error: `No se pudo buscar noticias: ${error.message || 'Error desconocido'}`
    } as any;
  }
}
