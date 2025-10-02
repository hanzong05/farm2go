// Visual Search Service using Clarifai API
// This service analyzes uploaded images and finds similar products

interface ClarifaiConcept {
  name: string;
  value: number; // Confidence score 0-1
}

interface ClarifaiResponse {
  outputs?: Array<{
    data?: {
      concepts?: ClarifaiConcept[];
    };
  }>;
}

interface VisualSearchResult {
  labels: string[];
  categories: string[];
  confidence: number;
  searchTerms: string[];
}

// Get configuration from environment variables
const CLARIFAI_API_KEY = process.env.EXPO_PUBLIC_CLARIFAI_API_KEY || '';
// Use food-item-recognition model for better accuracy with fruits/vegetables
const CLARIFAI_MODEL_ID = process.env.EXPO_PUBLIC_CLARIFAI_MODEL_ID || 'food-item-recognition';
const CLARIFAI_USER_ID = 'clarifai'; // Use public Clarifai models
const CLARIFAI_APP_ID = 'main'; // Public app

export class VisualSearchService {
  private apiKey: string;
  private modelId: string;

  constructor() {
    this.apiKey = CLARIFAI_API_KEY;
    this.modelId = CLARIFAI_MODEL_ID;
  }

  /**
   * Analyze an image using Clarifai API via Supabase Edge Function
   * @param imageBase64 - Base64 encoded image
   * @returns Analysis results with labels and categories
   */
  async analyzeImage(imageBase64: string): Promise<VisualSearchResult> {
    try {
      console.log('🔍 Visual Search: Analyzing image via Supabase Edge Function');

      // Get Supabase URL from environment
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration missing');
      }

      // Call Supabase Edge Function instead of Clarifai directly
      // This avoids CORS issues on web
      const functionUrl = `${SUPABASE_URL}/functions/v1/visual-search`;

      console.log('Calling Edge Function:', functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: imageBase64,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge Function error:', errorText);
        throw new Error(`Edge Function error: ${response.status} ${response.statusText}`);
      }

      const data: ClarifaiResponse = await response.json();

      console.log('✅ Visual Search: Image analyzed successfully');
      console.log('📊 Full API Response:', JSON.stringify(data, null, 2));

      return this.processClarifaiResults(data);
    } catch (error) {
      console.error('❌ Visual Search: Error analyzing image:', error);
      throw error;
    }
  }

  /**
   * Process Clarifai API results to extract relevant search terms
   */
  private processClarifaiResults(result: ClarifaiResponse): VisualSearchResult {
    const labels: string[] = [];
    const categories: string[] = [];
    const searchTerms: string[] = [];
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Extract concepts (labels) from Clarifai response
    const concepts = result.outputs?.[0]?.data?.concepts || [];

    concepts.forEach((concept) => {
      const labelName = concept.name.toLowerCase();
      labels.push(labelName);
      searchTerms.push(labelName);
      totalConfidence += concept.value;
      confidenceCount++;

      // Map to product categories
      const category = this.mapLabelToCategory(concept.name);
      if (category && !categories.includes(category)) {
        categories.push(category);
      }
    });

    const confidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    console.log('🔍 Visual Search Results:', {
      labels: labels.slice(0, 5),
      categories,
      confidence,
      totalConcepts: concepts.length,
    });

    return {
      labels,
      categories,
      confidence,
      searchTerms: [...new Set(searchTerms)], // Remove duplicates
    };
  }

  /**
   * Map detected labels to product categories
   */
  private mapLabelToCategory(label: string): string | null {
    const lowerLabel = label.toLowerCase();

    const categoryMap: Record<string, string[]> = {
      vegetables: [
        'vegetable',
        'carrot',
        'tomato',
        'lettuce',
        'cabbage',
        'broccoli',
        'cucumber',
        'eggplant',
        'pepper',
        'spinach',
        'onion',
        'potato',
        'radish',
        'celery',
        'beet',
        'squash',
        'pumpkin',
      ],
      fruits: [
        'fruit',
        'apple',
        'banana',
        'orange',
        'grape',
        'strawberry',
        'mango',
        'pineapple',
        'watermelon',
        'melon',
        'berry',
        'citrus',
        'peach',
        'pear',
        'cherry',
        'kiwi',
        'avocado',
      ],
      grains: [
        'grain',
        'rice',
        'wheat',
        'corn',
        'maize',
        'oat',
        'barley',
        'cereal',
        'seed',
        'bread',
      ],
      herbs: [
        'herb',
        'basil',
        'mint',
        'parsley',
        'cilantro',
        'rosemary',
        'thyme',
        'oregano',
        'sage',
        'spice',
      ],
      dairy: [
        'dairy',
        'milk',
        'cheese',
        'yogurt',
        'butter',
        'cream',
      ],
      meat: [
        'meat',
        'chicken',
        'pork',
        'beef',
        'fish',
        'seafood',
        'poultry',
        'salmon',
        'tuna',
      ],
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some((keyword) => lowerLabel.includes(keyword))) {
        return category;
      }
    }

    return null;
  }

  /**
   * Calculate similarity score between search results and product
   */
  calculateSimilarityScore(
    searchResult: VisualSearchResult,
    product: {
      name: string;
      description: string;
      category: string;
    }
  ): number {
    let score = 0;
    const productText = `${product.name} ${product.description} ${product.category}`.toLowerCase();

    // Category match (highest weight)
    if (searchResult.categories.includes(product.category.toLowerCase())) {
      score += 50;
    }

    // Label matches (medium weight)
    searchResult.labels.forEach((label) => {
      if (productText.includes(label)) {
        score += 10;
      }
    });

    // Search term matches (lower weight)
    searchResult.searchTerms.forEach((term) => {
      if (productText.includes(term)) {
        score += 5;
      }
    });

    // Apply confidence multiplier
    score *= searchResult.confidence;

    return Math.min(100, score); // Cap at 100
  }
}

export const visualSearchService = new VisualSearchService();