import { debugStorageStatus } from './cache';
import { getPermanentStorageStats, testPermanentStorage } from './permanentStorage';

/**
 * Test function to verify permanent storage is working correctly
 * Call this from the app to test the new storage implementation
 */
export async function testStorageImplementation(): Promise<void> {
  console.log('\n🧪 === TESTING PERMANENT STORAGE IMPLEMENTATION ===\n');
  
  try {
    // Test basic MMKV functionality
    console.log('1️⃣ Testing basic MMKV functionality...');
    const mmkvWorks = testPermanentStorage();
    console.log(`   MMKV Test: ${mmkvWorks ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Show current storage status
    console.log('\n2️⃣ Current storage status:');
    await debugStorageStatus();
    
    // Show storage statistics
    console.log('\n3️⃣ Storage statistics:');
    const stats = getPermanentStorageStats();
    console.log(`   📂 Permanent keys: ${stats.permanentKeys.join(', ')}`);
    console.log(`   🔐 Secure keys: ${stats.secureKeys.join(', ')}`);
    console.log(`   💾 Permanent storage size: ${(stats.permanentSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   🔒 Secure storage size: ${(stats.secureSize / 1024).toFixed(2)} KB`);
    
    // Test migration scenario
    console.log('\n4️⃣ Testing migration from AsyncStorage to MMKV...');
    const { getAllSubjects } = await import('./cache');
    const subjects = await getAllSubjects();
    if (subjects.length > 0) {
      console.log(`   ✅ Found ${subjects.length} subjects in storage`);
      console.log(`   📊 Sample subjects: ${subjects.slice(0, 3).map(s => s.data?.characters || s.data?.meanings?.[0]?.meaning || 'unknown').join(', ')}`);
    } else {
      console.log('   ⚠️ No subjects found - may need to rebuild cache');
    }
    
    console.log('\n✅ Storage implementation test completed!');
    console.log('\n💡 What this fixes:');
    console.log('   • Subjects cache now stored in iOS Documents directory (not cleared by system)');
    console.log('   • Search will work even after iOS clears app cache during low storage');
    console.log('   • Automatic migration from old AsyncStorage to new permanent storage');
    console.log('   • Faster access with MMKV (~30x faster than AsyncStorage)');
    
  } catch (error) {
    console.error('❌ Storage implementation test failed:', error);
  }
  
  console.log('\n🧪 === END STORAGE TEST ===\n');
}

/**
 * Simulate iOS low storage scenario for testing
 * This clears only AsyncStorage (not MMKV) to test persistence
 */
export async function simulateLowStorageClearing(): Promise<void> {
  console.log('\n🔄 === SIMULATING iOS LOW STORAGE CLEARING ===\n');
  
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    
    // Get all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();
    const wanikaniKeys = allKeys.filter(key => 
      key.includes('wanikani') || 
      key.includes('subjects') ||
      key.includes('assignments') ||
      key.includes('cache')
    );
    
    console.log(`📱 Found ${wanikaniKeys.length} WaniKani AsyncStorage keys`);
    console.log(`🗑️ Clearing AsyncStorage keys: ${wanikaniKeys.slice(0, 3).join(', ')}${wanikaniKeys.length > 3 ? '...' : ''}`);
    
    // Clear AsyncStorage (simulating iOS cache clearing)
    if (wanikaniKeys.length > 0) {
      await AsyncStorage.multiRemove(wanikaniKeys);
      console.log('✅ AsyncStorage cleared (simulating iOS behavior)');
    }
    
    // Test that MMKV data survives
    console.log('\n📂 Checking if MMKV data survived clearing...');
    await debugStorageStatus();
    
    const { getAllSubjects } = await import('./cache');
    const subjects = await getAllSubjects();
    
    if (subjects.length > 0) {
      console.log(`✅ SUCCESS: ${subjects.length} subjects still available from MMKV!`);
      console.log('🎉 Permanent storage is working - data survives cache clearing!');
    } else {
      console.log('❌ No subjects found after clearing - permanent storage may not be working');
    }
    
  } catch (error) {
    console.error('❌ Simulation failed:', error);
  }
  
  console.log('\n🔄 === END SIMULATION ===\n');
}

/**
 * Instructions for the user to test the implementation
 */
export function printTestInstructions(): void {
  console.log('\n📋 === HOW TO TEST THE PERMANENT STORAGE FIX ===\n');
  console.log('1️⃣ First, let the app fully load all subjects (go to search screen)');
  console.log('2️⃣ In React Native debugger console, run:');
  console.log('   import("./src/utils/testPermanentStorage").then(m => m.testStorageImplementation())');
  console.log('');
  console.log('3️⃣ To test cache persistence, run:');
  console.log('   import("./src/utils/testPermanentStorage").then(m => m.simulateLowStorageClearing())');
  console.log('');
  console.log('4️⃣ Real-world test:');
  console.log('   • Force-quit the app');
  console.log('   • Fill device storage to trigger iOS cache clearing');
  console.log('   • Reopen app and check if search still works');
  console.log('\n✨ If working correctly, search will load instantly even after cache clearing!\n');
}