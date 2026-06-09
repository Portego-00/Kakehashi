import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheAnalysisResult {
  totalSize: number;
  totalSizeFormatted: string;
  itemCount: number;
  categories: {
    [category: string]: {
      size: number;
      sizeFormatted: string;
      count: number;
      items: {
        key: string;
        size: number;
        sizeFormatted: string;
      }[];
    };
  };
  largestItems: {
    key: string;
    size: number;
    sizeFormatted: string;
    category: string;
  }[];
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getItemSize(value: string): number {
  // Calculate size in bytes (UTF-8 encoding)
  return new Blob([value]).size;
}

function categorizeKey(key: string): string {
  if (key.startsWith('wanikani_subjects_cache')) return 'Subjects';
  if (key.startsWith('wanikani_assignments_cache')) return 'Assignments';
  if (key.startsWith('wanikani_study_materials_cache')) return 'Study Materials';
  if (key.startsWith('wanikani_dashboard_cache')) return 'Dashboard';
  if (key.startsWith('wanikani_etags_cache')) return 'ETags';
  if (key.startsWith('wanikani_last_modified_cache')) return 'Last Modified';
  if (key.startsWith('wanikani_srs_systems_cache')) return 'SRS Systems';
  if (key.startsWith('subjects_')) return 'Subjects (API)';
  if (key.startsWith('assignments_')) return 'Assignments (API)';
  if (key.startsWith('study_materials_')) return 'Study Materials (API)';
  if (key.startsWith('azure_')) return 'Azure Speech';
  if (key.startsWith('wanikani_theme_')) return 'Theme Settings';
  if (key.startsWith('wanikani_follow_system')) return 'Theme Settings';
  if (key.includes('wanikani')) return 'WaniKani (Other)';
  return 'Other';
}

export async function analyzeCacheStorage(): Promise<CacheAnalysisResult> {
  try {
    console.log('Starting cache analysis...');
    
    // Get all keys from AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`Found ${allKeys.length} total keys in AsyncStorage`);
    
    // Get all values
    const keyValuePairs = await AsyncStorage.multiGet(allKeys);
    
    const categories: { [category: string]: any } = {};
    const allItems: {
      key: string;
      size: number;
      sizeFormatted: string;
      category: string;
    }[] = [];
    
    let totalSize = 0;
    
    for (const [key, value] of keyValuePairs) {
      if (value === null) continue;
      
      const size = getItemSize(value);
      const category = categorizeKey(key);
      
      totalSize += size;
      
      // Initialize category if it doesn't exist
      if (!categories[category]) {
        categories[category] = {
          size: 0,
          sizeFormatted: '',
          count: 0,
          items: []
        };
      }
      
      // Add to category
      categories[category].size += size;
      categories[category].count += 1;
      categories[category].items.push({
        key,
        size,
        sizeFormatted: formatBytes(size)
      });
      
      // Add to all items for sorting
      allItems.push({
        key,
        size,
        sizeFormatted: formatBytes(size),
        category
      });
    }
    
    // Format category sizes and sort items within each category
    Object.keys(categories).forEach(category => {
      categories[category].sizeFormatted = formatBytes(categories[category].size);
      categories[category].items.sort((a: any, b: any) => b.size - a.size);
    });
    
    // Sort all items by size (largest first)
    allItems.sort((a, b) => b.size - a.size);
    
    const result: CacheAnalysisResult = {
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      itemCount: allItems.length,
      categories,
      largestItems: allItems.slice(0, 20) // Top 20 largest items
    };
    
    console.log('Cache analysis completed');
    console.log(`Total cache size: ${result.totalSizeFormatted}`);
    console.log(`Total items: ${result.itemCount}`);
    
    return result;
    
  } catch (error) {
    console.error('Error analyzing cache storage:', error);
    throw error;
  }
}

export async function printCacheAnalysis(): Promise<void> {
  try {
    const analysis = await analyzeCacheStorage();
    
    console.log('\n=== CACHE STORAGE ANALYSIS ===');
    console.log(`Total Size: ${analysis.totalSizeFormatted}`);
    console.log(`Total Items: ${analysis.itemCount}`);
    
    console.log('\n=== BY CATEGORY ===');
    const sortedCategories = Object.entries(analysis.categories)
      .sort(([,a], [,b]) => b.size - a.size);
    
    for (const [category, data] of sortedCategories) {
      console.log(`${category}: ${data.sizeFormatted} (${data.count} items)`);
    }
    
    console.log('\n=== LARGEST ITEMS ===');
    analysis.largestItems.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. ${item.key}: ${item.sizeFormatted} (${item.category})`);
    });
    
    console.log('\n=== DETAILED BREAKDOWN ===');
    for (const [category, data] of sortedCategories) {
      if (data.size > 1024 * 1024) { // Only show categories > 1MB
        console.log(`\n${category} (${data.sizeFormatted}):`);
        data.items.slice(0, 5).forEach((item: any) => {
          console.log(`  - ${item.key}: ${item.sizeFormatted}`);
        });
        if (data.items.length > 5) {
          console.log(`  ... and ${data.items.length - 5} more items`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error printing cache analysis:', error);
  }
}

export async function clearLargeCache(categoryName?: string, sizeThresholdMB: number = 10): Promise<void> {
  try {
    const analysis = await analyzeCacheStorage();
    
    const keysToRemove: string[] = [];
    
    if (categoryName) {
      // Clear specific category
      const category = analysis.categories[categoryName];
      if (category) {
        keysToRemove.push(...category.items.map(item => item.key));
        console.log(`Clearing ${categoryName} category: ${category.sizeFormatted}`);
      }
    } else {
      // Clear items larger than threshold
      const thresholdBytes = sizeThresholdMB * 1024 * 1024;
      analysis.largestItems.forEach(item => {
        if (item.size > thresholdBytes) {
          keysToRemove.push(item.key);
        }
      });
      console.log(`Clearing ${keysToRemove.length} items larger than ${sizeThresholdMB}MB`);
    }
    
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`Successfully removed ${keysToRemove.length} cache items`);
    } else {
      console.log('No items found to remove');
    }
    
  } catch (error) {
    console.error('Error clearing large cache items:', error);
    throw error;
  }
}

// Quick console function for debugging
export async function quickCacheCheck(): Promise<void> {
  try {
    console.log('🔍 Quick Cache Analysis...');
    const analysis = await analyzeCacheStorage();
    
    console.log(`📊 Total: ${analysis.totalSizeFormatted} (${analysis.itemCount} items)`);
    
    const sortedCategories = Object.entries(analysis.categories)
      .sort(([,a], [,b]) => b.size - a.size)
      .slice(0, 5);
    
    console.log('\n🏷️ Top Categories:');
    sortedCategories.forEach(([category, data]) => {
      console.log(`  ${category}: ${data.sizeFormatted} (${data.count} items)`);
    });
    
    console.log('\n🔝 Largest Items:');
    analysis.largestItems.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.sizeFormatted} - ${item.key.substring(0, 50)}...`);
    });
    
    // Suggest actions if cache is large
    if (analysis.totalSize > 50 * 1024 * 1024) { // > 50MB
      console.log('\n💡 Suggestions:');
      console.log('  - Your cache is quite large (>50MB)');
      console.log('  - Consider clearing large items: clearLargeCache(undefined, 5)');
      console.log('  - Or clear specific categories that are large');
    }
    
  } catch (error) {
    console.error('❌ Error in quick cache check:', error);
  }
}

export async function analyzeSubjectsCache(): Promise<void> {
  try {
    console.log('🔍 Detailed Subjects Cache Analysis...\n');
    
    const allKeys = await AsyncStorage.getAllKeys();
    const subjectKeys = allKeys.filter(key => 
      key.startsWith('wanikani_subjects_cache') || key.startsWith('subjects_')
    );
    
    if (subjectKeys.length === 0) {
      console.log('No subjects cache found');
      return;
    }
    
    const keyValuePairs = await AsyncStorage.multiGet(subjectKeys);
    
    console.log('📋 Subjects Cache Breakdown:\n');
    
    const individualSubjects: {key: string, size: number, data: any}[] = [];
    const collectionCaches: {key: string, size: number, data: any}[] = [];
    
    for (const [key, value] of keyValuePairs) {
      if (value === null) continue;
      
      const size = getItemSize(value);
      let parsedData;
      
      try {
        parsedData = JSON.parse(value);
      } catch (error) {
        console.log(`❌ Could not parse ${key}: ${error}`);
        continue;
      }
      
      if (key.startsWith('wanikani_subjects_cache_')) {
        // Individual subject cache
        individualSubjects.push({ key, size, data: parsedData });
      } else if (key.startsWith('subjects_')) {
        // Collection cache (API responses)
        collectionCaches.push({ key, size, data: parsedData });
      }
    }
    
    // Analyze individual subjects
    if (individualSubjects.length > 0) {
      console.log(`🔸 Individual Subjects (wanikani_subjects_cache_*): ${individualSubjects.length} items`);
      
      const totalIndividualSize = individualSubjects.reduce((sum, item) => sum + item.size, 0);
      console.log(`   Total size: ${formatBytes(totalIndividualSize)}`);
      console.log(`   Average size: ${formatBytes(totalIndividualSize / individualSubjects.length)}`);
      
      // Show largest individual subjects
      const sortedIndividual = individualSubjects.sort((a, b) => b.size - a.size);
      console.log('   Largest individual subjects:');
      sortedIndividual.slice(0, 5).forEach((item, index) => {
        const subjectId = item.key.split('_').pop();
        const subjectType = item.data?.data?.object || 'unknown';
        const characters = item.data?.data?.characters || item.data?.data?.character || 'N/A';
        console.log(`     ${index + 1}. ${formatBytes(item.size)} - ID ${subjectId} (${subjectType}): "${characters}"`);
      });
      console.log('');
    }
    
    // Analyze collection caches
    if (collectionCaches.length > 0) {
      console.log(`🔸 Collection Caches (subjects_*): ${collectionCaches.length} items`);
      
      const totalCollectionSize = collectionCaches.reduce((sum, item) => sum + item.size, 0);
      console.log(`   Total size: ${formatBytes(totalCollectionSize)}`);
      console.log(`   Average size: ${formatBytes(totalCollectionSize / collectionCaches.length)}`);
      
      // Analyze each collection cache
      const sortedCollections = collectionCaches.sort((a, b) => b.size - a.size);
      console.log('   Collection cache details:');
      sortedCollections.forEach((item, index) => {
        const dataCount = item.data?.data?.data?.length || item.data?.data?.length || 0;
        const totalCount = item.data?.data?.total_count || 'unknown';
        const hasNextUrl = item.data?.data?.pages?.next_url ? 'incomplete' : 'complete';
        
        // Extract query parameters from key to understand what this cache contains
        let queryInfo = 'all subjects';
        if (item.key.includes('levels')) {
          const levelMatch = item.key.match(/levels%5B%5D=(\d+)/);
          if (levelMatch) {
            queryInfo = `level ${levelMatch[1]}`;
          }
        } else if (item.key.includes('ids')) {
          queryInfo = 'specific IDs';
        } else if (item.key.includes('types')) {
          queryInfo = 'filtered by type';
        }
        
        console.log(`     ${index + 1}. ${formatBytes(item.size)} - ${queryInfo}`);
        console.log(`        Contains: ${dataCount} subjects (total: ${totalCount}, ${hasNextUrl})`);
        
        // Analyze the content if it's a large cache
        if (item.size > 1024 * 1024 && item.data?.data?.data) { // > 1MB
          const subjects = item.data.data.data;
          const typeCounts = subjects.reduce((acc: any, subject: any) => {
            const type = subject.object;
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});
          
          console.log(`        Types: ${Object.entries(typeCounts).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
          
          // Calculate average subject size
          const avgSubjectSize = item.size / subjects.length;
          console.log(`        Avg subject size: ${formatBytes(avgSubjectSize)}`);
        }
        console.log('');
      });
    }
    
    // Summary and recommendations
    console.log('💡 Analysis Summary:');
    console.log('');
    console.log('🔸 "Subjects" (wanikani_subjects_cache_*):');
    console.log('   - Individual subject caches for quick lookups');
    console.log('   - Each cache contains one subject with full details');
    console.log('   - Created when viewing individual subjects');
    console.log('');
    console.log('🔸 "Subjects (API)" (subjects_*):');
    console.log('   - Full API response caches from /subjects endpoint');
    console.log('   - Contains hundreds/thousands of subjects per cache');
    console.log('   - Much larger because they contain complete collections');
    console.log('   - Created when fetching subjects by level, type, or all subjects');
    console.log('');
    
    if (collectionCaches.length > 0) {
      const largestCollection = collectionCaches.reduce((max, item) => item.size > max.size ? item : max);
      if (largestCollection.size > 10 * 1024 * 1024) { // > 10MB
        console.log('⚠️  Recommendations:');
        console.log(`   - Your largest collection cache is ${formatBytes(largestCollection.size)}`);
        console.log('   - Consider clearing large collection caches if you need space');
        console.log('   - Individual subject caches are usually fine to keep');
      }
    }
    
  } catch (error) {
    console.error('❌ Error in subjects cache analysis:', error);
  }
} 