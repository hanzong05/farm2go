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

  // Fallback data for Tarlac City barangays when API is not available
  private tarlacBarangays: BarangayResult[] = [
    { name: 'Aguso', fullName: 'Barangay Aguso, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5979', placeId: 'aguso' },
    { name: 'Alvindia Primero', fullName: 'Barangay Alvindia Primero, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5879', placeId: 'alvindia-primero' },
    { name: 'Alvindia Segundo', fullName: 'Barangay Alvindia Segundo, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5879', placeId: 'alvindia-segundo' },
    { name: 'Amucao', fullName: 'Barangay Amucao, Tarlac City, Tarlac', lat: '15.4903', lon: '120.6079', placeId: 'amucao' },
    { name: 'Armenia', fullName: 'Barangay Armenia, Tarlac City, Tarlac', lat: '15.4603', lon: '120.5779', placeId: 'armenia' },
    { name: 'Asturias', fullName: 'Barangay Asturias, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5879', placeId: 'asturias' },
    { name: 'Atioc', fullName: 'Barangay Atioc, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5979', placeId: 'atioc' },
    { name: 'Balanti', fullName: 'Barangay Balanti, Tarlac City, Tarlac', lat: '15.4603', lon: '120.5879', placeId: 'balanti' },
    { name: 'Balete', fullName: 'Barangay Balete, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5779', placeId: 'balete' },
    { name: 'Bantog', fullName: 'Barangay Bantog, Tarlac City, Tarlac', lat: '15.4903', lon: '120.5879', placeId: 'bantog' },
    { name: 'Batang-batang', fullName: 'Barangay Batang-batang, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5779', placeId: 'batang-batang' },
    { name: 'Binauganan', fullName: 'Barangay Binauganan, Tarlac City, Tarlac', lat: '15.4803', lon: '120.6079', placeId: 'binauganan' },
    { name: 'Bora', fullName: 'Barangay Bora, Tarlac City, Tarlac', lat: '15.4603', lon: '120.6079', placeId: 'bora' },
    { name: 'Burot', fullName: 'Barangay Burot, Tarlac City, Tarlac', lat: '15.4903', lon: '120.5779', placeId: 'burot' },
    { name: 'Carangian', fullName: 'Barangay Carangian, Tarlac City, Tarlac', lat: '15.4703', lon: '120.6079', placeId: 'carangian' },
    { name: 'Care', fullName: 'Barangay Care, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5979', placeId: 'care' },
    { name: 'Central', fullName: 'Barangay Central, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5929', placeId: 'central' },
    { name: 'Culipaat', fullName: 'Barangay Culipaat, Tarlac City, Tarlac', lat: '15.4603', lon: '120.5779', placeId: 'culipaat' },
    { name: 'Cut-cut Primero', fullName: 'Barangay Cut-cut Primero, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5879', placeId: 'cut-cut-primero' },
    { name: 'Cut-cut Segundo', fullName: 'Barangay Cut-cut Segundo, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5879', placeId: 'cut-cut-segundo' },
    { name: 'Dela Paz', fullName: 'Barangay Dela Paz, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5879', placeId: 'dela-paz' },
    { name: 'Dolores', fullName: 'Barangay Dolores, Tarlac City, Tarlac', lat: '15.4903', lon: '120.5979', placeId: 'dolores' },
    { name: 'Laoang', fullName: 'Barangay Laoang, Tarlac City, Tarlac', lat: '15.4603', lon: '120.5879', placeId: 'laoang' },
    { name: 'Ligtasan', fullName: 'Barangay Ligtasan, Tarlac City, Tarlac', lat: '15.4803', lon: '120.6079', placeId: 'ligtasan' },
    { name: 'Lourdes', fullName: 'Barangay Lourdes, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5929', placeId: 'lourdes' },
    { name: 'Mabini', fullName: 'Barangay Mabini, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5929', placeId: 'mabini' },
    { name: 'Maligaya', fullName: 'Barangay Maligaya, Tarlac City, Tarlac', lat: '15.4903', lon: '120.5879', placeId: 'maligaya' },
    { name: 'Mapalacsiao', fullName: 'Barangay Mapalacsiao, Tarlac City, Tarlac', lat: '15.4603', lon: '120.6079', placeId: 'mapalacsiao' },
    { name: 'Mapatag', fullName: 'Barangay Mapatag, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5779', placeId: 'mapatag' },
    { name: 'Paraiso', fullName: 'Barangay Paraiso, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5829', placeId: 'paraiso' },
    { name: 'Poblacion', fullName: 'Barangay Poblacion, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5929', placeId: 'poblacion' },
    { name: 'Salapungan', fullName: 'Barangay Salapungan, Tarlac City, Tarlac', lat: '15.4903', lon: '120.6079', placeId: 'salapungan' },
    { name: 'San Carlos', fullName: 'Barangay San Carlos, Tarlac City, Tarlac', lat: '15.4603', lon: '120.5929', placeId: 'san-carlos' },
    { name: 'San Francisco', fullName: 'Barangay San Francisco, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5829', placeId: 'san-francisco' },
    { name: 'San Isidro', fullName: 'Barangay San Isidro, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5779', placeId: 'san-isidro' },
    { name: 'San Jose', fullName: 'Barangay San Jose, Tarlac City, Tarlac', lat: '15.4903', lon: '120.5929', placeId: 'san-jose' },
    { name: 'San Luis', fullName: 'Barangay San Luis, Tarlac City, Tarlac', lat: '15.4603', lon: '120.5829', placeId: 'san-luis' },
    { name: 'San Manuel', fullName: 'Barangay San Manuel, Tarlac City, Tarlac', lat: '15.4703', lon: '120.6079', placeId: 'san-manuel' },
    { name: 'San Miguel', fullName: 'Barangay San Miguel, Tarlac City, Tarlac', lat: '15.4803', lon: '120.6029', placeId: 'san-miguel' },
    { name: 'San Nicolas', fullName: 'Barangay San Nicolas, Tarlac City, Tarlac', lat: '15.4903', lon: '120.5829', placeId: 'san-nicolas' },
    { name: 'San Pablo', fullName: 'Barangay San Pablo, Tarlac City, Tarlac', lat: '15.4603', lon: '120.5979', placeId: 'san-pablo' },
    { name: 'San Pascual', fullName: 'Barangay San Pascual, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5979', placeId: 'san-pascual' },
    { name: 'San Rafael', fullName: 'Barangay San Rafael, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5879', placeId: 'san-rafael' },
    { name: 'San Roque', fullName: 'Barangay San Roque, Tarlac City, Tarlac', lat: '15.4903', lon: '120.6029', placeId: 'san-roque' },
    { name: 'San Sebastian', fullName: 'Barangay San Sebastian, Tarlac City, Tarlac', lat: '15.4603', lon: '120.6029', placeId: 'san-sebastian' },
    { name: 'San Vicente', fullName: 'Barangay San Vicente, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5829', placeId: 'san-vicente' },
    { name: 'Santa Cruz', fullName: 'Barangay Santa Cruz, Tarlac City, Tarlac', lat: '15.4803', lon: '120.6129', placeId: 'santa-cruz' },
    { name: 'Santa Maria', fullName: 'Barangay Santa Maria, Tarlac City, Tarlac', lat: '15.4903', lon: '120.6179', placeId: 'santa-maria' },
    { name: 'Santo Cristo', fullName: 'Barangay Santo Cristo, Tarlac City, Tarlac', lat: '15.4603', lon: '120.5729', placeId: 'santo-cristo' },
    { name: 'Santo Domingo', fullName: 'Barangay Santo Domingo, Tarlac City, Tarlac', lat: '15.4703', lon: '120.6129', placeId: 'santo-domingo' },
    { name: 'Santo Niño', fullName: 'Barangay Santo Niño, Tarlac City, Tarlac', lat: '15.4803', lon: '120.5729', placeId: 'santo-nino' },
    { name: 'Sepung Calzada', fullName: 'Barangay Sepung Calzada, Tarlac City, Tarlac', lat: '15.4903', lon: '120.5729', placeId: 'sepung-calzada' },
    { name: 'Sinait', fullName: 'Barangay Sinait, Tarlac City, Tarlac', lat: '15.4603', lon: '120.6179', placeId: 'sinait' },
    { name: 'Suizo', fullName: 'Barangay Suizo, Tarlac City, Tarlac', lat: '15.4703', lon: '120.6179', placeId: 'suizo' },
    { name: 'Tariji', fullName: 'Barangay Tariji, Tarlac City, Tarlac', lat: '15.4803', lon: '120.6179', placeId: 'tariji' },
    { name: 'Tibag', fullName: 'Barangay Tibag, Tarlac City, Tarlac', lat: '15.4903', lon: '120.6129', placeId: 'tibag' },
    { name: 'Trinidad', fullName: 'Barangay Trinidad, Tarlac City, Tarlac', lat: '15.4603', lon: '120.6129', placeId: 'trinidad' },
    { name: 'Ungot', fullName: 'Barangay Ungot, Tarlac City, Tarlac', lat: '15.4703', lon: '120.5729', placeId: 'ungot' },
    { name: 'Villa Bacolor', fullName: 'Barangay Villa Bacolor, Tarlac City, Tarlac', lat: '15.4803', lon: '120.6229', placeId: 'villa-bacolor' }
  ];

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

      // Check if it's a CORS error (common when running in web browser)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log('🚫 CORS error detected, will use fallback data');
        throw new Error('CORS_ERROR');
      }

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

      // If CORS error or API is unavailable, use fallback data with search
      if (error instanceof Error && (error.message === 'CORS_ERROR' || error.message.includes('fetch'))) {
        console.log('🔄 Using fallback barangay data for search due to CORS/API error');

        const filteredResults = this.tarlacBarangays.filter(barangay =>
          barangay.name.toLowerCase().includes(query.toLowerCase())
        );

        // Cache filtered results for 2 minutes (shorter than normal since it's fallback)
        this.cache.set(cacheKey, filteredResults);
        setTimeout(() => this.cache.delete(cacheKey), 2 * 60 * 1000);

        return filteredResults;
      }

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

      // If CORS error or API is unavailable, use fallback data
      if (error instanceof Error && (error.message === 'CORS_ERROR' || error.message.includes('fetch'))) {
        console.log('🔄 Using fallback barangay data due to CORS/API error');

        // Cache fallback results for 5 minutes (shorter than normal since it's fallback)
        this.cache.set(cacheKey, this.tarlacBarangays);
        setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

        return this.tarlacBarangays;
      }

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