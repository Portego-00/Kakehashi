export const subject = {id: 2652, object: 'vocabulary', data: {
  characters: '先日', level: 4, spaced_repetition_system_id: 1,
  meanings: [{meaning: 'The Other Day', primary: true, accepted_answer: true}, {meaning: 'A Few Days Ago', primary: false, accepted_answer: true}],
  readings: [{reading: 'せんじつ', primary: true, accepted_answer: true}],
  parts_of_speech: ['noun'], component_subject_ids: [543, 476],
  meaning_mnemonic: 'The <kanji>previous</kanji> <kanji>day</kanji> refers to <vocabulary>the other day</vocabulary>. Think back to something you did a few days ago.',
  reading_mnemonic: 'Remember <reading>せんじつ</reading> when you recall what happened the other day.',
  context_sentences: [
    {ja: '先日はありがとうございました。', en: 'Thank you for the other day.'},
    {ja: '先日、友達と映画を見ました。', en: 'The other day I watched a movie with a friend.'},
    {ja: '先日買った本を読んでいます。', en: 'I am reading the book I bought the other day.'},
  ],
  pronunciation_audios: [
    {url: 'http://127.0.0.1:8097/pronunciation.wav', content_type: 'audio/wav', metadata: {gender: 'male', source_id: 1, pronunciation: 'せんじつ', voice_actor_id: 1, voice_actor_name: 'Kenichi', voice_description: 'Fixture audio'}},
    {url: 'http://127.0.0.1:8097/pronunciation.wav', content_type: 'audio/wav', metadata: {gender: 'female', source_id: 2, pronunciation: 'せんじつ', voice_actor_id: 2, voice_actor_name: 'Kyoko', voice_description: 'Fixture audio'}},
  ],
}};
// Production storage/decoder/index; account data and catalog payload are isolated.
export const catalog = [subject, ...Array.from({length: 9000}, (_, i) => ({
  id: 4000 + i, object: i % 6 === 0 ? 'kanji' : 'vocabulary', data: {
    ...subject.data, characters: `単語${i}`, level: 1 + i % 60,
    meanings: [{meaning: `Example ${i}`, primary: true, accepted_answer: true}],
    readings: [{reading: `たんご${i}`, primary: true, accepted_answer: true}],
  },
})), {id: 543, object: 'kanji', data: {...subject.data, characters: '先', meanings: [{meaning: 'Previous', primary: true}]}},
{id: 476, object: 'kanji', data: {...subject.data, characters: '日', meanings: [{meaning: 'Day', primary: true}]}}];
