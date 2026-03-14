const vectorDbService = require('../services/vectorDbService');

// Example controller to health check the vector DB
const getVectorDbStatus = async (req, res, next) => {
  try {
    // A simple mock try to get the index stats or just return OK if initialized
    const status = await vectorDbService.checkStatus();
    res.status(200).json({ status: 'success', data: status });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVectorDbStatus,
};
