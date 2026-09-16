import { pinyin, segmentWords } from '../text-support';

const originalSegmenter = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');

afterEach(() => {
  if (originalSegmenter) Object.defineProperty(Intl, 'Segmenter', originalSegmenter);
  else Reflect.deleteProperty(Intl, 'Segmenter');
});

describe('conversation caption word lookup', () => {
  it.each([
    ['es', '¡Un café con leche! ¿Y algo para comer?'],
    ['fr', 'L’été, j’aime le café.'],
    ['nb', 'Blåbær, vær så snill.'],
    ['de', 'Straßen, Häuser und Grüße.'],
    ['zh', '你好！我去银行。\n学习中文 ☕️'],
    ['zh-Hans', '咖啡 + latte\t两杯。'],
    ['ar', 'مرحبًا بالعالم!'],
  ])('preserves every character in a %s caption', (language, text) => {
    expect(segmentWords(text, language).map((piece) => piece.text).join('')).toBe(text);
    expect(segmentWords(text, language).filter((piece) => !piece.isWord).length).toBeGreaterThan(0);
  });

  it('keeps Chinese dictionary words intact for lookup', () => {
    expect(segmentWords('我去银行旅行。', 'zh').filter((piece) => piece.isWord).map((piece) => piece.text))
      .toEqual(expect.arrayContaining(['银行', '旅行']));
  });

  it('uses offline word boundaries for Chinese when Hermes has no Segmenter', () => {
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
    const text = '我去银行，学习中文。\nhello ☕️';
    const pieces = segmentWords(text, 'zh-Hans');
    expect(pieces.map((piece) => piece.text).join('')).toBe(text);
    expect(pieces.filter((piece) => piece.isWord).map((piece) => piece.text))
      .toEqual(expect.arrayContaining(['银行', '学习', '中文', 'hello']));
    expect(pieces.find((piece) => piece.text.includes('☕'))?.isWord).toBe(false);
  });

  it('keeps combining accents and contractions intact in the fallback', () => {
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
    const text = "L’e\u0301te\u0301, don't re-enter 42!";
    const pieces = segmentWords(text, 'fr');
    expect(pieces.map((piece) => piece.text).join('')).toBe(text);
    expect(pieces.filter((piece) => piece.isWord).map((piece) => piece.text))
      .toEqual(['L’e\u0301te\u0301', "don't", 're-enter', '42']);
  });

  it('separates adjacent Chinese and Latin words in the fallback without altering text', () => {
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
    const pieces = segmentWords('hello银行world', 'zh');
    expect(pieces).toEqual([
      { text: 'hello', isWord: true },
      { text: '银行', isWord: true },
      { text: 'world', isWord: true },
    ]);
  });

  it('recovers from unsupported locales and empty captions', () => {
    expect(segmentWords('Un café.', 'invalid_@locale').map((piece) => piece.text).join('')).toBe('Un café.');
    expect(segmentWords('', 'zh')).toEqual([]);
  });

  it('segments Japanese words and particles offline without RegExp.compile', () => {
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
    const compile = Object.getOwnPropertyDescriptor(RegExp.prototype, 'compile');
    // eslint-disable-next-line no-extend-native -- Simulate Hermes, which omits this obsolete method, and restore it below.
    Object.defineProperty(RegExp.prototype, 'compile', { configurable: true, value: undefined });
    try {
      const pieces = segmentWords('私の名前は中野です。', 'ja');
      expect(pieces.map((piece) => piece.text)).toEqual(['私', 'の', '名前', 'は', '中野', 'です', '。']);
      expect(pieces[pieces.length - 1].isWord).toBe(false);
    } finally {
      // eslint-disable-next-line no-extend-native -- Restore the original descriptor after the Hermes compatibility check.
      if (compile) Object.defineProperty(RegExp.prototype, 'compile', compile);
    }
  });

  it('preserves Japanese mixed scripts, whitespace, emoji and supplementary Han', () => {
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
    const text = '私は☕️が好きです！\nTokyo  𠮷野 👨‍👩‍👧‍👦';
    const pieces = segmentWords(text, 'ja-JP');
    expect(pieces.map((piece) => piece.text).join('')).toBe(text);
    expect(pieces.some((piece) => piece.text.includes('𠮷'))).toBe(true);
    expect(pieces.find((piece) => piece.text.includes('👨'))?.isWord).toBe(false);
  });
});

describe('optional Mandarin pinyin', () => {
  it('resolves common polyphones from phrase context', () => {
    expect(pinyin('银行旅行音乐')).toBe('yín háng lǚ xíng yīn yuè');
    expect(pinyin('睡觉')).toBe('shuì jiào');
    expect(pinyin('重新')).toBe('chóng xīn');
  });

  it('preserves punctuation, whitespace and mixed-script text', () => {
    expect(pinyin('你好！\nHello  世界。')).toBe('nǐ hǎo！\nHello  shì jiè。');
    expect(pinyin('你好latte☕️')).toBe('nǐ hǎo latte☕️');
  });

  it('preserves ü with tone marks and uses dictionary tones', () => {
    expect(pinyin('旅行')).toBe('lǚ xíng');
    expect(pinyin('女儿')).toBe('nǚ ér');
    expect(pinyin('不是')).toBe('bù shì');
  });

  it('does not invent a reading for non-Chinese text', () => {
    expect(pinyin('¡Hola! 👋')).toBe('');
    expect(pinyin('')).toBe('');
  });
});
