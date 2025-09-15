// Test utility to verify the location API is working
import { locationService } from '../services/locationService';

export const testLocationAPI = async () => {
  console.log('🧪 Testing Location API...');

  try {
    // Test 1: Search for a common barangay
    console.log('Test 1: Searching for barangay "San"...');
    const barangayResults = await locationService.searchBarangays('San');
    console.log('Barangay results:', barangayResults);

    if (barangayResults.length > 0) {
      console.log('✅ Barangay search working!');

      // Test 2: Search for streets in the first barangay
      const firstBarangay = barangayResults[0].name;
      console.log(`Test 2: Searching for streets in "${firstBarangay}"...`);
      const streetResults = await locationService.searchStreets(firstBarangay, 'Main');
      console.log('Street results:', streetResults);

      if (streetResults.length > 0) {
        console.log('✅ Street search working!');
      } else {
        console.log('⚠️ Street search returned no results');
      }
    } else {
      console.log('⚠️ Barangay search returned no results');
    }

    // Test 3: Test direct API call
    console.log('Test 3: Testing direct API call...');
    const directResults = await locationService.searchGenericLocation('Tarlac City');
    console.log('Direct search results:', directResults);

    if (directResults.length > 0) {
      console.log('✅ Direct API call working!');
    } else {
      console.log('⚠️ Direct API call returned no results');
    }

  } catch (error) {
    console.error('❌ Location API test failed:', error);
  }
};

// Test function that can be called from console in development
(global as any).testLocationAPI = testLocationAPI;