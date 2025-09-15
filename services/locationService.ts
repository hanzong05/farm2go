// Free location service using Nominatim OpenStreetMap API
// This is completely free and doesn't require API keys

export interface LocationResult {
  display_name: string;
  place_id: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export interface BarangayResult {
  name: string;
  fullName: string;
  lat: string;
  lon: string;
  placeId: string;
}

export interface StreetResult {
  name: string;
  fullName: string;
  lat: string;
  lon: string;
  placeId: string;
}

class LocationService {
  private baseUrl = 'https://nominatim.openstreetmap.org/search';
  private cache = new Map<string, any>();

  // Rate limiting: max 1 request per second as per Nominatim usage policy
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second

  private async makeRequest(url: string): Promise<any> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    try {
      console.log('Making API request to:', url);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Farm2Go-App/1.0 (Mobile App for Agricultural Marketplace)',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      this.lastRequestTime = Date.now();

      if (!response.ok) {
        console.error(`HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API response:', data);
      return data;
    } catch (error) {
      console.error('Location API error:', error);
      throw error;
    }
  }

  async searchBarangays(query: string): Promise<BarangayResult[]> {
    if (!query || query.length < 2) return [];

    const cacheKey = `barangay_${query.toLowerCase()}`;
    if (this.cache.has(cacheKey)) {
      console.log('🗄️ Returning cached results for:', query);
      return this.cache.get(cacheKey);
    }

    console.log('🔍 Searching barangays for:', query);

    try {
      // Search for barangays in Tarlac City with multiple search strategies
      const searchQueries = [
        `Barangay ${query}, Tarlac City, Tarlac, Philippines`,
        `${query}, Tarlac City, Philippines`,
        `${query} Tarlac City`
      ];

      let data = [];
      for (const searchQuery of searchQueries) {
        console.log('Searching for:', searchQuery);
        const url = `${this.baseUrl}?` + new URLSearchParams({
          q: searchQuery,
          format: 'json',
          addressdetails: '1',
          limit: '8',
          countrycodes: 'ph',
          'accept-language': 'en'
        }).toString();

        data = await this.makeRequest(url);
        if (data && data.length > 0) {
          console.log(`Found ${data.length} raw results for query: ${searchQuery}`);

          // Log all raw results for debugging
          data.forEach((item: any, index: number) => {
            console.log(`Raw result ${index + 1}:`, {
              display_name: item.display_name,
              type: item.type,
              place_id: item.place_id,
              lat: item.lat,
              lon: item.lon
            });
          });

          break;
        }
      }

      if (!data || data.length === 0) {
        console.log('❌ No raw data returned from all search attempts');
        return [];
      }

      const results: BarangayResult[] = data
        .filter((item: LocationResult) => {
          const displayName = item.display_name.toLowerCase();
          console.log('Checking item:', {
            displayName,
            type: item.type,
            lat: item.lat,
            lon: item.lon
          });

          // Check if it's in Tarlac area
          const isInTarlac = (
            displayName.includes('tarlac city') ||
            displayName.includes('tarlac, central luzon') ||
            displayName.includes('tarlac, philippines') ||
            displayName.includes('tarlac')
          );

          // More flexible type checking
          const isValidType = (
            displayName.includes('barangay') ||
            item.type === 'administrative' ||
            item.type === 'village' ||
            item.type === 'hamlet' ||
            item.type === 'suburb' ||
            item.type === 'neighbourhood' ||
            item.type === 'locality' ||
            item.type === 'quarter' ||
            !item.type // sometimes type is undefined
          );

          console.log('Filter result:', { isInTarlac, isValidType, passes: isInTarlac && isValidType });
          return isInTarlac && isValidType;
        })
        .map((item: LocationResult) => ({
          name: this.extractBarangayName(item.display_name),
          fullName: item.display_name,
          lat: item.lat,
          lon: item.lon,
          placeId: item.place_id
        }))
        .slice(0, 8);

      // Cache results for 5 minutes
      this.cache.set(cacheKey, results);
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

      return results;
    } catch (error) {
      console.error('Error searching barangays:', error);
      return [];
    }
  }

  async searchStreets(barangayName: string, streetQuery: string): Promise<StreetResult[]> {
    if (!streetQuery || streetQuery.length < 2 || !barangayName) return [];

    const cacheKey = `street_${barangayName.toLowerCase()}_${streetQuery.toLowerCase()}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Search for streets with multiple strategies
      const searchQueries = [
        `${streetQuery}, ${barangayName}, Tarlac City, Philippines`,
        `${streetQuery} Street, ${barangayName}, Tarlac City`,
        `${streetQuery}, Tarlac City, Philippines`
      ];

      let data = [];
      for (const searchQuery of searchQueries) {
        console.log('Searching streets for:', searchQuery);
        const url = `${this.baseUrl}?` + new URLSearchParams({
          q: searchQuery,
          format: 'json',
          addressdetails: '1',
          limit: '8',
          countrycodes: 'ph',
          'accept-language': 'en'
        }).toString();

        data = await this.makeRequest(url);
        if (data && data.length > 0) {
          console.log(`Found ${data.length} street results`);
          break;
        }
      }

      if (!data || data.length === 0) {
        console.log('❌ No street data returned from API');
        return [];
      }

      const results: StreetResult[] = data
        .filter((item: LocationResult) => {
          const displayName = item.display_name.toLowerCase();
          console.log('Checking street item:', {
            displayName,
            type: item.type,
            lat: item.lat,
            lon: item.lon
          });

          // Check if it's in Tarlac area
          const isInTarlac = (
            displayName.includes('tarlac city') ||
            displayName.includes('tarlac, central luzon') ||
            displayName.includes('tarlac, philippines') ||
            displayName.includes('tarlac')
          );

          // More flexible street type checking
          const isStreetType = (
            item.type === 'residential' ||
            item.type === 'highway' ||
            item.type === 'road' ||
            item.type === 'street' ||
            item.type === 'way' ||
            item.type === 'path' ||
            item.type === 'footway' ||
            displayName.includes('street') ||
            displayName.includes('road') ||
            displayName.includes('avenue') ||
            displayName.includes('boulevard') ||
            displayName.includes('drive') ||
            displayName.includes('lane') ||
            !item.type // sometimes type is undefined
          );

          console.log('Street filter result:', { isInTarlac, isStreetType, passes: isInTarlac && isStreetType });
          return isInTarlac && isStreetType;
        })
        .map((item: LocationResult) => ({
          name: this.extractStreetName(item.display_name),
          fullName: item.display_name,
          lat: item.lat,
          lon: item.lon,
          placeId: item.place_id
        }))
        .slice(0, 8);

      // Cache results for 5 minutes
      this.cache.set(cacheKey, results);
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

      return results;
    } catch (error) {
      console.error('Error searching streets:', error);
      return [];
    }
  }

  async getAllBarangays(): Promise<BarangayResult[]> {
    const cacheKey = 'all_barangays_tarlac';
    if (this.cache.has(cacheKey)) {
      console.log('🗄️ Returning cached barangays');
      return this.cache.get(cacheKey);
    }

    console.log('🔍 Fetching all barangays in Tarlac City');

    try {
      const searchQueries = [
        'Barangay, Tarlac City, Tarlac, Philippines',
        'administrative Tarlac City Philippines'
      ];

      let allResults: BarangayResult[] = [];

      for (const searchQuery of searchQueries) {
        console.log('Searching for:', searchQuery);
        const url = `${this.baseUrl}?` + new URLSearchParams({
          q: searchQuery,
          format: 'json',
          addressdetails: '1',
          limit: '50',
          countrycodes: 'ph',
          'accept-language': 'en'
        }).toString();

        const data = await this.makeRequest(url);
        if (data && data.length > 0) {
          console.log(`Found ${data.length} raw results for query: ${searchQuery}`);

          const results: BarangayResult[] = data
            .filter((item: LocationResult) => {
              const displayName = item.display_name.toLowerCase();
              const isInTarlac = (
                displayName.includes('tarlac city') ||
                displayName.includes('tarlac, central luzon') ||
                displayName.includes('tarlac, philippines') ||
                displayName.includes('tarlac')
              );

              const isValidType = (
                displayName.includes('barangay') ||
                item.type === 'administrative' ||
                item.type === 'village' ||
                item.type === 'hamlet' ||
                item.type === 'suburb' ||
                item.type === 'neighbourhood' ||
                item.type === 'locality' ||
                item.type === 'quarter' ||
                !item.type
              );

              return isInTarlac && isValidType;
            })
            .map((item: LocationResult) => ({
              name: this.extractBarangayName(item.display_name),
              fullName: item.display_name,
              lat: item.lat,
              lon: item.lon,
              placeId: item.place_id
            }));

          allResults = [...allResults, ...results];
        }
      }

      // Remove duplicates and sort
      const uniqueResults = allResults.filter((result, index, self) =>
        index === self.findIndex(r => r.name.toLowerCase() === result.name.toLowerCase())
      ).sort((a, b) => a.name.localeCompare(b.name));

      // Cache results for 30 minutes
      this.cache.set(cacheKey, uniqueResults);
      setTimeout(() => this.cache.delete(cacheKey), 30 * 60 * 1000);

      console.log(`✅ Found ${uniqueResults.length} unique barangays`);
      return uniqueResults;
    } catch (error) {
      console.error('Error fetching all barangays:', error);
      return [];
    }
  }

  async getAllStreets(barangayName: string): Promise<StreetResult[]> {
    if (!barangayName) return [];

    const cacheKey = `all_streets_${barangayName.toLowerCase()}`;
    if (this.cache.has(cacheKey)) {
      console.log('🗄️ Returning cached streets for:', barangayName);
      return this.cache.get(cacheKey);
    }

    console.log('🔍 Fetching all streets in:', barangayName);

    try {
      const searchQueries = [
        `Street, ${barangayName}, Tarlac City, Philippines`,
        `Road, ${barangayName}, Tarlac City, Philippines`,
        `${barangayName}, Tarlac City street`
      ];

      let allResults: StreetResult[] = [];

      for (const searchQuery of searchQueries) {
        console.log('Searching streets for:', searchQuery);
        const url = `${this.baseUrl}?` + new URLSearchParams({
          q: searchQuery,
          format: 'json',
          addressdetails: '1',
          limit: '30',
          countrycodes: 'ph',
          'accept-language': 'en'
        }).toString();

        const data = await this.makeRequest(url);
        if (data && data.length > 0) {
          console.log(`Found ${data.length} street results`);

          const results: StreetResult[] = data
            .filter((item: LocationResult) => {
              const displayName = item.display_name.toLowerCase();
              const isInTarlac = (
                displayName.includes('tarlac city') ||
                displayName.includes('tarlac, central luzon') ||
                displayName.includes('tarlac, philippines') ||
                displayName.includes('tarlac')
              );

              const isStreetType = (
                item.type === 'residential' ||
                item.type === 'highway' ||
                item.type === 'road' ||
                item.type === 'street' ||
                item.type === 'way' ||
                item.type === 'path' ||
                item.type === 'footway' ||
                displayName.includes('street') ||
                displayName.includes('road') ||
                displayName.includes('avenue') ||
                displayName.includes('boulevard') ||
                displayName.includes('drive') ||
                displayName.includes('lane') ||
                !item.type
              );

              return isInTarlac && isStreetType;
            })
            .map((item: LocationResult) => ({
              name: this.extractStreetName(item.display_name),
              fullName: item.display_name,
              lat: item.lat,
              lon: item.lon,
              placeId: item.place_id
            }));

          allResults = [...allResults, ...results];
        }
      }

      // Remove duplicates and sort
      const uniqueResults = allResults.filter((result, index, self) =>
        index === self.findIndex(r => r.name.toLowerCase() === result.name.toLowerCase())
      ).sort((a, b) => a.name.localeCompare(b.name));

      // Cache results for 15 minutes
      this.cache.set(cacheKey, uniqueResults);
      setTimeout(() => this.cache.delete(cacheKey), 15 * 60 * 1000);

      console.log(`✅ Found ${uniqueResults.length} unique streets in ${barangayName}`);
      return uniqueResults;
    } catch (error) {
      console.error('Error fetching all streets:', error);
      return [];
    }
  }

  async searchGenericLocation(query: string, type: 'barangay' | 'street' = 'barangay'): Promise<LocationResult[]> {
    if (!query || query.length < 2) return [];

    try {
      const searchQuery = `${query}, Tarlac City, Tarlac, Philippines`;
      const url = `${this.baseUrl}?` + new URLSearchParams({
        q: searchQuery,
        format: 'json',
        addressdetails: '1',
        limit: '10',
        countrycodes: 'ph',
        'accept-language': 'en'
      }).toString();

      const data = await this.makeRequest(url);

      return data.filter((item: LocationResult) => {
        const displayName = item.display_name.toLowerCase();
        return displayName.includes('tarlac city') ||
               displayName.includes('tarlac, central luzon') ||
               displayName.includes('tarlac, philippines');
      });
    } catch (error) {
      console.error('Error searching generic location:', error);
      return [];
    }
  }

  private extractBarangayName(displayName: string): string {
    // Extract barangay name from full address
    const parts = displayName.split(',');
    let barangayName = parts[0].trim();

    // Remove "Barangay" prefix if present
    if (barangayName.toLowerCase().startsWith('barangay ')) {
      barangayName = barangayName.substring(9);
    }

    return barangayName;
  }

  private extractStreetName(displayName: string): string {
    // Extract street name from full address
    const parts = displayName.split(',');
    let streetName = parts[0].trim();

    // Clean up common prefixes/suffixes
    streetName = streetName.replace(/^(Street|Road|Avenue|Highway)\s+/i, '');

    return streetName;
  }

}

export const locationService = new LocationService();