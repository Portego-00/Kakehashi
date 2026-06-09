import { getReviewForecast } from '../api';

// Mock the fetch function
global.fetch = jest.fn();

// Mock console methods to prevent test output noise
console.log = jest.fn();
console.error = jest.fn();

// Helper to create a mock response
const mockResponse = (status: number, statusText: string, data: any) => {
  const body = JSON.stringify(data);
  const headers = new Headers({ 'content-type': 'application/json' });

  return Promise.resolve({
    status,
    statusText,
    ok: status >= 200 && status < 300,
    headers,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(body),
    clone: () => ({
      text: () => Promise.resolve(body),
    }),
  });
};

describe('WaniKani API Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getReviewForecast', () => {
    it('should fetch and organize review forecast data correctly', async () => {
      // Setup test data and mocks
      const mockApiToken = 'test-api-token';
      
      // Mock initial assignments response
      const mockAssignmentsData = {
        object: 'collection',
        url: 'https://api.wanikani.com/v2/assignments',
        pages: {
          per_page: 500,
          next_url: null,
          previous_url: null
        },
        total_count: 2,
        data_updated_at: '2023-01-01T00:00:00.000000Z',
        data: [
          {
            id: 1,
            object: 'assignment',
            data: {
              subject_id: 101,
              subject_type: 'kanji',
              available_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            }
          },
          {
            id: 2,
            object: 'assignment',
            data: {
              subject_id: 102,
              subject_type: 'vocabulary',
              available_at: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
            }
          }
        ]
      };

      // Mock available reviews response
      const mockAvailableReviewsData = {
        object: 'collection',
        url: 'https://api.wanikani.com/v2/assignments',
        pages: {
          per_page: 500,
          next_url: null,
          previous_url: null
        },
        total_count: 1,
        data_updated_at: '2023-01-01T00:00:00.000000Z',
        data: [
          {
            id: 3,
            object: 'assignment',
            data: {
              subject_id: 103,
              subject_type: 'radical',
              available_at: new Date().toISOString(), // Available now
            }
          }
        ]
      };

      // Mock subjects response
      const mockSubjectsData = {
        object: 'collection',
        url: 'https://api.wanikani.com/v2/subjects',
        pages: {
          per_page: 500,
          next_url: null,
          previous_url: null
        },
        total_count: 3,
        data_updated_at: '2023-01-01T00:00:00.000000Z',
        data: [
          {
            id: 101,
            object: 'kanji',
            data: { 
              characters: '漢', 
              meanings: [{ meaning: 'Chinese' }] 
            }
          },
          {
            id: 102,
            object: 'vocabulary',
            data: { 
              characters: '漢字', 
              meanings: [{ meaning: 'kanji' }] 
            }
          },
          {
            id: 103,
            object: 'radical',
            data: { 
              characters: '一', 
              meanings: [{ meaning: 'one' }] 
            }
          }
        ]
      };

      // Setup fetch mocks with proper chaining
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockResponse(200, 'OK', mockAssignmentsData))
        .mockImplementationOnce(() => mockResponse(200, 'OK', mockAvailableReviewsData))
        .mockImplementationOnce(() => mockResponse(200, 'OK', mockSubjectsData));

      // Call the function
      const result = await getReviewForecast(mockApiToken);

      // Verify the results
      expect(result).toBeDefined();
      expect(result.reviews).toBeDefined();
      expect(result.reviews).toBeInstanceOf(Array);
      expect(result.reviews.length).toBeGreaterThan(0);

      // Verify structure of hourly groups
      result.reviews.forEach(group => {
        expect(group).toHaveProperty('available_at');
        expect(group).toHaveProperty('subject_ids');
        expect(group.subject_ids).toBeInstanceOf(Array);
      });

      // Verify API calls 
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle errors and return a rejected promise', async () => {
      // Setup a mock that throws an error
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.reject(new Error('API error'))
      );

      // Verify that the function rejects with the error
      await expect(getReviewForecast('test-token')).rejects.toThrow('API error');
    });

    it('should correctly group reviews by hour', async () => {
      const hour14 = new Date(Date.now() + 2 * 60 * 60 * 1000);
      hour14.setMinutes(15, 0, 0);
      const hour14Later = new Date(hour14);
      hour14Later.setMinutes(45, 0, 0);
      const hour15 = new Date(hour14);
      hour15.setHours(hour15.getHours() + 1, 30, 0, 0);
      const expectedHour14 = new Date(hour14);
      expectedHour14.setMinutes(0, 0, 0);
      const expectedHour15 = new Date(hour15);
      expectedHour15.setMinutes(0, 0, 0);

      // Setup test data with multiple reviews in the same hour but different minutes
      const mockAssignmentsData = {
        object: 'collection',
        url: 'https://api.wanikani.com/v2/assignments',
        pages: {
          per_page: 500,
          next_url: null,
          previous_url: null
        },
        total_count: 3,
        data_updated_at: '2023-01-01T00:00:00.000000Z',
        data: [
          {
            data: {
              subject_id: 101,
              available_at: hour14.toISOString(), // Same hour as below, different minute
            }
          },
          {
            data: {
              subject_id: 102,
              available_at: hour14Later.toISOString(), // Same hour as above, different minute
            }
          },
          {
            data: {
              subject_id: 103,
              available_at: hour15.toISOString(), // Different hour
            }
          }
        ]
      };
      
      const mockAvailableReviewsData = {
        object: 'collection',
        url: 'https://api.wanikani.com/v2/assignments',
        pages: {
          per_page: 500,
          next_url: null,
          previous_url: null
        },
        total_count: 0,
        data_updated_at: '2023-01-01T00:00:00.000000Z',
        data: []
      };

      const mockSubjectsData = {
        object: 'collection',
        url: 'https://api.wanikani.com/v2/subjects',
        pages: {
          per_page: 500,
          next_url: null,
          previous_url: null
        },
        total_count: 3,
        data_updated_at: '2023-01-01T00:00:00.000000Z',
        data: []
      };

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockResponse(200, 'OK', mockAssignmentsData))
        .mockImplementationOnce(() => mockResponse(200, 'OK', mockAvailableReviewsData))
        .mockImplementationOnce(() => mockResponse(200, 'OK', mockSubjectsData));
      
      // Call the function
      const result = await getReviewForecast('test-token');
      
      // Verify that reviews are properly grouped by hour
      expect(result.reviews.length).toBe(2); // Should have 2 hour groups
      
      // Find the 14:00 hour group
      const hour14Group = result.reviews.find(g => g.available_at === expectedHour14.toISOString());
      expect(hour14Group).toBeDefined();
      expect(hour14Group?.subject_ids.length).toBe(2);
      expect(hour14Group?.subject_ids).toContain(101);
      expect(hour14Group?.subject_ids).toContain(102);
      
      // Find the 15:00 hour group
      const hour15Group = result.reviews.find(g => g.available_at === expectedHour15.toISOString());
      expect(hour15Group).toBeDefined();
      expect(hour15Group?.subject_ids.length).toBe(1);
      expect(hour15Group?.subject_ids).toContain(103);
    });
  });
});
