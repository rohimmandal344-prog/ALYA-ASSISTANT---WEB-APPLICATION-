/**
 * Real Local & Regional News Service for Alya Assistant
 * Retrieves current headlines, local safety alerts, and community developments from live news feeds.
 * Strictly avoids fake or fabricated news headlines.
 */

import { locationService } from '../lib/locationService';

export interface NewsArticle {
  title: string;
  source: string;
  publishedAt: string;
  snippet?: string;
  link: string;
}

export interface LocalNewsResult {
  success: boolean;
  locality?: string;
  articles?: NewsArticle[];
  error?: string;
  locationRequired?: boolean;
}

class NewsServiceImpl {
  /**
   * Parse RSS XML format into structured NewsArticle objects
   */
  private parseRssXml(xmlText: string): NewsArticle[] {
    const articles: NewsArticle[] = [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const items = doc.querySelectorAll('item');

      items.forEach((item, idx) => {
        if (idx >= 6) return; // Limit to 6 clean top stories

        const rawTitle = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDateRaw = item.querySelector('pubDate')?.textContent || '';
        const sourceName = item.querySelector('source')?.textContent || 'Local News';

        // Extract title and source separator
        let title = rawTitle;
        let source = sourceName;
        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          title = parts.slice(0, -1).join(' - ');
          source = parts[parts.length - 1];
        }

        const pubDateFormatted = pubDateRaw ? new Date(pubDateRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        if (title.length > 5) {
          articles.push({
            title,
            source,
            publishedAt: pubDateFormatted,
            link
          });
        }
      });
    } catch {
      // Ignore parsing errors
    }
    return articles;
  }

  /**
   * Fetch current news for a specific query or locality
   */
  public async getNewsForQuery(query: string): Promise<LocalNewsResult> {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(rssUrl, { signal: AbortSignal.timeout(6000) });

      if (!response.ok) {
        return { success: false, error: `News service returned status ${response.status}` };
      }

      const xmlText = await response.text();
      const articles = this.parseRssXml(xmlText);

      if (articles.length === 0) {
        return { success: false, error: `No recent local news found for "${query}".` };
      }

      return { success: true, locality: query, articles };
    } catch (err: any) {
      return { success: false, error: `Failed to fetch live local news: ${err.message || err}` };
    }
  }

  /**
   * Fetch local news for current GPS detected locality/region
   */
  public async getLocalNewsForUser(): Promise<LocalNewsResult> {
    const locRes = await locationService.getCurrentLocation();
    if (!locRes.success || !locRes.context) {
      return {
        success: false,
        locationRequired: true,
        error: locRes.error || 'Location permission is required to detect nearby local news.'
      };
    }

    const locality = locRes.context.locality || locRes.context.region || locRes.context.country || 'local news';
    const result = await this.getNewsForQuery(locality);
    result.locality = locality;
    return result;
  }
}

export const newsService = new NewsServiceImpl();
