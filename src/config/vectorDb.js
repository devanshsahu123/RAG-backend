const { Pinecone } = require('@pinecone-database/pinecone');
const config = require('./index');

let pineconeClient = null;

const initVectorDb = async () => {
  if (!pineconeClient && config.pinecone.apiKey) {
    try {
      pineconeClient = new Pinecone({
        apiKey: config.pinecone.apiKey,
        environment: config.pinecone.environment,
      });
      console.log('Pinecone Initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Pinecone:', error);
      throw error;
    }
  }
  return pineconeClient;
};

const getIndex = async () => {
  if (!pineconeClient) {
    await initVectorDb();
  }
  if (!pineconeClient) {
    throw new Error('Pinecone client is not initialized Check API keys.');
  }
  return pineconeClient.Index(config.pinecone.indexName);
};

module.exports = {
  initVectorDb,
  getIndex
};
