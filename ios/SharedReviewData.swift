import Foundation

// Shared data model for WaniKani review information
struct WaniKaniReviewData: Codable {
    let currentReviews: Int
    let upcomingReviews: [Int] // Reviews by hour (0-23)
    let upcomingReviewTimes: [String: Int]? // Exact timestamps -> count
    let lastUpdated: Date
    let nextReviewTime: Date?
    
    init(currentReviews: Int = 0, upcomingReviews: [Int] = [], upcomingReviewTimes: [String: Int]? = nil, lastUpdated: Date = Date(), nextReviewTime: Date? = nil) {
        self.currentReviews = currentReviews
        self.upcomingReviews = upcomingReviews
        self.upcomingReviewTimes = upcomingReviewTimes
        self.lastUpdated = lastUpdated
        self.nextReviewTime = nextReviewTime
    }
}

// Shared UserDefaults for App Group communication
class SharedReviewDataManager {
    static let shared = SharedReviewDataManager()
    private let appGroupIdentifier = kakehashiAppGroupIdentifier
    private let reviewDataKey = kakehashiReviewDataKey
    
    private var sharedDefaults: UserDefaults? {
        return UserDefaults(suiteName: appGroupIdentifier)
    }
    
    private init() {}
    
    // Save review data to shared container
    func saveReviewData(_ data: WaniKaniReviewData) {
        guard let defaults = sharedDefaults else {
            print("❌ Failed to access App Group UserDefaults")
            return
        }
        
        do {
            let encodedData = try JSONEncoder().encode(data)
            defaults.set(encodedData, forKey: reviewDataKey)
            defaults.synchronize()
            print("✅ Saved review data to App Group: \(data.currentReviews) reviews")
        } catch {
            print("❌ Failed to encode review data: \(error)")
        }
    }
    
    // Load review data from shared container
    func loadReviewData() -> WaniKaniReviewData? {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: reviewDataKey) else {
            print("⚠️ No review data found in App Group")
            return nil
        }
        
        do {
            let reviewData = try JSONDecoder().decode(WaniKaniReviewData.self, from: data)
            print("✅ Loaded review data from App Group: \(reviewData.currentReviews) reviews")
            return reviewData
        } catch {
            print("❌ Failed to decode review data: \(error)")
            return nil
        }
    }
    
    // Get next review time for widget timeline
    func getNextReviewTime(from reviewData: WaniKaniReviewData) -> Date? {
        // If we have exact times, use the earliest future time
        if let exactTimes = reviewData.upcomingReviewTimes {
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            
            let futureTimes = exactTimes.compactMap { (timeString, count) -> Date? in
                guard count > 0, let date = dateFormatter.date(from: timeString) else { return nil }
                return date > Date() ? date : nil
            }.sorted()
            
            return futureTimes.first
        }
        
        // Fallback to hourly calculation
        let now = Date()
        let startOfNextHour = Calendar.current.nextDate(
            after: now,
            matching: DateComponents(minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) ?? now.addingTimeInterval(3600)
        
        for (hour, count) in reviewData.upcomingReviews.enumerated() {
            if count > 0 {
                return startOfNextHour.addingTimeInterval(Double(hour) * 3600)
            }
        }
        
        return nil
    }
    
    // Calculate total upcoming reviews for the next few hours
    func getTotalUpcomingReviews(from reviewData: WaniKaniReviewData, withinHours: Int = 24) -> Int {
        let maxIndex = min(reviewData.upcomingReviews.count, withinHours)
        return Array(reviewData.upcomingReviews[0..<maxIndex]).reduce(0, +)
    }
    
    // Get a human-readable description of next review time
    func getNextReviewDescription(from reviewData: WaniKaniReviewData) -> String {
        guard let nextTime = getNextReviewTime(from: reviewData) else {
            return "No upcoming reviews"
        }
        
        let now = Date()
        let timeInterval = nextTime.timeIntervalSince(now)
        
        if timeInterval < 3600 { // Less than 1 hour
            let minutes = Int(timeInterval / 60)
            return minutes > 1 ? "in \(minutes)m" : "now"
        } else if timeInterval < 24 * 3600 { // Less than 24 hours
            let hours = Int(timeInterval / 3600)
            let minutes = Int((timeInterval.truncatingRemainder(dividingBy: 3600)) / 60)
            if minutes > 0 {
                return "in \(hours)h \(minutes)m"
            } else {
                return "in \(hours)h"
            }
        } else { // More than 24 hours
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            return formatter.string(from: nextTime)
        }
    }
}
