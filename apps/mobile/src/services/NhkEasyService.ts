import { XMLParser } from 'fast-xml-parser';

export interface NhkEasyItem {
  title: string;
  link: string;
  pubDate: string;
  guid: string;
  imageUrl: string | null;
  audioUrl: string | null;
  contentHtml: string;
}

const FEED_URL = 'https://nhkeasier.com/feed/';
const BASE_URL = 'https://nhkeasier.com';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

let cachedItems: NhkEasyItem[] = [];

export const NhkEasyService = {
  async getNews(): Promise<NhkEasyItem[]> {
    try {
      const response = await fetch(FEED_URL);
      const xmlText = await response.text();
      
      const feed = parser.parse(xmlText);
      const items = feed.rss?.channel?.item || [];
      const itemsArray = Array.isArray(items) ? items : [items];

      cachedItems = itemsArray.map((item: any) => {
        const description = item.description || '';
        
        // Extract image URL
        const imageMatch = description.match(/<img src="([^"]+)"/);
        let imageUrl = imageMatch ? imageMatch[1] : null;
        if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = `${BASE_URL}${imageUrl}`;
        }

        // Extract audio URL
        const audioMatch = description.match(/<audio src="([^"]+)"/);
        let audioUrl = audioMatch ? audioMatch[1] : null;
        if (audioUrl && !audioUrl.startsWith('http')) {
            audioUrl = `${BASE_URL}${audioUrl}`;
        }

        // Clean up content if needed, or just keep the full HTML description
        // The description in the feed contains the structure we want for the detail view
        // But we might want to fix relative URLs in the HTML content itself for the WebView
        let contentHtml = description;
        contentHtml = contentHtml.replace(/src="\/media/g, `src="${BASE_URL}/media`);
        contentHtml = contentHtml.replace(/href="\/story/g, `href="${BASE_URL}/story`);

        return {
          title: item.title || 'No Title',
          link: item.link || '',
          pubDate: item.pubDate || '',
          guid: item.guid || item.link || '',
          imageUrl,
          audioUrl,
          contentHtml,
        };
      });
      return cachedItems;
    } catch (error) {
      console.error('Error fetching NHK Easy News:', error);
      return [];
    }
  },

  getItemById(id: string): NhkEasyItem | undefined {
    // ID in this case is the guid or a part of it. 
    // If the ID passed is just the number (e.g. 9228), we check if guid contains it.
    return cachedItems.find(item => item.guid.includes(id) || item.link.includes(id));
  }
};
