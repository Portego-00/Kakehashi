export interface SubjectTypeBreakdown {
  radical: number;
  kanji: number;
  vocabulary: number;
  kana_vocabulary: number;
}

export interface DayForecast {
  day: string;
  displayDate?: string;
  totalCount: number;
  cumulativeCount: number;
  subjectBreakdown?: SubjectTypeBreakdown;
  hours?: HourForecast[];
}

export interface HourForecast {
  hour: number;
  count: number;
  cumulativeCount: number;
  subjectBreakdown?: SubjectTypeBreakdown;
} 