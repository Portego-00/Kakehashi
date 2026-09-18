import { readFileSync } from 'fs';
import { join } from 'path';
import { conversationLicenseNotices } from '../license-notices';

describe('Bundled conversation notices', () => {
  it('includes complete offline copies of every declared component notice', () => {
    expect(conversationLicenseNotices.map(notice => notice.id)).toEqual(['mural', 'nunito', 'webrtc', 'incall', 'pinyin', 'pinyin-data', 'tiny-mit', 'tiny-bsd']);
    for (const notice of conversationLicenseNotices) {
      expect(notice.text).toBe(readFileSync(join(__dirname, '../../../..', 'licenses', notice.licenseFile), 'utf8'));
      expect(notice.text.length).toBeGreaterThan(600);
    }
  });
});
