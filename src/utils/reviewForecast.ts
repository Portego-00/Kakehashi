import type { DayForecast, SubjectTypeBreakdown } from "../types/wanikani";
import { isAssignmentInReviewQueueState } from "./api";

// Convert assignments into forecast review rows (avoiding duplicate API calls).
export function getForecastReviewsFromAssignments(assignmentsData: any[]): any[] {
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(now.getDate() + 7);

  // Convert assignments to forecast format
  const reviews: any[] = [];

  assignmentsData.forEach((assignment) => {
    if (!isAssignmentInReviewQueueState(assignment?.data)) {
      return;
    }

    const availableDate = new Date(assignment.data.available_at);
    // Only include reviews in the next 7 days
    if (availableDate >= now && availableDate <= sevenDaysLater) {
      reviews.push({
        available_at: assignment.data.available_at,
        subject_ids: [assignment.data.subject_id],
      });
    }
  });

  return reviews;
}

const createEmptyBreakdown = (): SubjectTypeBreakdown => ({
  radical: 0,
  kanji: 0,
  vocabulary: 0,
  kana_vocabulary: 0,
});

// Generate the seven-day review forecast.
export function buildReviewForecast(
  reviews: any[],
  subjectsById: Record<number, any> = {}
): DayForecast[] {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const toLocalDayIndex = (date: Date) =>
    Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
        DAY_IN_MS
    );
  const startDayIndex = toLocalDayIndex(startOfToday);

  // Get current hour for filtering
  const currentHour = now.getHours();

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Create an array for the next 7 days
  const nextSevenDays: DayForecast[] = [];

  // Add "Today" as the first day
  nextSevenDays.push({
    day: "Today",
    totalCount: 0,
    cumulativeCount: 0,
    subjectBreakdown: createEmptyBreakdown(),
    hours: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
      cumulativeCount: 0,
      subjectBreakdown: createEmptyBreakdown(),
      subjectIds: [],
    })),
  });

  // Add the next 6 days with proper names
  for (let i = 1; i <= 6; i++) {
    const date = new Date(startOfToday);
    date.setDate(startOfToday.getDate() + i);
    const dayName = i === 1 ? "Tomorrow" : dayNames[date.getDay()];

    nextSevenDays.push({
      day: dayName,
      displayDate: `${date.getMonth() + 1}/${date.getDate()}`,
      totalCount: 0,
      cumulativeCount: 0,
      subjectBreakdown: createEmptyBreakdown(),
      hours: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: 0,
        cumulativeCount: 0,
        subjectBreakdown: createEmptyBreakdown(),
        subjectIds: [],
      })),
    });
  }

  // If no reviews, return the empty structure
  if (!reviews || reviews.length === 0) {
    return nextSevenDays;
  }

  // First pass: collect current hour reviews count for cumulative calculation
  let currentHourReviewsCount = 0;
  reviews.forEach((review) => {
    if (!review.available_at) return;

    const reviewDate = new Date(review.available_at);
    // Use calendar-day indexing instead of ms/24h to avoid DST bucket shifts.
    const diffDays = toLocalDayIndex(reviewDate) - startDayIndex;
    const hour = reviewDate.getHours();

    // Count current hour reviews for cumulative calculation
    if (diffDays === 0 && hour === currentHour) {
      const count = review.subject_ids ? review.subject_ids.length : 1;
      if (count > 0) {
        currentHourReviewsCount += count;
      }
    }
  });

  // Second pass: process all reviews (excluding current hour from display)
  reviews.forEach((review) => {
    if (!review.available_at) return;

    // Parse the review date
    const reviewDate = new Date(review.available_at);

    // Calculate day difference from today
    // Use calendar-day indexing instead of ms/24h to avoid DST bucket shifts.
    const diffDays = toLocalDayIndex(reviewDate) - startDayIndex;

    // Only include reviews for the next 7 days
    if (diffDays < 0 || diffDays >= 7) return;

    // Skip reviews that are in the current hour of today (don't display them)
    const hour = reviewDate.getHours();
    if (diffDays === 0 && hour === currentHour) {
      return; // Skip current hour reviews from display
    }

    // Get the count of items in this review and track by subject type
    const count = review.subject_ids ? review.subject_ids.length : 1;
    if (count <= 0) return;

    // Track subject types if we have subject data
    const subjectBreakdown = createEmptyBreakdown();
    if (review.subject_ids && subjectsById) {
      review.subject_ids.forEach((subjectId: number) => {
        const subject = subjectsById[subjectId];
        if (subject) {
          const subjectType = subject.object as keyof SubjectTypeBreakdown;
          if (subjectBreakdown[subjectType] !== undefined) {
            subjectBreakdown[subjectType]++;
          }
        }
      });
    } else {
      // Fallback if no subject data available
      subjectBreakdown.vocabulary = count;
    }

    // Add to the appropriate day and hour
    nextSevenDays[diffDays].totalCount += count;
    nextSevenDays[diffDays].hours![hour].count += count;

    // Add subject IDs to the hour for critical review detection
    if (review.subject_ids) {
      nextSevenDays[diffDays].hours![hour].subjectIds!.push(
        ...review.subject_ids
      );
    }

    // Add subject breakdown to day and hour
    Object.keys(subjectBreakdown).forEach((type) => {
      const key = type as keyof SubjectTypeBreakdown;
      nextSevenDays[diffDays].subjectBreakdown![key] += subjectBreakdown[key];
      nextSevenDays[diffDays].hours![hour].subjectBreakdown![key] +=
        subjectBreakdown[key];
    });
  });

  // Calculate cumulative counts for days (including current hour reviews)
  let runningTotal = currentHourReviewsCount; // Start with current hour reviews
  nextSevenDays.forEach((day) => {
    runningTotal += day.totalCount;
    day.cumulativeCount = runningTotal;

    // Calculate cumulative counts for hours (including current hour for today)
    let hourlyRunningTotal = 0;
    if (day.day === "Today") {
      hourlyRunningTotal = currentHourReviewsCount; // Start with current hour for today
    }

    day.hours!.forEach((hour) => {
      hourlyRunningTotal += hour.count;
      hour.cumulativeCount = hourlyRunningTotal;
    });
  });

  // Only keep days with reviews (except Today)
  return nextSevenDays.filter(
    (day, index) => index === 0 || day.totalCount > 0
  );
}

// Keep forecast in sync with the latest assignments so dashboard cumulative
// values don't drift when only quick-count refreshes run.
export function buildReviewForecastFromAssignments(
  assignmentsData: any[],
  subjectsData: any[] = []
): DayForecast[] {
  const forecastData = getForecastReviewsFromAssignments(assignmentsData);
  const subjectsById = subjectsData.reduce((acc, subject) => {
    acc[subject.id] = subject;
    return acc;
  }, {} as Record<number, any>);

  return buildReviewForecast(forecastData, subjectsById);
}
