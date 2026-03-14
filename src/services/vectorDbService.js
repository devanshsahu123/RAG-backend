const { getIndex } = require('../config/vectorDb');

/**
 * Service to handle Vector DB operations using Pinecone.
 */
class VectorDbService {
  async checkStatus() {
    try {
      const index = await getIndex();
      const stats = await index.describeIndexStats();
      return { connected: true, stats };
    } catch (error) {
       console.error('Error connecting to Vector DB:', error);
       return { connected: false, error: error.message };
    }
  }

  async upsertDocument(id, vector, metadata) {
    const index = await getIndex();
    await index.upsert([
      {
        id,
        values: vector,
        metadata
      }
    ]);
  }

  async querySimilarDocuments(vector, topK = 5) {
    const index = await getIndex();
    const result = await index.query({
      vector,
      topK,
      includeMetadata: true
    });
    return result;
  }
}

module.exports = new VectorDbService();
