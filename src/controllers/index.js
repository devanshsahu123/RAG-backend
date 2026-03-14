// Health check / status controller

const getVectorDbStatus = async (req, res) => {
  // Pinecone is no longer required. Return a simple status message.
  res.status(200).json({
    status: 'success',
    data: {
      message: 'Vector DB is not configured. The app uses MongoDB + Gemini for RAG.',
      connected: false,
    },
  });
};

module.exports = {
  getVectorDbStatus,
};

